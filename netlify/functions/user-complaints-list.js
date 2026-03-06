// GET /.netlify/functions/user-complaints-list
// User can view only their own complaints

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
    const jwtEmail = String(gate.user?.email || "").toLowerCase().trim();
    if (!jwtEmail) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: "Missing user identity",
      };
    }

    const requestedEmail = String(
      (event.queryStringParameters || {}).user_email || "",
    )
      .toLowerCase()
      .trim();

    if (requestedEmail && requestedEmail !== jwtEmail) {
      return {
        statusCode: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: "Access denied",
      };
    }

    const { data: complaints, error } = await supabase
      .from("complaints")
      .select("*")
      .eq("user_email", jwtEmail)
      .order("created_at", { ascending: false });

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
