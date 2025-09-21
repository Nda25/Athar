// netlify/functions/complaints-create.js
// POST /.netlify/functions/complaints-create
// body: { email, name?, subject, type: 'complaint'|'suggestion', message, order_number? }
// ملاحظة: الآن تتطلب "مستخدمًا مسجّلًا ومشتركًا فعّالاً"

const { requireUser } = require("./_auth");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false }
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // بوابة المستخدم
  const gate = await requireUser(event);
  if (!gate.ok) return { statusCode: gate.status, body: gate.error };

  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_KEY, WHATSAPP_NUMBER } = process.env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return { statusCode: 500, body: "Missing Supabase envs" };
    }

    // تحقق الاشتراك الفعّال من جدول memberships
    const emailFromToken = (gate.user.email || "").toLowerCase();
    const userSub        = gate.user.sub;

    const { data: member, error: mErr } = await supabase
      .from("memberships")
      .select("expires_at")
      .or(`email.eq.${emailFromToken},user_id.eq.${userSub}`)
      .maybeSingle();

    const isActive = member && member.expires_at && (new Date(member.expires_at) > new Date());
    if (mErr || !isActive) {
      return { statusCode: 403, body: "Only active subscribers can send complaints/suggestions" };
    }

    // حمل الطلب
    const data = JSON.parse(event.body || "{}");
    const email   = (data.email || emailFromToken || "").trim().toLowerCase();
    const name    = (data.name || gate.user.name || "").trim();
    const subject = (data.subject || "").trim();
    const type    = (data.type || "").trim();
    const message = (data.message || "").trim();
    const orderNo = (data.order_number || "").trim();

    if (!email || !subject || !message || !["complaint","suggestion"].includes(type)) {
      return { statusCode: 400, body: "Invalid payload" };
    }

    const url  = `${SUPABASE_URL}/rest/v1/complaints`;
    const hdrs = {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    };

    // 1) إنشاء الشكوى/الاقتراح
    const res = await fetch(url, {
      method: "POST",
      headers: hdrs,
      body: JSON.stringify({
        user_email: email,
        user_name: name || null,
        subject,
        type,
        message,
        order_number: orderNo || null,
        channel: "web",
        status: "new",
        user_id: userSub || null
      })
    });

    const out = await res.json();
    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify(out) };
    }

    // 2) إضافة الرسالة الأولى
    const created = out && out[0];
    if (created && created.id) {
      await fetch(`${SUPABASE_URL}/rest/v1/complaint_messages`, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify({ complaint_id: created.id, sender: "user", body: message })
      });
    }

    // 3) رابط واتساب (اختياري)
    let waLink = null;
    if (WHATSAPP_NUMBER) {
      const num = WHATSAPP_NUMBER.replace(/\D+/g, "");
      waLink = `https://wa.me/${num}`;
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, complaint: out[0], whatsapp: waLink }) };
  } catch (e) {
    return { statusCode: 500, body: e.message || "Server error" };
  }
};
