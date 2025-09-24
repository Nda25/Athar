// /netlify/functions/complaints-reply.js
// POST /.netlify/functions/complaints-reply
// body: { complaint_id, message, next_status? ('in_progress'|'resolved'|'rejected') }
// Admin only

const { requireAdmin } = require("./_auth");
const { createClient } = require("@supabase/supabase-js");

// Supabase admin client (SR key)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

// ---------- optional email via Resend ----------
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
      from: "فريق أثر <team@n-athar.co>",
      to: [to],
      subject,
      html
    })
  });
  const out = await res.json().catch(()=> ({}));
  return { ok: res.ok, out };
}

// ---------- handler ----------
exports.handler = async (event) => {
  // auth & method
  const gate = await requireAdmin(event);
  if (!gate.ok) return { statusCode: gate.status, body: gate.error };
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { complaint_id, message, next_status } = JSON.parse(event.body || "{}");

    if (!complaint_id || !message?.trim()) {
      return { statusCode: 400, body: "Missing complaint_id or message" };
    }

    // 1) get complaint (to know user email/name/type/subject)
    const { data: complaint, error: cErr } = await supabase
      .from("complaints")
      .select("*")
      .eq("id", complaint_id)
      .single();

    if (cErr)   return { statusCode: 500, body: cErr.message };
    if (!complaint) return { statusCode: 404, body: "Not found" };

    // 2) insert admin reply into complaint_messages
    const { data: msgRow, error: mErr } = await supabase
      .from("complaint_messages")
      .insert({
        complaint_id,
        sender: "admin",
        body: message
      })
      .select()
      .single();

    if (mErr) return { statusCode: 400, body: mErr.message };

    // 3) optional status update
    let updated = complaint;
    const allowed = ["in_progress","resolved","rejected"];
    if (next_status && allowed.includes(next_status)) {
      const { data: up, error: upErr } = await supabase
        .from("complaints")
        .update({ status: next_status, updated_at: new Date().toISOString() })
        .eq("id", complaint_id)
        .select()
        .single();
      if (upErr) return { statusCode: 400, body: upErr.message };
      updated = up || updated;
    }

    // 4) notify user by email (optional)
    if (complaint.user_email) {
      const subjKind = complaint.type === "complaint" ? "شكواك" : "اقتراحك";
      const subject = `رد على ${subjKind} — أثر`;
      const html = `
        <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.8">
          <p>مرحبًا ${complaint.user_name || ""}</p>
          <p>تم الرد على ${subjKind} بعنوان:<br><strong>${complaint.subject}</strong></p>
          <p style="white-space:pre-line">${message}</p>
          ${next_status ? `<p>الحالة الحالية: <strong>${next_status}</strong></p>` : ""}
          <hr>
          <p style="color:#666;font-size:12px">فريق أثر — team@n-athar.co</p>
        </div>`;
      await sendEmail(complaint.user_email, subject, html);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, complaint: updated, message: msgRow })
    };
  } catch (e) {
    return { statusCode: 500, body: e.message || "Server error" };
  }
};
