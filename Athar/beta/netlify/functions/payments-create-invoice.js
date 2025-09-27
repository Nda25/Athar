// /.netlify/functions/payments-create-invoice.js
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
// الأسعار بالريال السعودي (SAR)
const PRICE_SAR = {
  weekly: 12.99,
  monthly: 29.99,
  semi: 169.99,     // نصف سنوي
  annual: 339.99
};

// مدة كل خطة بالأيام
const PERIOD_DAYS = {
  weekly: 7,
  monthly: 30,
  semi: 180,
  annual: 365
};

// تطبيع اسم الخطة الواردة من الواجهة
function normalizePlan(input) {
  const p = String(input || "monthly").toLowerCase().trim();
  if (["semiannual", "semi-annual", "halfyear", "half-year"].includes(p)) return "semi";
  return ["weekly","monthly","semi","annual"].includes(p) ? p : "monthly";
}

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
  // CORS preflight
  const pf = preflight(event);
  if (pf) return pf;

  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
    }

    // 1) تحقق المستخدم (JWT)
    const gate = await requireUser(event);
    const userObj = gate?.user || gate;
    const isOk = gate?.ok !== false;
    if (!isOk || !userObj) {
      return { statusCode: gate?.status || 401, headers: CORS, body: JSON.stringify({ error: gate?.error || "Unauthorized" }) };
    }
console.log("=== DEBUG userObj ===");
console.log(JSON.stringify(userObj, null, 2));
    const auth = event.headers.authorization || event.headers.Authorization || "";
console.log("=== DEBUG rawAuthHeader ===", auth);

if (auth.startsWith("Bearer ")) {
  const jwt = auth.slice(7);
  try {
    const payload = JSON.parse(
      Buffer.from((jwt.split(".")[1] || ""), "base64url").toString("utf8")
    );
    console.log("=== DEBUG decoded JWT payload ===", payload);
  } catch (err) {
    console.error("Failed to decode JWT:", err);
  }
}
const user_sub = userObj.sub || userObj.user?.sub || null;

// 1) جرّبي كل الحقول المعتادة + النيم سبيس
let email = (
  userObj.email ||
  userObj.user?.email ||
  userObj["https://n-athar.co/email"] ||
  userObj["https://athar.co/email"] ||
  ""
);
email = (email || "").toLowerCase();

// 2) لو ما لقيناه، فكّي الـ JWT من الهيدر وخذي الإيميل منه
if (!email) {
  const auth = event.headers.authorization || event.headers.Authorization || "";
  const jwt  = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  try {
    const payload = JSON.parse(
      Buffer.from((jwt.split(".")[1] || ""), "base64url").toString("utf8")
    );
    email = (
      payload.email ||
      payload["https://n-athar.co/email"] ||
      payload["https://athar.co/email"] ||
      ""
    ).toLowerCase();
  } catch {}
}

// 3) آخر حل: اسحبيه من جدول users حسب الـ sub
if (!email && user_sub) {
  const { data } = await supabase
    .from("users")
    .select("email")
    .eq("auth0_sub", user_sub)
    .maybeSingle();
  if (data?.email) email = String(data.email).toLowerCase();
}
    if (!user_sub && !email) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
    }

    // 2) مدخلات الواجهة
    let payload = {};
    try { payload = JSON.parse(event.body || "{}"); } catch {}
    const planRaw = payload.plan;
    const plan    = normalizePlan(planRaw);
    const promo   = (payload.promo || "").trim();

    if (!PRICE_SAR[plan]) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Plan not supported" }) };
    }

    // 3) السعر النهائي (بالهللات)
    const baseSar     = PRICE_SAR[plan];
    const percent     = await resolvePromoPercent(promo);
    const discounted  = Math.max(0, baseSar * (1 - percent / 100));
    const amountCents = Math.round(discounted * 100); // هللات

    // شرط Moyasar: الحد الأدنى 100 هللة (1.00 SAR)
    if (amountCents < 100) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Minimum amount is 1.00 SAR" }) };
    }

    // 4) مفاتيح/روابط
    const MOYASAR_SECRET = process.env.MOYASAR_SK;
    if (!MOYASAR_SECRET) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Missing Moyasar secret" }) };
    }

    const BASE =
      process.env.PUBLIC_BASE_URL ||
      process.env.SITE_BASE_URL ||
      `https://${event.headers.host || "n-athar.co"}`;

    const callbackUrl = `${BASE}/.netlify/functions/payments-webhook`; // Webhook
    const returnUrl   = `${BASE}/pricing.html?paid=1`;                 // الرجوع للمستخدم بعد الدفع

    // 5) إنشاء الفاتورة لدى Moyasar
    const msRes = await fetch("https://api.moyasar.com/v1/invoices", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(MOYASAR_SECRET + ":").toString("base64"),
        "Content-Type": "application/json",
        Accept: "application/json"
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
          // (اختياري) بيانات إضافية مفيدة للتتبّع
          price_sar: baseSar,
          price_after_discount_sar: discounted,
          promo_code: percent ? promo.toUpperCase() : null
        },
        callback_url: callbackUrl,
        return_url:   returnUrl,
        redirect_url: returnUrl
      })
    });

    // نقرأ النص أولاً لسهولة التشخيص
    const text = await msRes.text();
    let out = {};
    try { out = JSON.parse(text); } catch {}

    if (!msRes.ok || !out?.url) {
      // لوج فشل الإنشاء
      const { error: logErr1 } = await supabase.from("payments_log").insert([{
        gateway: "moyasar",
        provider_event_id: out?.id || null,
        event_type: "create_invoice_failed",
        object: "invoice",
        status: String(msRes.status),
        amount: discounted,
        currency: "SAR",
        email,
        user_sub,
        raw: text || null
      }]);
      if (logErr1) console.warn("payments_log insert (fail) error:", logErr1.message);

      return {
        statusCode: 502,
        headers: CORS,
        body: JSON.stringify({ error: "Moyasar create invoice failed", details: text })
      };
    }

    // 6) تسجيل intent + رابط الفاتورة
    const { error: piErr } = await supabase.from("payment_intents").insert([{
      user_sub,
      email,
      plan,
      price_cents: amountCents,
      currency: "SAR",
      status: "awaiting_payment",
      invoice_id: out.id || null,
      note: percent ? `promo:${promo.toUpperCase()}(-${percent}%)` : null
    }]);
    if (piErr) console.warn("payment_intents insert warn:", piErr.message);

    // لوج نجاح الإنشاء
    const { error: logErr2 } = await supabase.from("payments_log").insert([{
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
    if (logErr2) console.warn("payments_log insert (success) warn:", logErr2.message);

    // 7) نعيد رابط الدفع للمستخدم
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
