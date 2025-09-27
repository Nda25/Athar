// netlify/functions/payments-create-invoice.js
// إنشاء فاتورة عبر Moyasar وتمرير metadata لربط العضوية في الـ Webhook

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

// ===== إعدادات الخطط =====
const PRICE_SAR = {
  weekly: 0.9,
  monthly: 29.99,
  semi: 169.99,
  annual: 339.99
};

const PERIOD_DAYS = {
  weekly: 7,
  monthly: 30,
  semi: 180,
  annual: 365
};

function normalizePlan(input) {
  const p = String(input || "monthly").toLowerCase().trim();
  if (p === "semiannual" || p === "semi-annual" || p === "halfyear" || p === "half-year") return "semi";
  return ["weekly","monthly","semi","annual"].includes(p) ? p : "monthly";
}

// ===== خصم ترويجي =====
async function resolvePromoPercent(code) {
  if (!code) return 0;
  try {
    const { data, error } = await supabase
      .from("promos")
      .select("percent, active, expires_at")
      .eq("code", code.trim().toUpperCase())
      .maybeSingle();
    if (error || !data) return 0;
    if (data.active === false) return 0;
    if (data.expires_at && new Date(data.expires_at) < new Date()) return 0;
    const p = Number(data.percent || 0);
    return (p > 0 && p <= 100) ? p : 0;
  } catch {
    return 0;
  }
}

exports.handler = async (event) => {
  const pf = preflight(event);
  if (pf) return pf;

  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
    }

    // تحقق المستخدم
    const gate = await requireUser(event);
    const userObj = gate?.user || gate;
    const isOk = gate?.ok !== false;
    if (!isOk || !userObj) {
      return { statusCode: gate?.status || 401, headers: CORS, body: JSON.stringify({ error: gate?.error || "Unauthorized" }) };
    }

    const user_sub = userObj.sub || userObj.user?.sub || null;
    const email = (userObj.email || userObj.user?.email || "").toLowerCase();

    if (!user_sub && !email) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
    }

    // مدخلات
    let payload = {};
    try { payload = JSON.parse(event.body || "{}"); } catch {}
    const planRaw = payload.plan;
    const plan    = normalizePlan(planRaw);
    const promo   = (payload.promo || "").trim();

    if (!PRICE_SAR[plan]) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Plan not supported" }) };
    }

    // السعر
    const baseSar     = PRICE_SAR[plan];
    const percent     = await resolvePromoPercent(promo);
    const discounted  = Math.max(0, baseSar * (1 - percent / 100));
    const amountCents = Math.round(discounted * 100);

    // مفاتيح
    const MOYASAR_SECRET = process.env.MOYASAR_SK;
    if (!MOYASAR_SECRET) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Missing Moyasar secret" }) };
    }

    const BASE = process.env.PUBLIC_BASE_URL || process.env.SITE_BASE_URL || `https://${event.headers.host || "n-athar.co"}`;
    const callbackUrl = `${BASE}/.netlify/functions/payments-webhook`;
    const returnUrl   = `${BASE}/pricing.html?paid=1`;

    // إنشاء فاتورة
    const msRes = await fetch("https://api.moyasar.com/v1/invoices", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(MOYASAR_SECRET + ":").toString("base64"),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: amountCents,
        currency: "SAR",
        description: `Athar subscription: ${plan}${percent ? ` (promo -${percent}%)` : ""}`,
        metadata: {
          email,
          user_sub,
          plan,
          period_days: PERIOD_DAYS[plan],
          promo_code: percent ? promo.toUpperCase() : null,
          price_sar: baseSar,
          price_after_discount_sar: discounted
        },
        callback_url: callbackUrl,
        return_url:   returnUrl,
        redirect_url: returnUrl
      })
    });

    const out = await msRes.json().catch(() => ({}));

    if (!msRes.ok || !out?.url) {
      await supabase.from("payments_log").insert([{
        gateway: "moyasar",
        provider_event_id: out?.id || null,
        event_type: "create_invoice_failed",
        object: "invoice",
        status: String(msRes.status),
        amount: discounted,
        currency: "SAR",
        email,
        user_sub,
        raw: out || null
      }]);
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: "Moyasar create invoice failed" }) };
    }

    // intent
    const { error: intentError } = await supabase.from("payment_intents").insert([{
      user_sub,
      email,
      plan,
      price_cents: amountCents,
      currency: "SAR",
      status: "awaiting_payment",
      invoice_id: out.id || null,
      note: percent ? `promo:${promo.toUpperCase()}(-${percent}%)` : null
    }]);
    if (intentError) console.error("payment_intents insert error:", intentError.message);

    // log
    const { error: logError } = await supabase.from("payments_log").insert([{
      gateway: "moyasar",
      provider_event_id: out.id || null,
      event_type: "invoice_created",
      object: "invoice",
      status: out.status || "created",
      amount: discounted,
      currency: "SAR",
      email,
      user_sub,
      raw: out || null,
      invoice_id: out.id || null,
      invoice_url: out.url || null,
      amount_sar: discounted
    }]);
    if (logError) console.error("payments_log insert error:", logError.message);

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ url: out.url })
    };

  } catch (e) {
    console.error("payments-create-invoice error:", e);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Server error" }) };
  }
};
