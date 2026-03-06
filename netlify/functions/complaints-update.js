// /netlify/functions/complaints-update.js
// POST /.netlify/functions/complaints-update
// body: { complaint_id, status }  // status in: new|in_progress|resolved|rejected
// Admin only

const { requireAdmin } = require("./_auth");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

exports.handler = async (event) => {
  // تحقّق الصلاحيات + الميثود
  const gate = await requireAdmin(event);
  if (!gate.ok) return { statusCode: gate.status, body: gate.error };
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { complaint_id, status } = JSON.parse(event.body || "{}");
    const ALLOWED = ["new", "in_progress", "resolved", "rejected"];

    if (!complaint_id || !ALLOWED.includes(status)) {
      return { statusCode: 400, body: "Invalid payload" };
    }

    // التحديث
    const { data, error } = await supabase
      .from("complaints")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", complaint_id)
      .select()
      .single();

    if (error) return { statusCode: 400, body: error.message };

    return { statusCode: 200, body: JSON.stringify({ ok: true, complaint: data }) };
  } catch (e) {
    return { statusCode: 500, body: e.message || "Server error" };
  }
};
