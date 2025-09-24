// /netlify/functions/user-status.js
// يرجّع حالة اشتراك المستخدم (active/expired/none) + تاريخ الانتهاء
// يعتمد على: Auth0 JWT + Supabase SERVICE ROLE

const { createClient } = require("@supabase/supabase-js");
const { requireUser } = require("./_auth.js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

/**
 * يجيب حالة العضوية من v_user_status إن وجدت،
 * وإلا يفحص memberships بالاعتماد على end_at/expires_at.
 */
async function fetchMembershipStatus(user_sub, email) {
  // 1) جرّبي v_user_status إن كانت موجودة
  try {
    const { data, error } = await supabase
      .from("v_user_status")
      .select("status, active, expires_at")
      .or(`user_sub.eq.${user_sub},email.eq.${(email||"").toLowerCase()}`)
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return {
        status: data.active ? "active" : data.status || "none",
        active: !!data.active,
        expires_at: data.expires_at || null
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
    else if (email) q = q.eq("email", (email||"").toLowerCase());
    else return { status: "none", active: false, expires_at: null };

    const { data: rows, error } = await q;
    if (error) throw error;

    const row = rows?.[0];
    if (!row) return { status: "none", active: false, expires_at: null };

    const exp = row.end_at || row.expires_at;
    const active = exp ? new Date(exp) > new Date() : false;
    return {
      status: active ? "active" : (row.status || "expired"),
      active,
      expires_at: exp || null
    };
  } catch (_) {
    return { status: "none", active: false, expires_at: null };
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // تحقق المستخدم من التوكن
  const gate = await requireUser(event);
  if (!gate.ok) {
    return { statusCode: gate.status, body: gate.error };
  }

  const sub   = gate.user?.sub || null;
  const email = gate.user?.email || null;

  const res = await fetchMembershipStatus(sub, email);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    body: JSON.stringify({
      ok: true,
      user_sub: sub,
      email,
      ...res
    })
  };
};
