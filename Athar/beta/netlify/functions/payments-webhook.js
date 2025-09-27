// /.netlify/functions/payments-webhook.js
// Moyasar Webhook (LIVE) — يدير حالات paid/refunded/canceled/expired ويحدّث العضوية ويحتفظ بـ invoice_url

const { createClient } = require("@supabase/supabase-js");
const { CORS, preflight } = require("./_cors.js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE}` } }
  }
);

const MOYASAR_SECRET = process.env.MOYASAR_SK;

// ---------- Utils ----------
function readHeader(event, k) {
  const h = event.headers || {};
  return h[k] || h[k?.toLowerCase?.()] || "";
}

function safeJson(str) {
  try { return JSON.parse(str || "{}"); } catch { return {}; }
}

function getWebhookToken(event, bodyObj) {
  return (
    readHeader(event, "x-moyasar-token") ||
    readHeader(event, "x-webhook-token") ||
    readHeader(event, "x-secret-token") ||
    (bodyObj && (bodyObj.token || bodyObj.secret)) ||
    (event.queryStringParameters || {}).token ||
    ""
  );
}

function parseMoyasarEvent(body) {
  const root = body?.data ? body.data : body || {};
  return {
    provider_event_id: body?.id || root?.id || null,
    object: (root?.object || body?.object || "").toLowerCase(),
    type:   (body?.type   || body?.event  || "").toLowerCase(),
    status: (root?.status || body?.status || "").toLowerCase(),
    amount: root?.amount ?? null,
    currency: root?.currency ?? null,
    metadata: root?.metadata || body?.metadata || {},
    invoice_id: root?.invoice_id || root?.id || null,
    invoice_url: root?.url || null
  };
}

async function fetchInvoiceUrl(invoiceId) {
  if (!invoiceId || !MOYASAR_SECRET) return null;
  try {
    const res = await fetch(`https://api.moyasar.com/v1/invoices/${invoiceId}`, {
      headers: {
        "Authorization": "Basic " + Buffer.from(MOYASAR_SECRET + ":").toString("base64")
      }
    });
    const data = await res.json().catch(() => ({}));
    return (res.ok && data?.url) ? data.url : null;
  } catch {
    return null;
  }
}

// ---------- Membership helpers ----------
async function getExistingMembership(user_sub, email) {
  let q = supabase
    .from("memberships")
    .select("id, plan, status, expires_at, end_at, email, user_sub")
    .limit(1);

  if (user_sub) q = q.eq("user_sub", user_sub);
  else if (email) q = q.eq("email", email.toLowerCase());

  const { data, error } = await q.maybeSingle();
  if (error) {
    console.warn("getExistingMembership error:", error.message);
    return null;
  }
  return data || null;
}

async function upsertMembershipActive(meta) {
  const email    = (meta?.email || "").toLowerCase();
  const user_sub = meta?.user_sub || null;
  const plan     = meta?.plan || "monthly";
  const days     = Math.max(1, Number(meta?.period_days || 30));

  if (!email && !user_sub) return;

  const existing = await getExistingMembership(user_sub, email);
  const now = new Date();

  let baseStart = now;
  if (existing) {
    const exp = existing.expires_at || existing.end_at;
    if (exp) {
      const expD = new Date(exp);
      if (!isNaN(+expD) && expD > now) baseStart = expD;
    }
  }

  const newExpires = new Date(baseStart.getTime() + days * 24 * 60 * 60 * 1000);

  const row = {
    user_sub: user_sub || null,
    email,
    plan,
    status: "active",
    start_at: now.toISOString(),
    end_at: null,
    expires_at: newExpires.toISOString(),
    updated_at: now.toISOString(),
    activated_at: now.toISOString()
  };

  if (existing?.id) {
    const { error } = await supabase
      .from("memberships")
      .update(row)
      .eq("id", existing.id);
    if (error) console.error("memberships update error:", error.message);
  } else {
    const { error } = await supabase
      .from("memberships")
      .insert([row]);
    if (error) console.error("memberships insert error:", error.message);
  }
}

async function setMembershipStatus(meta, reason) {
  const email    = (meta?.email || "").toLowerCase();
  const user_sub = meta?.user_sub || null;
  if (!email && !user_sub) return;

  const match = user_sub ? { user_sub } : { email };
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("memberships")
    .update({ status: reason, updated_at: now })
    .match(match);
  if (error) console.error("memberships status update error:", error.message);
}

// ---------- Handler ----------
exports.handler = async (event) => {
  const pf = preflight(event);
  if (pf) return pf;

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
  }

  const raw = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf8")
    : (event.body || "");
  const bodyObj = safeJson(raw);

  const incoming = getWebhookToken(event, bodyObj);
  if (!incoming || incoming !== process.env.MOYASAR_WEBHOOK_TOKEN) {
    return { statusCode: 401, headers: CORS, body: "Invalid token" };
  }

  const evt = parseMoyasarEvent(bodyObj);
  const t = evt.type;
  const s = evt.status;
  const meta = evt.metadata || {};

  try {
    if (t === "payment_paid" || s === "paid") {
      await upsertMembershipActive(meta);
    } else if (t === "payment_refunded" || s === "refunded") {
      await setMembershipStatus(meta, "refunded");
    } else if (t === "payment_canceled" || s === "canceled") {
      await setMembershipStatus(meta, "canceled");
    } else if (t === "payment_expired" || s === "expired") {
      await setMembershipStatus(meta, "expired");
    }
  } catch (e) {
    console.error("membership action error:", e);
  }

  let invoice_url = evt.invoice_url || null;
  const invoice_id = evt.invoice_id || null;
  if (!invoice_url && invoice_id) {
    invoice_url = await fetchInvoiceUrl(invoice_id);
  }

  const { error: logError } = await supabase
    .from("payments_log")
    .upsert([{
      gateway: "moyasar",
      provider_event_id: evt.provider_event_id || null,
      event_type: evt.type || null,
      object: evt.object || null,
      status: evt.status || null,
      amount: evt.amount,
      currency: evt.currency || "SAR",
      email: (meta?.email || null)?.toLowerCase?.() || null,
      user_sub: meta?.user_sub || null,
      invoice_id: invoice_id || null,
      invoice_url: invoice_url || null,
      raw: bodyObj
    }], { onConflict: "provider_event_id" });

  if (logError) console.warn("payments_log upsert error:", logError.message);

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
};
