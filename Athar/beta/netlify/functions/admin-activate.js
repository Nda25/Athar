// /netlify/functions/admin-activate.js
const { createClient } = require("@supabase/supabase-js");
const { requireAdmin } = require("./_auth.js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // بوابة الأدمن (JWT من Auth0)
  const gate = await requireAdmin(event);
  if (!gate.ok) return { statusCode: gate.status, body: gate.error };

  try {
    const body = JSON.parse(event.body || "{}");

    const email   = (body.email || "").trim().toLowerCase() || null; // اختياري
    const user_id = (body.user_id || "").trim() || null;             // اختياري
    const amount  = Math.max(1, parseInt(body.amount || 1, 10));     // عدد الوحدات
    const unit    = (body.unit || "months");                          // days | months | years
    const note    = (body.note || null);

    if (!email && !user_id) {
      return { statusCode: 400, body: "email or user_id is required" };
    }
    if (!["days","months","years"].includes(unit)) {
      return { statusCode: 400, body: "invalid unit (allowed: days|months|years)" };
    }

    // اشتراك حالي (بدون .or مع null)
    let q = supabase
      .from("memberships")
      .select("expires_at,email,user_id")
      .limit(1);

    if (user_id) q = q.eq("user_id", user_id);
    else         q = q.eq("email", email);

    const { data: row, error: selErr } = await q.maybeSingle();
    if (selErr) throw selErr;

    // قاعدة التمديد
    const now = new Date();
    let base = now;
    if (row?.expires_at) {
      const cur = new Date(row.expires_at);
      if (cur > now) base = cur;
    }

    // أضف المدة
    const expires = new Date(base);
    if (unit === "days")   expires.setDate(expires.getDate() + amount);
    if (unit === "months") expires.setMonth(expires.getMonth() + amount);
    if (unit === "years")  expires.setFullYear(expires.getFullYear() + amount);

    const payload = {
      email,
      user_id,
      expires_at: expires.toISOString(),
      note,
      tenant_id: gate.org_id || null,
      updated_at: new Date().toISOString()
    };

    // مفتاح التعارض حسب المتوفر
    const conflictKey = user_id ? "user_id" : "email";

    const { data, error } = await supabase
      .from("memberships")
      .upsert(payload, { onConflict: conflictKey })
      .select()
      .single();

    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, expires_at: data.expires_at })
    };
  } catch (e) {
    console.error("admin-activate error:", e);
    // أظهري الرسالة أثناء التصحيح، وبعد ما يزبط ارجعي لرسالة عامة
    return { statusCode: 500, body: String(e.message || e) };
  }
};
