// Receive Moyasar webhook (invoice/payment paid) — LIVE
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

// مرونة في قراءة التوكن (بعض البوابات ترسله Header/Body/Query)
function getToken(event, body) {
  const h = (k)=> (event.headers[k] || event.headers[k.toLowerCase()] || "");
  return (
    h("x-moyasar-token") ||
    h("x-webhook-token") ||
    h("x-secret-token") ||
    (body && (body.token || body.secret)) ||
    (event.queryStringParameters || {}).token ||
    ""
  );
}

async function activateMembership(meta) {
  // meta: { email, user_sub, plan, period_days }
  const email = (meta?.email || "").toLowerCase();
  const user  = meta?.user_sub || null;
  const days  = Number(meta?.period_days || 30);

  if (!email && !user) return;

  const start = new Date();
  const end   = new Date();
  end.setDate(end.getDate() + days);

  // حدّث/أنشئ عضوية في جدول memberships لديك
  await supabase
    .from("memberships")
    .upsert([{
      user_id: user,
      email,
      plan: meta?.plan || "monthly",
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      status: "active"
    }], { onConflict: "email" });
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { body = {}; }

  // تحقّق التوكن
  const okToken = getToken(event, body) === process.env.MOYASAR_WEBHOOK_TOKEN;
  if (!okToken) return { statusCode: 401, body: "Invalid token" };

  try {
    // نحاول معرفة إن كان الحدث مدفوع
    // احتمالات: payload انفويس أو دفع
    let meta = body?.data?.metadata || body?.metadata || {};
    const status = (body?.data?.status || body?.status || "").toLowerCase();
    const object = (body?.data?.object || body?.object || "").toLowerCase();
    const eventType = (body?.type || body?.event || "").toLowerCase();

    const paid =
      status === "paid" ||
      eventType.includes("paid") ||
      (object === "invoice" && ["paid","partially_paid"].includes(status)) ||
      (object === "payment" && status === "paid");

    if (paid) {
      await activateMembership(meta);
    }

    // خزن الحدث اختياريًا للرجوع
    await supabase.from("payments_log").insert([{
      gateway: "moyasar",
      event_type: eventType || null,
      object: object || null,
      status: status || null,
      raw: body
    }]);

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error("webhook error", e);
    return { statusCode: 500, body: "Webhook error" };
  }
};
