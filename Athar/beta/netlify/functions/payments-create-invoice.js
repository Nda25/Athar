// 5) إنشاء الفاتورة لدى Moyasar
const msRes = await fetch("https://api.moyasar.com/v1/invoices", {
  method: "POST",
  headers: {
    "Authorization": "Basic " + Buffer.from(MOYASAR_SECRET + ":").toString("base64"),
    "Content-Type": "application/json",
    "Accept": "application/json"
  },
  body: JSON.stringify({
    amount: amountCents,          // 1299 مثلاً
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

// خذي النص كما هو ثم حاولي تفكيكه JSON
const text = await msRes.text();
let out = {};
try { out = JSON.parse(text); } catch {}

if (!msRes.ok || !out?.url) {
  console.error("Moyasar create invoice failed:", msRes.status, text);

  // نسجل المحاولة الفاشلة مع الردّ الأصلي
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
    raw: text || null
  }]).catch(() => {});

  // أثناء التطوير، رجّعي السبب للمستخدم ليسهّل التشخيص
  return {
    statusCode: 502,
    headers: CORS,
    body: JSON.stringify({ error: "Moyasar create invoice failed", details: text })
  };
}
