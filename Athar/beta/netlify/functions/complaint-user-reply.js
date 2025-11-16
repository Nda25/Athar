// POST /.netlify/functions/complaint-user-reply
// body: { complaint_id, message }
// User can reply to their own complaints

const { requireUser } = require("./_auth");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

exports.handler = async (event) => {
  const gate = await requireUser(event);
  if (!gate.ok)
    return {
      statusCode: gate.status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: gate.error,
    };
  if (event.httpMethod !== "POST")
    return {
      statusCode: 405,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: "Method Not Allowed",
    };

  try {
    const { complaint_id, message, user_email } = JSON.parse(
      event.body || "{}"
    );

    if (!complaint_id || !message?.trim() || !user_email)
      return {
        statusCode: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: "Missing complaint_id, message, or user_email",
      };

    // Verify the complaint belongs to the user
    const { data: complaint, error: cErr } = await supabase
      .from("complaints")
      .select("id, user_email")
      .eq("id", complaint_id)
      .single();

    if (cErr)
      return {
        statusCode: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: cErr.message,
      };
    if (!complaint)
      return {
        statusCode: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: "Complaint not found",
      };

    // Check if user owns this complaint
    if (complaint.user_email !== user_email)
      return {
        statusCode: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: "Access denied",
      };

    // Insert the message
    const { data: msgRow, error: mErr } = await supabase
      .from("complaint_messages")
      .insert({ complaint_id, sender: "user", body: message })
      .select()
      .single();

    if (mErr)
      return {
        statusCode: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: mErr.message,
      };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: true, message: msgRow }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: e.message || "Server error",
    };
  }
};
