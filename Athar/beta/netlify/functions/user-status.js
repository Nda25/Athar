// /netlify/functions/user-status.js
// يرجّع حالة اشتراك المستخدم (active/expired/none) + تاريخ الانتهاء
// يعتمد على: Auth0 JWT + Supabase SERVICE ROLE

const { createClient } = require("@supabase/supabase-js");
const { requireUser } = require("./_auth.js");
const { createPerf } = require("./_perf.js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

const STATUS_CACHE_TTL_MS = Math.max(
  0,
  Number(process.env.USER_STATUS_CACHE_TTL_MS || 15000)
);
const statusCache = new Map();

function getCachedStatus(key) {
  if (!STATUS_CACHE_TTL_MS) return null;
  const item = statusCache.get(key);
  if (!item) return null;
  if (item.expiresAt <= Date.now()) {
    statusCache.delete(key);
    return null;
  }
  return item.value;
}

function setCachedStatus(key, value) {
  if (!STATUS_CACHE_TTL_MS) return;
  statusCache.set(key, {
    value,
    expiresAt: Date.now() + STATUS_CACHE_TTL_MS,
  });
}

/**
 * يجيب حالة العضوية من v_user_status إن وجدت،
 * وإلا يفحص memberships، وإلا يفحص users مباشرة.
 */
async function fetchMembershipStatus(user_sub, email) {
  // 1) جرّبي v_user_status إن كانت موجودة
  try {
    const { data, error } = await supabase
      .from("v_user_status")
      .select("status, active, expires_at")
      .or(`user_sub.eq.${user_sub},email.eq.${(email || "").toLowerCase()}`)
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return {
        status: data.active ? "active" : data.status || "none",
        active: !!data.active,
        expires_at: data.expires_at || null,
      };
    }
  } catch (_) {}

  // 2) احتياطي: memberships مباشرة
  try {
    let q = supabase
      .from("memberships")
      .select("end_at, expires_at, status")
      .order("end_at", { ascending: false })
      .limit(1);

    if (user_sub) q = q.eq("user_id", user_sub);
    else if (email) q = q.eq("email", (email || "").toLowerCase());
    else return { status: "none", active: false, expires_at: null };

    const { data: rows, error } = await q;
    if (!error && rows && rows[0]) {
      const row = rows[0];
      const exp = row.end_at || row.expires_at;
      const active = exp ? new Date(exp) > new Date() : false;
      return {
        status: active ? "active" : row.status || "expired",
        active,
        expires_at: exp || null,
      };
    }
  } catch (_) {}

  // 3) احتياطي ثاني: جدول users مباشرة
  try {
    const { data: userData, error } = await supabase
      .from("users")
      .select("status, end_at, start_at, plan")
      .eq("email", (email || "").toLowerCase())
      .limit(1)
      .maybeSingle();

    if (!error && userData) {
      const exp = userData.end_at;
      const active =
        userData.status === "active" && exp && new Date(exp) > new Date();
      return {
        status: active ? "active" : userData.status || "none",
        active,
        expires_at: exp || null,
        plan: userData.plan || null,
        start_at: userData.start_at || null,
      };
    }
  } catch (_) {}

  return { status: "none", active: false, expires_at: null };
}

exports.handler = async (event) => {
  const perf = createPerf("user-status", event);

  if (event.httpMethod !== "GET") {
    perf.end({ statusCode: 405 });
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // تحقق المستخدم من التوكن
  const gate = await requireUser(event);
  perf.mark("auth_done");
  if (!gate.ok) {
    perf.end({ statusCode: gate.status || 401, unauthorized: true });
    return { statusCode: gate.status, body: gate.error };
  }

  const sub = gate.user?.sub || null;
  const email = gate.user?.email || null;
  const cacheKey = `${sub || ""}|${(email || "").toLowerCase()}`;

  const cached = getCachedStatus(cacheKey);
  if (cached) {
    perf.end({ statusCode: 200, cache: "hit" });
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Athar-Cache": "HIT",
      },
      body: JSON.stringify(cached),
    };
  }

  const res = await fetchMembershipStatus(sub, email);
  perf.mark("db_done");

  const responseBody = {
    ok: true,
    user_sub: sub,
    email,
    ...res,
  };

  setCachedStatus(cacheKey, responseBody);
  perf.end({ statusCode: 200, cache: "miss" });

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Athar-Cache": "MISS",
    },
    body: JSON.stringify(responseBody),
  };
};
