// /.netlify/functions/invoices-list.js
// إرجاع فواتير المستخدم الحالي (محمي)

const { createClient } = require("@supabase/supabase-js");
const { requireUser } = require("./_auth.js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "GET")     return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  const gate = await requireUser(event);
  if (!gate.ok) return { statusCode: gate.status, headers: CORS, body: gate.error };

  const email = (gate.user?.email || "").toLowerCase();
  const sub   = gate.user?.sub || null;
  if (!email && !sub) return { statusCode: 400, headers: CORS, body: "No user identity" };

  try {
    const { data, error } = await supabase
      .from("payments_log")
      .select("created_at,gateway,event_type,object,status,amount,currency,provider_event_id,invoice_id,invoice_url,email,user_sub,amount_sar")
      .or(`email.eq.${email},user_sub.eq.${sub}`)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return { statusCode: 500, headers: CORS, body: error.message };
    return { statusCode: 200, headers: { ...CORS, "Content-Type":"application/json; charset=utf-8" }, body: JSON.stringify({ ok:true, rows: data||[] }) };
  } catch (e) {
    return { statusCode: 500, headers: CORS, body: e.message || "Server error" };
  }
