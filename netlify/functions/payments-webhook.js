// /.netlify/functions/payments-webhook.js
// Unified Moyasar webhook handler:
// - validates token
// - updates memberships
// - writes payments_log
// - upserts invoices (used by invoices-list endpoints)

const { createClient } = require("@supabase/supabase-js");
const { CORS, preflight } = require("./_cors.js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  {
    auth: { persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE}` },
    },
  },
);

const MOYASAR_SECRET = process.env.MOYASAR_SK;

function readHeader(event, key) {
  const h = event.headers || {};
  return h[key] || h[key?.toLowerCase?.()] || "";
}

function safeJson(str) {
  try {
    return JSON.parse(str || "{}");
  } catch {
    return {};
  }
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
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

async function fetchInvoiceUrl(invoiceId) {
  if (!invoiceId || !MOYASAR_SECRET) return null;

  try {
    const res = await fetch(
      `https://api.moyasar.com/v1/invoices/${encodeURIComponent(invoiceId)}`,
      {
        headers: {
          Authorization:
            "Basic " + Buffer.from(`${MOYASAR_SECRET}:`).toString("base64"),
          Accept: "application/json",
        },
      },
    );

    if (!res.ok) return null;

    const payload = await res.json().catch(() => ({}));
    return payload?.url || payload?.invoice_url || null;
  } catch (err) {
    console.warn("fetchInvoiceUrl failed:", err?.message || err);
    return null;
  }
}

function parseMoyasarEvent(body) {
  // Common shapes:
  // 1) { type, data: { ...invoice/payment... } }
  // 2) { payment: { ... } }
  // 3) flat object
  const root = body?.data ? body.data : body || {};
  const entity = root?.payment || root?.invoice || root;

  const typeRaw =
    body?.type ||
    body?.event ||
    root?.type ||
    root?.event ||
    entity?.type ||
    entity?.event ||
    "";

  const type = String(typeRaw).toLowerCase().replace(/\./g, "_");

  let status = String(entity?.status || root?.status || body?.status || "")
    .toLowerCase()
    .trim();
  if (!status) {
    if (/(^|_)paid$/.test(type)) status = "paid";
    else if (/(^|_)refunded$/.test(type)) status = "refunded";
    else if (/(^|_)canceled$/.test(type)) status = "canceled";
    else if (/(^|_)expired$/.test(type)) status = "expired";
  }

  const metadata =
    entity?.metadata || root?.metadata || body?.metadata || {};

  const providerEventId = body?.id || root?.id || entity?.id || null;

  const invoiceId =
    entity?.invoice_id ||
    root?.invoice_id ||
    (String(entity?.object || "").toLowerCase() === "invoice" ? entity?.id : null) ||
    (String(root?.object || "").toLowerCase() === "invoice" ? root?.id : null) ||
    null;

  const invoiceUrl =
    entity?.url || entity?.invoice_url || root?.url || root?.invoice_url || null;

  const object =
    String(entity?.object || root?.object || body?.object || "").toLowerCase() ||
    (type.includes("payment") ? "payment" : type.includes("invoice") ? "invoice" : "");

  return {
    provider_event_id: providerEventId,
    object,
    type,
    status,
    amount: entity?.amount ?? root?.amount ?? null,
    currency: entity?.currency ?? root?.currency ?? null,
    metadata,
    invoice_id: invoiceId,
    invoice_url: invoiceUrl,
  };
}

async function getExistingMembership(userSub, email) {
  const emailLc = normalizeEmail(email);
  let q = supabase
    .from("memberships")
    .select("id, plan, status, expires_at, end_at, email, user_sub, user_id")
    .limit(1);

  if (userSub && emailLc) {
    q = q.or(`user_sub.eq.${userSub},user_id.eq.${userSub},email.eq.${emailLc}`);
  } else if (userSub) {
    q = q.or(`user_sub.eq.${userSub},user_id.eq.${userSub}`);
  } else if (emailLc) {
    q = q.eq("email", emailLc);
  }

  const { data, error } = await q.maybeSingle();
  if (error) {
    console.warn("getExistingMembership error:", error.message);
    return null;
  }
  return data || null;
}

async function upsertMembershipActive(meta) {
  const email = normalizeEmail(meta?.email);
  const userSub = meta?.user_sub || null;

  // memberships.plan allows: free|paid|promo|trial|manual
  const planRaw = String(meta?.plan || "monthly").toLowerCase().trim();
  const plan = ["weekly", "monthly", "semi", "annual"].includes(planRaw)
    ? "paid"
    : planRaw || "paid";

  const days = Math.max(1, Number(meta?.period_days || 30));
  if (!email && !userSub) return;

  const existing = await getExistingMembership(userSub, email);
  const now = new Date();

  let baseStart = now;
  if (existing) {
    const exp = existing.expires_at || existing.end_at;
    if (exp) {
      const expDate = new Date(exp);
      if (!Number.isNaN(+expDate) && expDate > now) baseStart = expDate;
    }
  }

  const newExpires = new Date(baseStart.getTime() + days * 24 * 60 * 60 * 1000);

  const row = {
    user_sub: userSub || null,
    user_id: userSub || null,
    email,
    plan,
    status: "active",
    start_at: now.toISOString(),
    end_at: null,
    expires_at: newExpires.toISOString(),
    updated_at: now.toISOString(),
    activated_at: now.toISOString(),
  };

  if (existing?.id) {
    const { error } = await supabase
      .from("memberships")
      .update(row)
      .eq("id", existing.id);
    if (error) console.error("memberships update error:", error.message);
  } else {
    const { error } = await supabase.from("memberships").insert([row]);
    if (error) console.error("memberships insert error:", error.message);
  }
}

