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
    const { event_data } = JSON.parse(event.body);

    if (!event_data) {
      return { statusCode: 400, body: "Missing event_data" };
    }

    const { subj, cls, day, slot, date, color } = event_data;

    if (!subj || !cls || !day) {
      return {
        statusCode: 400,
        body: "Missing required event fields (subj, class, day)",
      };
    }

    // Helper: safely convert to integer, return null if not a number
    const toIntOrNull = (v) => {
      if (v == null || v === "") return null;
      const n = Number(v);
      return Number.isInteger(n) ? n : null;
    };

    const { data, error } = await supabaseAdmin
      .from("miyad_events")
      .insert({
        user_id: user_sub,
        subj: subj,
        class: toIntOrNull(cls),
        day: day,
        slot: toIntOrNull(slot),
        date: date || new Date().toISOString().slice(0, 10),
        color: color,
      })
      .select("id");

    if (error) throw error;

    return { statusCode: 200, body: JSON.stringify(data) };
  } catch (error) {
    console.error("Error inserting miyad event:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
