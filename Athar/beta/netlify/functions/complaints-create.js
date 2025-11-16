// POST body: { subject, type: 'complaint'|'suggestion', message, email?, name?, order_number? }
// يتطلب مستخدم مسجّل (JWT) + (اختياري) اشتراك نشط

const { createClient } = require("@supabase/supabase-js");

// غيّري إلى false لو تبين السماح لأي مستخدم مسجّل

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: "Method Not Allowed",
    };
  }

  try {
    const data = JSON.parse(event.body || "{}");

    const subject = String(data.subject || "").trim();
    const type = String(data.type || "").trim(); // complaint | suggestion
    const message = String(data.message || "").trim();
    const orderNo = data.order_number ? String(data.order_number).trim() : null;

    if (!subject || !message || !["complaint", "suggestion"].includes(type)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: "Invalid payload",
      };
    }

    const userEmail = (data.email || "").toLowerCase().trim();
    const userName = data.name || null;
    const userSub = null; // بقينا منعرفش اليوزر

    if (!userEmail) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: "Missing user email",
      };
    }

    const { data: inserted, error: insErr } = await supabase
      .from("complaints")
      .insert([
        {
          user_email: userEmail,
          user_name: userName,
          subject,
          type,
          message,
          order_number: orderNo,
          channel: "web",
          status: "new",
        },
      ])
      .select()
      .single();

    if (insErr) {
      console.error("complaints: insert error", insErr);
      return {
        statusCode: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: "Failed to create complaint",
      };
    }

    if (inserted?.id) {
      const { error: msgErr } = await supabase
        .from("complaint_messages")
        .insert([{ complaint_id: inserted.id, sender: "user", body: message }]);
      if (msgErr) console.warn("complaint_messages: insert warning", msgErr);
    }

    let whatsapp = null;
    if (process.env.WHATSAPP_NUMBER) {
      const num = process.env.WHATSAPP_NUMBER.replace(/\D+/g, "");
      whatsapp = `https://wa.me/${num}`;
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: true, complaint: inserted, whatsapp }),
    };
  } catch (e) {
    console.error("complaints-create error:", e);
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: e.message || "Server error",
    };
  }
};
