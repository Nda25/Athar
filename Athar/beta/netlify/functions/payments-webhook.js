// /.netlify/functions/payment-webhook.js
// Moyasar Webhook (LIVE) — handles paid/refunded/canceled/expired + يحفظ invoice_url

const fetch = require("node-fetch");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

const MOYASAR_SECRET = process.env.MOYASAR_SK; // لازم تكون موجودة

function readHeader(event, k){ return event.headers[k] || event.headers[k?.toLowerCase?.()] || ""; }
function safeJson(str){ try{ return JSON.parse(str||"{}"); }catch{ return {}; } }

function getWebhookToken(event, bodyObj){
  return (
    readHeader(event,"x-moyasar-token") ||
    readHeader(event,"x-webhook-token") ||
    readHeader(event,"x-secret-token") ||
    (bodyObj && (bodyObj.token || bodyObj.secret)) ||
    (event.queryStringParameters || {}).token ||
    ""
  );
}

function parseMoyasarEvent(body){
  const root = body?.data ? body.data : body || {};
  return {
    provider_event_id: body?.id || root?.id || null,
    object:             (root?.object  || body?.object  || "").toLowerCase(),   // 'invoice' | 'payment'
    type:               (body?.type    || body?.event   || "").toLowerCase(),   // payment_paid ...
    status:             (root?.status  || body?.status  || "").toLowerCase(),   // paid, refunded, ...
    amount:             root?.amount || null,
    currency:           root?.currency || null,
    metadata:           root?.metadata || body?.metadata || {},
    invoice_id:         root?.invoice_id || root?.id || null, // لو كان object=invoice => id هو نفسه
    invoice_url:        root?.url || null
  };
}

// استعلام عن الفاتورة من ميسّر للحصول على url الحالي (صفحة الإيصال/الفاتورة)
async function fetchInvoiceUrl(invoiceId){
  if (!invoiceId || !MOYASAR_SECRET) return null;
  try{
    const res = await fetch(`https://api.moyasar.com/v1/invoices/${invoiceId}`, {
      headers: { "Authorization": "Basic " + Buffer.from(MOYASAR_SECRET + ":").toString("base64") }
    });
    const data = await res.json().catch(()=> ({}));
    if (res.ok && data?.url) return data.url;
    return null;
  }catch{ return null; }
}

// ----- Membership helpers -----
async function upsertMembership(meta, status){
  const email   = (meta?.email || "").toLowerCase();
  const user_id = meta?.user_sub || null;
  const plan    = meta?.plan || "monthly";
  const days    = Number(meta?.period_days || 30);
  if (!email && !user_id) return;

  const now = new Date();
  const row = {
    user_id: user_id || null,
    email,
    plan,
    start_at: now.toISOString(),
    end_at:   new Date(now.getTime() + days*24*60*60*1000).toISOString(),
    status
  };

  const conflictTarget = user_id ? "user_id" : "email";
  const { error } = await supabase.from("memberships").upsert([row], { onConflict: conflictTarget });
  if (error) console.error("memberships upsert error:", error);
}

async function setMembershipEnded(meta, reason){
  const email   = (meta?.email || "").toLowerCase();
  const user_id = meta?.user_sub || null;
  if (!email && !user_id) return;
  const match = user_id ? { user_id } : { email };
  const { error } = await supabase.from("memberships").update({ status: reason, end_at: new Date().toISOString() }).match(match);
  if (error) console.error("memberships update error:", error);
}

