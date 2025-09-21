// POST /.netlify/functions/complaints-update
// body: { complaint_id, status }  // status in: new|in_progress|resolved|rejected
const { requireAdmin } = require("./_auth");

exports.handler = async (event) => {
  const gate = await requireAdmin(event);
  if (!gate.ok) return { statusCode: gate.status, body: gate.error };

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
    const { complaint_id, status } = JSON.parse(event.body || "{}");
    if (!complaint_id || !["new","in_progress","resolved","rejected"].includes(status)) {
      return { statusCode: 400, body: "Invalid payload" };
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/complaints?id=eq.${encodeURIComponent(complaint_id)}`, {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      },
      body: JSON.stringify({ status })
    });
    const out = await res.json();
    if (!res.ok) return { statusCode: res.status, body: JSON.stringify(out) };

    return { statusCode: 200, body: JSON.stringify({ ok:true, complaint: out[0] }) };
  } catch (e) {
    return { statusCode: 500, body: e.message || "Server error" };
  }
};
