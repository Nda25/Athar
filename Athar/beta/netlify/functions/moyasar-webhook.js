// netlify/functions/moyasar-webhook.js (CJS)
const { createClient } = require("@supabase/supabase-js");

const supa = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE}` } }
  }
);

function checkSecret(headers) {
  const h = headers["shared-secret"] || headers["Shared-Secret"] || headers["SHARED-SECRET"];
  return h && h === process.env.WEBHOOK_SHARED_SECRET;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
    if (!checkSecret(event.headers || {})) return { statusCode: 401, body: "Unauthorized" };

    const body = JSON.parse(event.body || "{}");
    const p = body.payment || body || {};
    const status = (p.status || "").toLowerCase();
    const gateway = "moyasar";

    const email = (p.metadata?.email || p.email || p.customer?.email || "").toLowerCase() || null;
    const user_sub = p.metadata?.user_sub || null;

    const amount = Number(p.amount || 0);
    const currency = (p.currency || "SAR").toUpperCase();
    const amount_sar = currency === "SAR" ? amount / 100 : null;

    const provider_event_id = String(p.id || body.id || "");
    const created_at = p.created_at ? new Date(p.created_at).toISOString() : new Date().toISOString();

    const row = {
      email, user_sub, invoice_id: provider_event_id, provider_event_id,
      status, amount, amount_sar, currency, gateway, created_at,
    };

    const { error } = await supa.from("invoices").upsert(row, { onConflict: "invoice_id" });
    if (error) { console.error("invoices upsert:", error); return { statusCode: 500, body: "DB error" }; }

    return { statusCode: 200, body: "ok" };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: "server error" };
  }
};