// ===== Handler =====
exports.handler = async (event) => {
  if (event.httpMethod !== "POST"){
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const bodyObj = safeJson(event.body);

  // 1) Verify webhook token
  const incoming = getWebhookToken(event, bodyObj);
  if (!incoming || incoming !== process.env.MOYASAR_WEBHOOK_TOKEN){
    return { statusCode: 401, body: "Invalid token" };
  }

  // 2) Normalize
  const evt = parseMoyasarEvent(bodyObj);

  // 3) Dedup
  if (evt.provider_event_id){
    const { data: seen } = await supabase
      .from("payments_log")
      .select("id")
      .eq("provider_event_id", evt.provider_event_id)
      .limit(1)
      .maybeSingle();
    if (seen){
      return { statusCode: 200, body: JSON.stringify({ ok:true, dedup:true }) };
    }
  }

  // 4) Actions
  const t = evt.type;      // e.g. payment_paid
  const s = evt.status;    // e.g. paid
  const meta = evt.metadata || {};

  try{
    if (t === "payment_paid" || s === "paid"){
      await upsertMembership(meta, "active");
    } else if (t === "payment_refunded" || s === "refunded"){
      await setMembershipEnded(meta, "refunded");
    } else if (t === "payment_canceled" || s === "canceled"){
      await setMembershipEnded(meta, "canceled");
    } else if (t === "payment_expired" || s === "expired"){
      await setMembershipEnded(meta, "expired");
    }
  }catch(e){ console.error("membership action error:", e); }

  // 5) حاول نحصل/نثبت invoice_url
  let invoice_url = evt.invoice_url || null;
  const invoice_id = evt.invoice_id || null;
  if (!invoice_url && invoice_id) {
    invoice_url = await fetchInvoiceUrl(invoice_id);
  }

  // 6) Log
  try{
    await supabase.from("payments_log").insert([{
      gateway: "moyasar",
      provider_event_id: evt.provider_event_id,
      event_type: evt.type || null,
      object: evt.object || null,
      status: evt.status || null,
      amount: evt.amount,
      currency: evt.currency,
      email: (evt.metadata?.email || null)?.toLowerCase?.() || null,
      user_sub: evt.metadata?.user_sub || null,
      invoice_id: invoice_id || null,
      invoice_url: invoice_url || null,   // 👈 مهم
      raw: bodyObj
    }]);
  }catch(e){
    console.warn("payments_log insert warn:", e?.message || e);
  }

  return { statusCode: 200, body: JSON.stringify({ ok:true }) };
};// /.netlify/functions/payment-webhook.js
// Moyasar Webhook (LIVE) — handles paid/refunded/canceled/expired + يحفظ invoice_url

const fetch = require("node-fetch");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

const MOYASAR_SECRET = process.env.MOYASAR_SK; // لازم تكون موجودة

function readHeader(event, k){ return event.headers[k] || event.headers[k?.toLowerCase?.()] || ""; }
function safeJson(str){ try{ return JSON.parse(str||"{}"); }catch{ return {}; } }

function getWebhookToken(event, bodyObj){
  return (
    readHeader(event,"x-moyasar-token") ||
    readHeader(event,"x-webhook-token") ||
    readHeader(event,"x-secret-token") ||
    (bodyObj && (bodyObj.token || bodyObj.secret)) ||
    (event.queryStringParameters || {}).token ||
    ""
  );
}

function parseMoyasarEvent(body){
  const root = body?.data ? body.data : body || {};
  return {
    provider_event_id: body?.id || root?.id || null,
    object:             (root?.object  || body?.object  || "").toLowerCase(),   // 'invoice' | 'payment'
    type:               (body?.type    || body?.event   || "").toLowerCase(),   // payment_paid ...
    status:             (root?.status  || body?.status  || "").toLowerCase(),   // paid, refunded, ...
    amount:             root?.amount || null,
    currency:           root?.currency || null,
    metadata:           root?.metadata || body?.metadata || {},
    invoice_id:         root?.invoice_id || root?.id || null, // لو كان object=invoice => id هو نفسه
    invoice_url:        root?.url || null
  };
}

// استعلام عن الفاتورة من ميسّر للحصول على url الحالي (صفحة الإيصال/الفاتورة)
async function fetchInvoiceUrl(invoiceId){
  if (!invoiceId || !MOYASAR_SECRET) return null;
  try{
    const res = await fetch(`https://api.moyasar.com/v1/invoices/${invoiceId}`, {
      headers: { "Authorization": "Basic " + Buffer.from(MOYASAR_SECRET + ":").toString("base64") }
    });
    const data = await res.json().catch(()=> ({}));
    if (res.ok && data?.url) return data.url;
    return null;
  }catch{ return null; }
}

// ----- Membership helpers -----
async function upsertMembership(meta, status){
  const email   = (meta?.email || "").toLowerCase();
  const user_id = meta?.user_sub || null;
  const plan    = meta?.plan || "monthly";
  const days    = Number(meta?.period_days || 30);
  if (!email && !user_id) return;

  const now = new Date();
  const row = {
    user_id: user_id || null,
    email,
    plan,
    start_at: now.toISOString(),
    end_at:   new Date(now.getTime() + days*24*60*60*1000).toISOString(),
    status
  };

  const conflictTarget = user_id ? "user_id" : "email";
  const { error } = await supabase.from("memberships").upsert([row], { onConflict: conflictTarget });
  if (error) console.error("memberships upsert error:", error);
}

async function setMembershipEnded(meta, reason){
  const email   = (meta?.email || "").toLowerCase();
  const user_id = meta?.user_sub || null;
  if (!email && !user_id) return;
  const match = user_id ? { user_id } : { email };
  const { error } = await supabase.from("memberships").update({ status: reason, end_at: new Date().toISOString() }).match(match);
  if (error) console.error("memberships update error:", error);
}

// ===== Handler =====
exports.handler = async (event) => {
  if (event.httpMethod !== "POST"){
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const bodyObj = safeJson(event.body);

  // 1) Verify webhook token
  const incoming = getWebhookToken(event, bodyObj);
  if (!incoming || incoming !== process.env.MOYASAR_WEBHOOK_TOKEN){
    return { statusCode: 401, body: "Invalid token" };
  }

  // 2) Normalize
  const evt = parseMoyasarEvent(bodyObj);

  // 3) Dedup
  if (evt.provider_event_id){
    const { data: seen } = await supabase
      .from("payments_log")
      .select("id")
      .eq("provider_event_id", evt.provider_event_id)
      .limit(1)
      .maybeSingle();
    if (seen){
      return { statusCode: 200, body: JSON.stringify({ ok:true, dedup:true }) };
    }
  }

  // 4) Actions
  const t = evt.type;      // e.g. payment_paid
  const s = evt.status;    // e.g. paid
  const meta = evt.metadata || {};

  try{
    if (t === "payment_paid" || s === "paid"){
      await upsertMembership(meta, "active");
    } else if (t === "payment_refunded" || s === "refunded"){
      await setMembershipEnded(meta, "refunded");
    } else if (t === "payment_canceled" || s === "canceled"){
      await setMembershipEnded(meta, "canceled");
    } else if (t === "payment_expired" || s === "expired"){
      await setMembershipEnded(meta, "expired");
    }
  }catch(e){ console.error("membership action error:", e); }

  // 5) حاول نحصل/نثبت invoice_url
  let invoice_url = evt.invoice_url || null;
  const invoice_id = evt.invoice_id || null;
  if (!invoice_url && invoice_id) {
    invoice_url = await fetchInvoiceUrl(invoice_id);
  }

  // 6) Log
  try{
    await supabase.from("payments_log").insert([{
      gateway: "moyasar",
      provider_event_id: evt.provider_event_id,
      event_type: evt.type || null,
      object: evt.object || null,
      status: evt.status || null,
      amount: evt.amount,
      currency: evt.currency,
      email: (evt.metadata?.email || null)?.toLowerCase?.() || null,
      user_sub: evt.metadata?.user_sub || null,
      invoice_id: invoice_id || null,
      invoice_url: invoice_url || null,   // 👈 مهم
      raw: bodyObj
    }]);
  }catch(e){
    console.warn("payments_log insert warn:", e?.message || e);
  }

  return { statusCode: 200, body: JSON.stringify({ ok:true }) };
};
