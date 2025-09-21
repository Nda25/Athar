// netlify/functions/complaints-create.js
// POST /.netlify/functions/complaints-create
// body: { email, name?, subject, type: 'complaint'|'suggestion', message, order_number? }

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_KEY, WHATSAPP_NUMBER } = process.env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return { statusCode: 500, body: "Missing Supabase envs" };
    }

    const data = JSON.parse(event.body || "{}");
    const email   = (data.email || "").trim().toLowerCase();
    const name    = (data.name || "").trim();
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

    // 1) إنشاء الشكوى / الاقتراح
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
        status: "new"
      })
    });

    const out = await res.json();
    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify(out) };
    }

    // 2) إضافة الرسالة الأولى لجدول complaint_messages
    const created = out && out[0];
    if (created && created.id) {
      await fetch(`${SUPABASE_URL}/rest/v1/complaint_messages`, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify({
          complaint_id: created.id,
          sender: "user",
          body: message
        })
      });
    }

    // 3) بناء رابط واتساب (إن وجد)
    let waLink = null;
    if (WHATSAPP_NUMBER) {
      const num = WHATSAPP_NUMBER.replace(/\D+/g, ""); // تأكد أنه أرقام فقط
      waLink = `https://wa.me/${num}`;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, complaint: out[0], whatsapp: waLink })
    };
  } catch (e) {
    return { statusCode: 500, body: e.message || "Server error" };
  }
};
