const { createClient } = require("@supabase/supabase-js");
const { requireUser } = require("./_auth");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
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
    const { data, error } = await supabaseAdmin
      .from("miyad_events")
      .select("id, subj, class, day, slot, date, color")
      .eq("user_id", user_sub)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Map DB column "class" back to "cls" for the frontend
    const events = (data || []).map((row) => ({
      id: row.id,
      subj: row.subj,
      cls: row.class,
      day: row.day,
      slot: row.slot,
      date: row.date,
      color: row.color,
    }));

    return { statusCode: 200, body: JSON.stringify(events) };
  } catch (error) {
    console.error("Error in get-miyad-events:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
