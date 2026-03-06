// يعرض أحدث المستخدمين مع حالة الاشتراك (من v_user_status) + fallback إلى users عند عدم توفر الـ View
const { requireAdmin } = require("./_auth");
const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  const gate = await requireAdmin(event);
  if (!gate.ok) return { statusCode: gate.status, body: gate.error };

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE, SUPABASE_SERVICE_KEY } =
    process.env;
  if (!SUPABASE_URL || !(SUPABASE_SERVICE_ROLE || SUPABASE_SERVICE_KEY)) {
    return { statusCode: 500, body: "Missing Supabase service credentials" };
  }

  // اقبلي المفتاحين (للتوافق)، وفضّلي SERVICE_ROLE
  const SERVICE = SUPABASE_SERVICE_ROLE || SUPABASE_SERVICE_KEY;
  const supa = createClient(SUPABASE_URL, SERVICE, {
    auth: { persistSession: false },
  });

  const params = new URLSearchParams(event.queryStringParameters || {});
  const q = (params.get("q") || "").trim();
  const active = params.get("active"); // 'true' | 'false' | null
  const limit = Math.min(parseInt(params.get("limit") || "20", 10), 100);
  const offset = parseInt(params.get("offset") || "0", 10);

  // سنحاول v_user_status أولاً
  async function tryView() {
    let query = supa
      .from("v_user_status")
      .select(
        "user_sub,email,name,display_name,avatar_url,active,expires_at,created_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (active === "true") query = query.eq("active", true);
    if (active === "false") query = query.eq("active", false);

    if (q) {
      query = query.or(
        `name.ilike.%${q}%,display_name.ilike.%${q}%,email.ilike.%${q}%`
      );
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return { rows: data || [], total: count || 0, source: "v_user_status" };
  }

  // بديل: جدول users + محاولة ضم معلومات من memberships/user_prefs
  async function fallbackUsers() {
    const base = new URL(`${SUPABASE_URL}/rest/v1/users`);
    const search = new URLSearchParams({
      select: "id,email,name,created_at",
      order: "created_at.desc",
      limit: String(limit),
      offset: String(offset),
    });

    if (q) search.append("or", `(name.ilike.*${q}*,email.ilike.*${q}*)`);

    // 🔧 الإصلاح: التحقق من نجاح الـ response قبل الـ parsing
    const res = await fetch(`${base}?${search.toString()}`, {
      headers: {
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
      },
    });

    // تحقق من حالة الـ response
    if (!res.ok) {
      const errorText = await res.text();
      console.error("Supabase users fetch failed:", res.status, errorText);
      throw new Error(`Failed to fetch users: ${res.status} - ${errorText}`);
    }

    const usersData = await res.json();
    console.log(
      "Supabase response (usersData):",
      JSON.stringify(usersData, null, 2)
    );

    // 🔧 الإصلاح: التحقق من أن usersData هي Array
    if (!Array.isArray(usersData)) {
      console.error("Expected array but got:", typeof usersData, usersData);
      throw new Error("Invalid response format from Supabase");
    }

    const users = usersData;

    // اجلب user_prefs لكل مستخدم
    const subs = users.map((u) => u.id).filter(Boolean);
    let prefsBySub = {};

    if (subs.length) {
      try {
        const pr = await fetch(
          `${SUPABASE_URL}/rest/v1/user_prefs?select=user_sub,display_name,avatar_url&user_sub=in.(${subs
            .map((s) => `"${s}"`)
            .join(",")})`,
          {
            headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
          }
        );

        if (pr.ok) {
          const prefs = await pr.json();
          if (Array.isArray(prefs)) {
            prefsBySub = Object.fromEntries(prefs.map((p) => [p.user_sub, p]));
          }
        }
      } catch (e) {
        console.warn("Failed to fetch user_prefs:", e);
      }
    }

    // اجلب آخر عضوية لكل مستخدم
    let statusByEmail = {};
    const emails = users
      .map((u) => (u.email || "").toLowerCase())
      .filter(Boolean);

    if (emails.length) {
      try {
        const mr = await fetch(
          `${SUPABASE_URL}/rest/v1/memberships?select=email,expires_at,end_at&email=in.(${emails
            .map((e) => `"${e}"`)
            .join(",")})`,
          {
            headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
          }
        );

        if (mr.ok) {
          const ms = await mr.json();
          if (Array.isArray(ms)) {
            for (const m of ms) {
              const key = (m.email || "").toLowerCase();
              const prev = statusByEmail[key];
              const exp = new Date(m.end_at || m.expires_at || 0).getTime();
              if (!prev || exp > prev._t) {
                statusByEmail[key] = {
                  expires_at: m.expires_at || m.end_at || null,
                  _t: exp,
                };
              }
            }
          }
        }
      } catch (e) {
        console.warn("Failed to fetch memberships:", e);
      }
    }

    const now = Date.now();
    const rows = users.map((u) => {
      const pref = prefsBySub[u.id] || {};
      const mem = statusByEmail[(u.email || "").toLowerCase()] || {};
      const exp = mem.expires_at ? new Date(mem.expires_at) : null;
      const activeFlag = exp ? exp.getTime() > now : false;

      return {
        user_sub: u.id,
        email: u.email,
        name: u.name,
        display_name: pref.display_name || null,
        avatar_url: pref.avatar_url || null,
        active: activeFlag,
        expires_at: exp ? exp.toISOString() : null,
        created_at: u.created_at,
      };
    });

    // فلترة active لو طلبت
    const filtered =
      active == null ? rows : rows.filter((r) => String(!!r.active) === active);

    return {
      rows: filtered,
      total: filtered.length,
      source: "users+prefs+memberships",
    };
  }

  try {
    try {
      const out = await tryView();
      return { statusCode: 200, body: JSON.stringify({ ok: true, ...out }) };
    } catch (viewError) {
      console.warn(
        "v_user_status query failed, trying fallback:",
        viewError.message
      );
      const fb = await fallbackUsers();
      return { statusCode: 200, body: JSON.stringify({ ok: true, ...fb }) };
    }
  } catch (e) {
    console.error("Admin users list error:", e);
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: e.message || "Server error",
        details: process.env.NODE_ENV === "development" ? e.stack : undefined,
      }),
    };
  }
};
