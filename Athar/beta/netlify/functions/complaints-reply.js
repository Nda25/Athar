// POST /.netlify/functions/complaints-reply
// body: { complaint_id, message, next_status? ('in_progress'|'resolved'|'rejected') }
const { requireAdmin } = require("./_auth");

async function sendEmail(to, subject, html) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.log("[email skipped] ->", { to, subject });
    return { ok: true, skipped: true };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "فريق أثر <team@athar.co>",
      to: [to],
      subject,
      html
    })
  });
  const out = await res.json();
  return { ok: res.ok, out };
}

exports.handler = async (event) => {
  const gate = await requireAdmin(event);
  if (!gate.ok) return { statusCode: gate.status, body: gate.error };

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
    const body = JSON.parse(event.body || "{}");
    const { complaint_id, message, next_status } = body;

    if (!complaint_id || !message) {
      return { statusCode: 400, body: "Missing complaint_id or message" };
    }

    const hdrs = {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    };

    // 1) اجلب الشكوى لمعرفة بريد المستخدم
    const cRes = await fetch(`${SUPABASE_URL}/rest/v1/complaints?id=eq.${encodeURIComponent(complaint_id)}&select=*`, { headers: hdrs });
    const rows = await cRes.json();
    const complaint = rows && rows[0];
    if (!complaint) return { statusCode: 404, body: "Not found" };

    // 2) خزّن الرد في complaint_messages
    const msgRes = await fetch(`${SUPABASE_URL}/rest/v1/complaint_messages`, {
      method: "POST",
      headers: hdrs,
      body: JSON.stringify({
        complaint_id,
        sender: "admin",
        body: message
      })
    });
    if (!msgRes.ok) {
      const j = await msgRes.json();
      return { statusCode: 400, body: JSON.stringify(j) };
    }

    // 3) غيّر الحالة إن طُلب
    let updated = complaint;
    if (next_status && ["in_progress","resolved","rejected"].includes(next_status)) {
      const up = await fetch(`${SUPABASE_URL}/rest/v1/complaints?id=eq.${encodeURIComponent(complaint_id)}`, {
        method: "PATCH",
        headers: hdrs,
        body: JSON.stringify({ status: next_status })
      });
      const upOut = await up.json();
      updated = upOut && upOut[0] ? upOut[0] : updated;
    }

    // 4) أرسل إيميل للعميل (اختياري)
    const emailTo = complaint.user_email;
    if (emailTo) {
      const subject = `رد على ${complaint.type === "complaint" ? "شكواك" : "اقتراحك"} — أثر`;
      const html = `
        <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.8">
          <p>مرحبًا ${complaint.user_name || ""}</p>
          <p>تم الرد على ${complaint.type === "complaint" ? "الشكوى" : "الاقتراح"} بعنوان:<br>
          <strong>${complaint.subject}</strong></p>
          <p style="white-space:pre-line">${message}</p>
          <hr>
          <p style="color:#666;font-size:12px">فريق أثر — team@athar.co</p>
        </div>`;
      await sendEmail(emailTo, subject, html);
    }

    return { statusCode: 200, body: JSON.stringify({ ok:true, complaint: updated }) };
  } catch (e) {
    return { statusCode: 500, body: e.message || "Server error" };
  }
};// POST /.netlify/functions/complaints-reply
// body: { complaint_id, message, next_status? ('in_progress'|'resolved'|'rejected') }
const { requireAdmin } = require("./_auth");

async function sendEmail(to, subject, html) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.log("[email skipped] ->", { to, subject });
    return { ok: true, skipped: true };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "فريق أثر <team@athar.co>",
      to: [to],
      subject,
      html
    })
  });
  const out = await res.json();
  return { ok: res.ok, out };
}

exports.handler = async (event) => {
  const gate = await requireAdmin(event);
  if (!gate.ok) return { statusCode: gate.status, body: gate.error };

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
    const body = JSON.parse(event.body || "{}");
    const { complaint_id, message, next_status } = body;

    if (!complaint_id || !message) {
      return { statusCode: 400, body: "Missing complaint_id or message" };
    }

    const hdrs = {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    };

    // 1) اجلب الشكوى لمعرفة بريد المستخدم
    const cRes = await fetch(`${SUPABASE_URL}/rest/v1/complaints?id=eq.${encodeURIComponent(complaint_id)}&select=*`, { headers: hdrs });
    const rows = await cRes.json();
    const complaint = rows && rows[0];
    if (!complaint) return { statusCode: 404, body: "Not found" };

    // 2) خزّن الرد في complaint_messages
    const msgRes = await fetch(`${SUPABASE_URL}/rest/v1/complaint_messages`, {
      method: "POST",
      headers: hdrs,
      body: JSON.stringify({
        complaint_id,
        sender: "admin",
        body: message
      })
    });
    if (!msgRes.ok) {
      const j = await msgRes.json();
      return { statusCode: 400, body: JSON.stringify(j) };
    }

    // 3) غيّر الحالة إن طُلب
    let updated = complaint;
    if (next_status && ["in_progress","resolved","rejected"].includes(next_status)) {
      const up = await fetch(`${SUPABASE_URL}/rest/v1/complaints?id=eq.${encodeURIComponent(complaint_id)}`, {
        method: "PATCH",
        headers: hdrs,
        body: JSON.stringify({ status: next_status })
      });
      const upOut = await up.json();
      updated = upOut && upOut[0] ? upOut[0] : updated;
    }

    // 4) أرسل إيميل للعميل (اختياري)
    const emailTo = complaint.user_email;
    if (emailTo) {
      const subject = `رد على ${complaint.type === "complaint" ? "شكواك" : "اقتراحك"} — أثر`;
      const html = `
        <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.8">
          <p>مرحبًا ${complaint.user_name || ""}</p>
          <p>تم الرد على ${complaint.type === "complaint" ? "الشكوى" : "الاقتراح"} بعنوان:<br>
          <strong>${complaint.subject}</strong></p>
          <p style="white-space:pre-line">${message}</p>
          <hr>
          <p style="color:#666;font-size:12px">فريق أثر — team@athar.co</p>
        </div>`;
      await sendEmail(emailTo, subject, html);
    }

    return { statusCode: 200, body: JSON.stringify({ ok:true, complaint: updated }) };
  } catch (e) {
    return { statusCode: 500, body: e.message || "Server error" };
  }
};
