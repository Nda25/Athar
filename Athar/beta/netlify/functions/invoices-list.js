// /.netlify/functions/invoices-list.js
// إرجاع فواتير/حركات الدفع للمستخدم الحالي (محمي)

const { createClient } = require("@supabase/supabase-js");
const { requireUser } = require("./_auth.js");
const { CORS, preflight } = require("./_cors.js");

// ===== Supabase (Service Role) =====
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE}` } }
  }
);

exports.handler = async (event) => {
  // CORS preflight
  const pf = preflight(event);
  if (pf) return pf;

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
  }

  // تحقق المستخدم (JWT)
  const gate = await requireUser(event);
  const userObj = gate?.user || gate;
  const isOk = gate?.ok !== false;
  if (!isOk || !userObj) {
    return {
      statusCode: gate?.status || 401,
      headers: CORS,
      body: JSON.stringify({ error: gate?.error || "Unauthorized" })
    };
  }

  const email = (userObj.email || userObj.user?.email || "").toLowerCase();
  const sub   = userObj.sub || userObj.user?.sub || null;

  if (!email && !sub) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "No user identity" }) };
  }

  try {
    let q = supabase
.from("invoices")
.select("created_at,amount,amount_sar,currency,status,gateway,invoice_id,provider_event_id,email,user_sub")
      .order("created_at", { ascending: false })
      .limit(50);

    // فلترة بحسب الهوية المتوفرة
    if (email && sub) {
      // ملاحظة: Supabase .or تعمل كنص — نبقيها بسيطة بالقيم المباشرة
      q = q.or(`email.eq.${email},user_sub.eq.${sub}`);
    } else if (email) {
      q = q.eq("email", email);
    } else if (sub) {
      q = q.eq("user_sub", sub);
    }

    const { data, error } = await q;
    if (error) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) };
    }

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: true, rows: data || [] })
    };
  } catch (e) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: e.message || "Server error" }) };
  }
};
