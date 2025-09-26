// netlify/functions/payment-webhook.js
// Moyasar Webhook (LIVE) — handles paid/refunded/canceled/expired
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

// ===== Utilities =====
function readHeader(event, k){
  return event.headers[k] || event.headers[k?.toLowerCase?.()] || "";
}
function safeJson(str){ try{ return JSON.parse(str||"{}"); }catch{ return {}; } }

// Read secret sent from Moyasar Webhook settings
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

// Normalize payload fields across invoice/payment objects
function parseMoyasarEvent(body){
  // Supports both { type, id, status, object, metadata } and { data:{...} }
  const root = body?.data ? body.data : body || {};
  return {
    provider_event_id: body?.id || root?.id || null,          // event id if present
    object:             (root?.object  || body?.object  || "").toLowerCase(),  // 'invoice' | 'payment'
    type:               (body?.type    || body?.event   || "").toLowerCase(),  // PAYMENT_PAID, etc
    status:             (root?.status  || body?.status  || "").toLowerCase(),  // paid, refunded, canceled, expired...
    amount:             root?.amount || null,
    currency:           root?.currency || null,
    metadata:           root?.metadata || body?.metadata || {},
  };
}

// ----- Membership helpers -----
async function upsertMembership(meta, status){
  // meta is expected to carry: email, user_sub, plan, period_days
  const email   = (meta?.email || "").toLowerCase();
  const user_id = meta?.user_sub || null;
  const plan    = meta?.plan || "monthly";
  const days    = Number(meta?.period_days || 30);

  if (!email && !user_id) return;

  const now   = new Date();
  const start = now.toISOString();
  const end   = new Date(now.getTime() + days*24*60*60*1000).toISOString();

  // decide conflict target (you MUST have a UNIQUE index on one of them)
  const conflictTarget = user_id ? "user_id" : "email";

  const row = {
    user_id: user_id || null,
    email,
    plan,
    start_at: start,
    end_at:   end,
    status:   status   // 'active' | 'refunded' | 'canceled' | 'expired'
  };

  const { error } = await supabase
    .from("memberships")
    .upsert([row], { onConflict: conflictTarget });
  if (error) console.error("memberships upsert error:", error);
}

async function setMembershipEnded(meta, reason){
  // mark membership ended *now* (refunded/canceled/expired)
  const email   = (meta?.email || "").toLowerCase();
  const user_id = meta?.user_sub || null;
  if (!email && !user_id) return;

  const match = user_id ? { user_id } : { email };
  const { error } = await supabase
    .from("memberships")
    .update({ status: reason, end_at: new Date().toISOString() })
    .match(match);
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

  // 2) Normalize the event
  const evt = parseMoyasarEvent(bodyObj);

  // 3) Idempotency: skip if we’ve seen this provider_event_id before
  // require UNIQUE(provider_event_id) on payments_log (see SQL below)
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

  // 4) Map event/status to actions
  const t = evt.type;      // e.g. "payment_paid"
  const s = evt.status;    // e.g. "paid"
  const meta = evt.metadata || {};

  try{
    // Paid
    if (t === "payment_paid" || s === "paid"){
      await upsertMembership(meta, "active");
    }
    // Refunded
    else if (t === "payment_refunded" || s === "refunded"){
      await setMembershipEnded(meta, "refunded");
    }
    // Canceled
    else if (t === "payment_canceled" || s === "canceled"){
      await setMembershipEnded(meta, "canceled");
    }
    // Expired
    else if (t === "payment_expired" || s === "expired"){
      await setMembershipEnded(meta, "expired");
    }
    // Other events: log-only (authorized/failed/…)
  }catch(e){
    console.error("membership action error:", e);
  }

  // 5) Log the event (with dedupe key)
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
      raw: bodyObj
    }]);
  }catch(e){
    // If conflict due to unique, ignore
    console.warn("payments_log insert warn:", e?.message || e);
  }

  return { statusCode: 200, body: JSON.stringify({ ok:true }) };
};
