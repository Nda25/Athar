// GET /.netlify/functions/complaints-get?id=<uuid>
const { requireAdmin } = require("./_auth");

exports.handler = async (event) => {
  const gate = await requireAdmin(event);
  if (!gate.ok) return { statusCode: gate.status, body: gate.error };

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  const id = (event.queryStringParameters || {}).id;
  if (!id) return { statusCode: 400, body: "Missing id" };

  const hdrs = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`
  };

  try {
    const one = await fetch(`${SUPABASE_URL}/rest/v1/complaints?id=eq.${encodeURIComponent(id)}&select=*`, { headers: hdrs });
    const rows = await one.json();
    const complaint = rows && rows[0];
    if (!complaint) return { statusCode: 404, body: "Not found" };

    const msgsRes = await fetch(`${SUPABASE_URL}/rest/v1/complaint_messages?complaint_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.asc`, { headers: hdrs });
    const messages = await msgsRes.json();

    return { statusCode: 200, body: JSON.stringify({ ok:true, complaint, messages }) };
  } catch (e) {
    return { statusCode: 500, body: e.message || "Server error" };
  }
};
