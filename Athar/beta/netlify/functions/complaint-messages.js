// GET /.netlify/functions/complaint-messages?complaint_id=<uuid>
// User can view messages for their own complaints

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

  const complaint_id = (event.queryStringParameters || {}).complaint_id;
  const userEmail = (event.queryStringParameters || {}).user_email;

  if (!complaint_id)
    return {
      statusCode: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: "Missing complaint_id",
    };

  if (!userEmail)
    return {
      statusCode: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: "Missing user_email",
    };

  try {
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
    if (complaint.user_email !== userEmail) {
      return {
        statusCode: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: "Access denied",
      };
    }

    // Fetch messages
    const { data: messages, error: mErr } = await supabase
      .from("complaint_messages")
      .select("*")
      .eq("complaint_id", complaint_id)
      .order("created_at", { ascending: true });

    if (mErr)
      return {
        statusCode: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: mErr.message,
      };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: true, messages: messages || [] }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: e.message || "Server error",
    };
  }
};
