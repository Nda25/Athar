// GET /.netlify/functions/complaints-list?status=new|in_progress|resolved|rejected&type=complaint|suggestion&q=...&limit=20&offset=0
const { requireAdmin } = require("./_auth");

exports.handler = async (event) => {
  const gate = await requireAdmin(event);
  if (!gate.ok) return { statusCode: gate.status, headers:{'Content-Type':'text/plain; charset=utf-8'}, body: gate.error };

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE } = process.env;
  const params = new URLSearchParams(event.queryStringParameters || {});
  const status = params.get("status");
  const type   = params.get("type");
  const q      = params.get("q");
  const limit  = Math.min(parseInt(params.get("limit") || "20", 10), 100);
  const offset = parseInt(params.get("offset") || "0", 10);

  try {
    const base = `${SUPABASE_URL}/rest/v1/complaints`;
    const search = new URLSearchParams({ select: "*", order: "created_at.desc", limit: String(limit), offset: String(offset) });

    if (status) search.append("status", `eq.${status}`);
    if (type)   search.append("type",   `eq.${type}`);
    if (q)      search.append("or", `(subject.ilike.*${q}*,message.ilike.*${q}*,user_email.ilike.*${q}*)`);

    const res = await fetch(`${base}?${search.toString()}`, {
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE}`,
        "Content-Type": "application/json",
        "Prefer": "count=exact"
      }
    });

    if (!res.ok){
      const txt = await res.text().catch(()=> '');
      return { statusCode: 500, headers:{'Content-Type':'text/plain; charset=utf-8'}, body: txt || "Supabase REST error" };
    }

    const rows = await res.json();
    return { statusCode: 200, headers:{'Content-Type':'application/json; charset=utf-8'}, body: JSON.stringify({ ok:true, rows }) };
  } catch (e) {
    return { statusCode: 500, headers:{'Content-Type':'text/plain; charset=utf-8'}, body: e.message || "Server error" };
  }
};
