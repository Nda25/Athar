// netlify/functions/admin-activate.js
const { createClient } = require("@supabase/supabase-js");
const { requireAdmin } = require("./_auth.js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false }
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // بوابة الأدمن (JWT من Auth0)
  const gate = await requireAdmin(event);
  if (!gate.ok) return { statusCode: gate.status, body: gate.error };

  try {
    const body = JSON.parse(event.body || "{}");

    const email   = (body.email || "").toLowerCase() || null;   // اختياري
    const user_id = body.user_id || null;                       // اختياري (auth0 sub)
    const amount  = Math.max(1, parseInt(body.amount || 1, 10)); // عدد الوحدات
    const unit    = (body.unit || "months");                    // days | months | years
    const note    = body.note || null;

    if (!email && !user_id) {
      return { statusCode: 400, body: "email or user_id is required" };
    }
    if (!["days","months","years"].includes(unit)) {
      return { statusCode: 400, body: "invalid unit (allowed: days|months|years)" };
    }

    // نجيب الاشتراك الحالي (إن وُجد)
    const now = new Date();
    const { data: row, error: selErr } = await supabase
      .from("memberships")
      .select("expires_at")
      .or(`email.eq.${email},user_id.eq.${user_id}`)
      .maybeSingle();
    if (selErr) throw selErr;

    // قاعدة التمديد: لو فيه انتهاء بالمستقبل نبدأ منه، غير كذا نبدأ من الآن
    let base = now;
    if (row && row.expires_at) {
      const cur = new Date(row.expires_at);
      if (cur > now) base = cur;
    }

    // نضيف المدة حسب الوحدة المختارة
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

    const { data, error } = await supabase
      .from("memberships")
      .upsert(payload, { onConflict: "email" })
      .select()
      .single();

    if (error) throw error;

    return { statusCode: 200, body: JSON.stringify({ ok: true, expires_at: data.expires_at }) };
  } catch (e) {
    console.error("admin-activate", e);
    return { statusCode: 500, body: "server error" };
  }
};
