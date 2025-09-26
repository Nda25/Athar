// netlify/functions/payments-create-invoice.js
// إنشاء فاتورة ميسّر (LIVE) وتمرير metadata لتفعيل العضوية عبر الـ Webhook

const fetch = require("node-fetch");
const { requireUser } = require("./_auth.js");            // نفس الدالة التي تستعملينها لحماية الدوال
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

// أسعار الخطط بالـ ر.س (LIVE) — عدّليها إن لزم
const PRICE_SAR = {
  weekly:       12.99,
  monthly:      29.99,
  semiannual:  169.99,
  annual:      339.99
};

// عدد الأيام لكل خطة
const PERIOD_DAYS = {
  weekly: 7,
  monthly: 30,
  semiannual: 180,
  annual: 365
};

// التحقق من كود ترويجي (اختياري)
// الجدول المقترح: promos(code text pk, percent int, active bool, expires_at timestamptz)
// يعيد نسبة الخصم [0..100]
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
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: CORS, body: "" };
    }
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
    }

    // 1) تحقق المستخدم (Auth0)
    const gate = await requireUser(event); // تُعيد { ok, user:{sub,email,...} }
    if (!gate.ok) return { statusCode: gate.status, headers: CORS, body: gate.error };

    // 2) اقرأ المدخلات
    let payload = {};
    try { payload = JSON.parse(event.body || "{}"); } catch {}
    const plan  = String(payload.plan || "monthly").toLowerCase();
    const promo = (payload.promo || "").trim();

    if (!PRICE_SAR[plan]) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Plan not supported" }) };
    }

    // 3) احسب السعر والخصم
    const base = PRICE_SAR[plan];
    const percent = await resolvePromoPercent(promo);
    const discounted = Math.max(0, base * (1 - percent / 100));
    // ميسّر تستقبل هللات
    const amountHalala = Math.round(discounted * 100);

    // 4) إعدادات ميسّر
const MOYASAR_SECRET = process.env.MOYASAR_SK;
    if (!MOYASAR_SECRET) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Missing Moyasar secret" }) };
    }

    // 5) نفّذي إنشاء الفاتورة
    // المرجع: https://moyasar.com/docs/api/#create-an-invoice
    const msRes = await fetch("https://api.moyasar.com/v1/invoices", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(MOYASAR_SECRET + ":").toString("base64"),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: amountHalala,
        currency: "SAR",
        description: `Athar subscription: ${plan}${percent ? ` (promo -${percent}%)` : ""}`,
        // مهم: metadata سيصل كما هو إلى الـ Webhook
        metadata: {
          email: (gate.user?.email || "").toLowerCase(),
          user_sub: gate.user?.sub || "",
          plan: plan,
          period_days: PERIOD_DAYS[plan],
          promo_code: percent ? promo.toUpperCase() : null,
          price_sar: base,
          price_after_discount_sar: discounted
        },
        // (اختياري) رابط الرجوع بعد الدفع
        // redirect_url: "https://n-athar.co/pricing.html?paid=1"
      })
    });

    const out = await msRes.json().catch(()=> ({}));
    if (!msRes.ok || !out?.url) {
      // سجّل الخطأ للاستدلال لاحقًا
      await supabase.from("payments_log").insert([{
        gateway: "moyasar",
        event_type: "create_invoice_failed",
        status: String(msRes.status),
        raw: out
      }]);
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: "Moyasar create invoice failed" }) };
    }

    // (اختياري) خزّني intent
    await supabase.from("payment_intents").insert([{
      user_id: gate.user?.sub || null,
      email: (gate.user?.email || "").toLowerCase(),
      plan,
      promo: percent ? promo.toUpperCase() : null,
      amount_sar: discounted,
      gateway: "moyasar",
      invoice_id: out.id || null,
      status: "created"
    }]);

    // 6) ارجعي رابط الدفع
    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ url: out.url })
    };

  } catch (e) {
    console.error("create-invoice error:", e);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Server error" }) };
  }
};
