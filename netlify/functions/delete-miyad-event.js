const { createClient } = require("@supabase/supabase-js");
const { requireUser } = require("./_auth");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // ---- Auth: verify JWT and extract user ----
  const auth = await requireUser(event);
  if (!auth.ok) {
    return {
      statusCode: auth.status,
      body: JSON.stringify({ error: auth.error }),
    };
  }
  const user_sub = auth.user.sub;

  try {
    const { event_id } = JSON.parse(event.body);

    if (!event_id) {
      return { statusCode: 400, body: "Missing event_id" };
    }

    const { data, error } = await supabaseAdmin
      .from("miyad_events")
      .delete()
      .eq("id", event_id)
      .eq("user_id", user_sub)
      .select("id");

    if (error) throw error;

    if (!data || data.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Event not found or not owned by user" }),
      };
    }

    return { statusCode: 200, body: JSON.stringify(data) };
  } catch (error) {
    console.error("Error in delete-miyad-event:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
