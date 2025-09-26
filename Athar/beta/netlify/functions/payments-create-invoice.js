// netlify/functions/payments-create-invoice.js
// إنشاء فاتورة ميسّر (LIVE) وتمرير metadata لتفعيل العضوية عبر الـ Webhook

const fetch = require("node-fetch");
const { requireUser } = require("./_auth.js");
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

// أسعار الخطط بالريال
const PRICE_SAR = {
  weekly:     12.99,
  monthly:    29.99,
  semiannual: 169.99,
  annual:     339.99
};

// عدد الأيام لكل خطة
const PERIOD_DAYS = {
  weekly: 7,
  monthly: 30,
  semiannual: 180,
  annual: 365
};

// خصم ترويجي (اختياري)
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

    // 1) تحقق المستخدم (JWT)
    const gate = await requireUser(event);
    if (!gate.ok) return { statusCode: gate.status, headers: CORS, body: gate.error };

    // 2) مدخلات
    let payload = {};
    try { payload = JSON.parse(event.body || "{}"); } catch {}
    const plan  = String(payload.plan || "monthly").toLowerCase();
    const promo = (payload.promo || "").trim();

    if (!PRICE_SAR[plan]) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Plan not supported" }) };
    }

    // 3) السعر النهائي (هللات)
    const base = PRICE_SAR[plan];
    const percent = await resolvePromoPercent(promo);
    const discounted = Math.max(0, base * (1 - percent / 100));
    const amountHalala = Math.round(discounted * 100);

    // 4) إعدادات ميسّر
    const MOYASAR_SECRET = process.env.MOYASAR_SK;
    if (!MOYASAR_SECRET) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Missing Moyasar secret" }) };
    }

    // 5) إنشاء الفاتورة لدى ميسّر
    // ملاحظة: بعض إصدارات الـ API تستخدم return_url وأخرى redirect_url،
    // فنرسل الحقلين لضمان التوافق.
    const callbackUrl = "https://n-athar.co/.netlify/functions/payments-webhook";  // ← Webhook
    const returnUrl   = "https://n-athar.co/pricing.html?paid=1";                 // ← رجوع للمستخدم

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
        metadata: {
          email: (gate.user?.email || "").toLowerCase(),
          user_sub: gate.user?.sub || "",
          plan: plan,
          period_days: PERIOD_DAYS[plan],
          promo_code: percent ? promo.toUpperCase() : null,
          price_sar: base,
          price_after_discount_sar: discounted
        },
        callback_url: callbackUrl,   // 👈 مهم للويبهوك
        return_url:   returnUrl,     // بعض الوثائق
        redirect_url: returnUrl      // وبعضها يستخدم هذا الاسم
      })
    });

    const out = await msRes.json().catch(()=> ({}));
    if (!msRes.ok || !out?.url) {
      await supabase.from("payments_log").insert([{
        gateway: "moyasar",
        event_type: "create_invoice_failed",
        status: String(msRes.status),
        raw: out
      }]);
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: "Moyasar create invoice failed" }) };
    }

    // 6) نحفظ intent + رابط الفاتورة
    await supabase.from("payment_intents").insert([{
      user_id: gate.user?.sub || null,
      email: (gate.user?.email || "").toLowerCase(),
      plan,
      promo: percent ? promo.toUpperCase() : null,
      amount_sar: discounted,
      gateway: "moyasar",
      invoice_id: out.id || null,
      invoice_url: out.url || null,
      status: "created"
    }]);

    // 7) نعيد رابط الدفع
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