async function setMembershipStatus(meta, reason) {
  const email = normalizeEmail(meta?.email);
  const userSub = meta?.user_sub || null;
  if (!email && !userSub) return;

  const nowIso = new Date().toISOString();

  let q = supabase
    .from("memberships")
    .update({ status: reason, updated_at: nowIso });

  if (userSub && email) {
    q = q.or(`user_sub.eq.${userSub},user_id.eq.${userSub},email.eq.${email}`);
  } else if (userSub) {
    q = q.or(`user_sub.eq.${userSub},user_id.eq.${userSub}`);
  } else {
    q = q.eq("email", email);
  }

  const { error } = await q;
  if (error) console.error("memberships status update error:", error.message);
}

async function upsertInvoiceRow(evt, email, userSub, invoiceId) {
  const invoiceKey = invoiceId || evt.provider_event_id || null;
  if (!invoiceKey) return;

  const amountMinor =
    evt.amount == null || !Number.isFinite(Number(evt.amount))
      ? null
      : Number(evt.amount);

  const currency = String(evt.currency || "SAR").toUpperCase();
  const amountSar = amountMinor == null || currency !== "SAR" ? null : amountMinor / 100;

  const { error } = await supabase.from("invoices").upsert(
    [
      {
        email: email || null,
        user_sub: userSub || null,
        invoice_id: invoiceKey,
        provider_event_id: evt.provider_event_id || null,
        status: evt.status || null,
        amount: amountMinor,
        amount_sar: amountSar,
        currency,
        gateway: "moyasar",
        created_at: new Date().toISOString(),
      },
    ],
    { onConflict: "invoice_id" },
  );

  if (error) {
    console.warn("invoices upsert error:", error.message, { invoice_id: invoiceKey });
  }
}

exports.handler = async (event) => {
  const pf = preflight(event);
  if (pf) return pf;

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
  }

  const raw = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf8")
    : event.body || "";

  const bodyObj = safeJson(raw);
  const incoming = getWebhookToken(event, bodyObj);

  if (!incoming || incoming !== process.env.MOYASAR_WEBHOOK_TOKEN) {
    return { statusCode: 401, headers: CORS, body: "Invalid token" };
  }

  const evt = parseMoyasarEvent(bodyObj);
  const t = evt.type;
  const s = evt.status;

  let meta = evt.metadata || {};
  if (!meta.email && bodyObj?.data?.payment?.metadata?.email) {
    meta.email = bodyObj.data.payment.metadata.email;
  }
  if (!meta.email && bodyObj?.payment?.metadata?.email) {
    meta.email = bodyObj.payment.metadata.email;
  }
  if (!meta.user_sub && bodyObj?.data?.payment?.metadata?.user_sub) {
    meta.user_sub = bodyObj.data.payment.metadata.user_sub;
  }
  if (!meta.user_sub && bodyObj?.payment?.metadata?.user_sub) {
    meta.user_sub = bodyObj.payment.metadata.user_sub;
  }

  try {
    const isPaid = s === "paid" || /(^|_)paid$/.test(t);
    const isRefunded = s === "refunded" || /(^|_)refunded$/.test(t);
    const isCanceled = s === "canceled" || /(^|_)canceled$/.test(t);
    const isExpired = s === "expired" || /(^|_)expired$/.test(t);

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

  const metaEmail = normalizeEmail(meta?.email);
  const metaUserSub = meta?.user_sub || null;

  let invoiceUrl = evt.invoice_url || null;
  const invoiceId = evt.invoice_id || null;
  if (!invoiceUrl && invoiceId) {
    invoiceUrl = await fetchInvoiceUrl(invoiceId);
  }

  await upsertInvoiceRow(evt, metaEmail, metaUserSub, invoiceId);

  const { error: logError } = await supabase.from("payments_log").upsert(
    [
      {
        gateway: "moyasar",
        provider_event_id: evt.provider_event_id || null,
        event_type: evt.type || null,
        object: evt.object || null,
        status: evt.status || null,
        amount: evt.amount,
        currency: evt.currency || "SAR",
        email: metaEmail || null,
        user_sub: metaUserSub || null,
        invoice_id: invoiceId || null,
        invoice_url: invoiceUrl || null,
        raw: bodyObj,
      },
    ],
    { onConflict: "provider_event_id" },
  );

  if (logError) console.warn("payments_log upsert error:", logError.message);

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
};
