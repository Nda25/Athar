// netlify/functions/admin-activate.js
const { createClient } = require("@supabase/supabase-js");
const { requireAdmin } = require("./_auth.js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false }
});

function res(status, body) {
  return { statusCode: status, body: typeof body === "string" ? body : JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return res(405, "Method Not Allowed");

  const gate = await requireAdmin(event);
  if (!gate.ok) return res(gate.status, gate.error);

  try {
    const body = JSON.parse(event.body || "{}");
    const email   = (body.email || "").toLowerCase() || null;
    const user_id = body.user_id || null;
    const note    = body.note || null;

    if (!email && !user_id) return res(400, "email or user_id is required");

    // دعم الشكل الجديد + توافق قديم
    const amount = Math.max(1, parseInt(body.amount || body.months || 1, 10));
    const unit   = (body.unit || (body.months ? "months" : "months")).toLowerCase(); // days|months|years

    const now = new Date();

    const { data: row } = await supabase
      .from("memberships")
      .select("expires_at")
      .or(`email.eq.${email},user_id.eq.${user_id}`)
      .maybeSingle();

    let base = now;
    if (row && row.expires_at) {
      const cur = new Date(row.expires_at);
      if (cur > now) base = cur; // تمديد من التاريخ الحالي إن كان أبعد
    }

    const expires = new Date(base);
    if (unit === "days")        expires.setDate(expires.getDate() + amount);
    else if (unit === "years")  expires.setFullYear(expires.getFullYear() + amount);
    else                        expires.setMonth(expires.getMonth() + amount); // months (default)

    const payload = {
      email,
      user_id,
      expires_at: expires.toISOString(),
      note,
      tenant_id: gate.org_id || null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("memberships")
      .upsert(payload, { onConflict: "email" })
      .select()
      .single();

    if (error) throw error;

    return res(200, { ok: true, expires_at: data.expires_at });
  } catch (e) {
    console.error("admin-activate", e);
    return res(500, "server error");
  }
};
