// GET /.netlify/functions/user-complaints-list
// User can view their own complaints

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

  try {
    // Get email from query parameter (passed from frontend)
    const userEmail = (event.queryStringParameters || {}).user_email;

    if (!userEmail) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: "Missing user_email parameter",
      };
    }

    console.log("User email from parameter:", userEmail);

    const { data: complaints, error } = await supabase
      .from("complaints")
      .select("*")
      .eq("user_email", userEmail)
      .order("created_at", { ascending: false });

    console.log("Query result:", {
      complaints,
      error,
      count: complaints?.length,
    });

    if (error)
      return {
        statusCode: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: error.message,
      };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: true, rows: complaints || [] }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: e.message || "Server error",
    };
  }
};
