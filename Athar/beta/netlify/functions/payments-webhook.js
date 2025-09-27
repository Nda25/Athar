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

// --- استبدل الدالة كاملة بهذا الشكل ---
function parseMoyasarEvent(body) {
  // ميسّر أحيانًا يرسل root تحت data وأحيانًا مباشرة
  const root = body?.data ? body.data : body || {};

  // بعض الحسابات ترسل event مثل: "payment.paid" أو "invoice_paid"
  const typeRaw =
    body?.type ||
    body?.event ||
    root?.type ||
    root?.event ||
    "";

  // نطبّع الشكل: payment.paid -> payment_paid
  const normType = String(typeRaw).toLowerCase().replace(/\./g, "_");

  // الحالة إمّا تجي صريحة أو نستنتجها من الـ type
  let status =
    (root?.status || body?.status || "").toLowerCase();
  if (!status) {
    if (/_paid$/.test(normType)) status = "paid";
    else if (/_refunded$/.test(normType)) status = "refunded";
    else if (/_canceled$/.test(normType)) status = "canceled";
    else if (/_expired$/.test(normType)) status = "expired";
  }

  // مسارات محتملة للميتابيانات داخل root/payment
  const metadata =
    root?.metadata ||
    root?.payment?.metadata ||
    body?.metadata ||
    {};

  // في الإشعارات، id قد يكون في body.id أو data.id؛
  // أما invoice_id فقد يكون root.id إذا كان object=invoice
  const provider_event_id = body?.id || root?.id || null;
  const invoice_id = root?.invoice_id || root?.id || null;
  const invoice_url = root?.url || root?.invoice_url || null;

  // object نفسه قد يكون "payment" أو "invoice"
  const object =
    (root?.object || body?.object || "").toLowerCase() ||
    (normType.includes("payment") ? "payment" :
     normType.includes("invoice") ? "invoice" : "");

  return {
    provider_event_id,
    object,
    type: normType,          // مثال: payment_paid
    status,                  // مثال: paid
    amount: root?.amount ?? null,       // غالبًا بالهللات
    currency: root?.currency ?? null,
    metadata,
    invoice_id,
    invoice_url
  };
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
  // نحاول نضمن وجود email / user_sub قدر الإمكان
  let meta = evt.metadata || {};
  if (!meta.email && bodyObj?.data?.payment?.metadata?.email) {
    meta.email = bodyObj.data.payment.metadata.email;
  }
  if (!meta.user_sub && bodyObj?.data?.payment?.metadata?.user_sub) {
    meta.user_sub = bodyObj.data.payment.metadata.user_sub;
  }

  try {
    const isPaid      = (s === "paid")      || /(^|_)paid$/.test(t);
    const isRefunded  = (s === "refunded")  || /(^|_)refunded$/.test(t);
    const isCanceled  = (s === "canceled")  || /(^|_)canceled$/.test(t);
    const isExpired   = (s === "expired")   || /(^|_)expired$/.test(t);

    if (isPaid) {
      await upsertMembershipActive(meta);
    } else if (isRefunded) {
      await setMembershipStatus(meta, "refunded");
    } else if (isCanceled) {
      await setMembershipStatus(meta, "canceled");
    } else if (isExpired) {
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
