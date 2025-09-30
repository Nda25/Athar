// GET /.netlify/functions/complaints-get?id=<uuid>
// Admin only

const { requireAdmin } = require("./_auth");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

exports.handler = async (event) => {
  const gate = await requireAdmin(event);
  if (!gate.ok) return { statusCode: gate.status, headers:{'Content-Type':'text/plain; charset=utf-8'}, body: gate.error };

  const id = (event.queryStringParameters || {}).id;
  if (!id) return { statusCode: 400, headers:{'Content-Type':'text/plain; charset=utf-8'}, body: "Missing id" };

  try {
    const { data: complaint, error: cErr } = await supabase
      .from("complaints")
      .select("*")
      .eq("id", id)
      .single();

    if (cErr) return { statusCode: 500, headers:{'Content-Type':'text/plain; charset=utf-8'}, body: cErr.message };
    if (!complaint) return { statusCode: 404, headers:{'Content-Type':'text/plain; charset=utf-8'}, body: "Not found" };

    const { data: messages, error: mErr } = await supabase
      .from("complaint_messages")
      .select("*")
      .eq("complaint_id", id)
      .order("created_at", { ascending: true });

    if (mErr) return { statusCode: 500, headers:{'Content-Type':'text/plain; charset=utf-8'}, body: mErr.message };

    return {
      statusCode: 200,
      headers:{ "Content-Type":"application/json; charset=utf-8" },
      body: JSON.stringify({ ok: true, complaint, messages })
    };
  } catch (e) {
    return { statusCode: 500, headers:{'Content-Type':'text/plain; charset=utf-8'}, body: e.message || "Server error" };
  }
};
