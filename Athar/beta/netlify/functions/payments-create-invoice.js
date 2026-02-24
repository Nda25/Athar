// /.netlify/functions/payments-create-invoice.js
// إنشاء فاتورة عبر Moyasar وتمرير metadata لربط العضوية في الـ Webhook

const { createClient } = require("@supabase/supabase-js");
const { requireUser } = require("./_auth.js");
const { CORS, preflight } = require("./_cors.js");
const { createPerf } = require("./_perf.js");

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

const PAYMENT_UPSTREAM_TIMEOUT_MS = Math.max(
  1000,
  Number(process.env.PAYMENT_UPSTREAM_TIMEOUT_MS || 8000)
);

function shouldUseMockPayments() {
  return process.env.MOCK_PAYMENTS === "1";
}

function canFallbackToMock() {
  if (process.env.MOCK_PAYMENTS === "1") return true;
  if (process.env.ALLOW_PAYMENT_MOCK_FALLBACK === "0") return false;
  const nodeEnv = String(process.env.NODE_ENV || "development").toLowerCase();
  const context = String(process.env.CONTEXT || "dev").toLowerCase();
  return nodeEnv !== "production" && context !== "production";
}

function buildMockInvoiceUrl(plan, promo) {
  const query = new URLSearchParams({
    paid: "1",
    mock_paid: "1",
    plan: String(plan || "monthly"),
  });
  if (promo) query.set("promo", String(promo).toUpperCase());
  return `/pricing?${query.toString()}`;
}

function sanitizeBaseUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/\/+$/, "");
}

function resolveBaseUrl(event) {
  const configured =
    sanitizeBaseUrl(process.env.PUBLIC_BASE_URL) ||
    sanitizeBaseUrl(process.env.SITE_BASE_URL) ||
    sanitizeBaseUrl(process.env.URL) ||
    sanitizeBaseUrl(process.env.DEPLOY_PRIME_URL);

  if (configured) return configured;

  const host = event.headers.host || "n-athar.co";
  return `https://${host}`;
}

function collectMoyasarSecrets() {
  const raw = [
    process.env.MOYASAR_SK,
    process.env.MOYASAR_SECRET_KEY,
    process.env.MOYASAR_API_SECRET,
    process.env.MOYASAR_API_KEY,
  ];

  return [...new Set(
    raw
      .map((value) => String(value || "").trim().replace(/^['\"]|['\"]$/g, ""))
      .filter(Boolean)
      .filter((value) => value.startsWith("sk_"))
  )];
}

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

  const perf = createPerf("payments-create-invoice", event);

  try {
    if (event.httpMethod !== "POST") {
      perf.end({ statusCode: 405 });
      return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
    }

    // 1) تحقق المستخدم (JWT)
    const gate = await requireUser(event);
    perf.mark("auth_done");
    const userObj = gate?.user || gate;
    const isOk = gate?.ok !== false;
    if (!isOk || !userObj) {
      perf.end({ statusCode: gate?.status || 401, unauthorized: true });
      return { statusCode: gate?.status || 401, headers: CORS, body: JSON.stringify({ error: gate?.error || "Unauthorized" }) };
    }

    // === قراءة الـ payload مبكرًا ===
    let payload = {};
    try { payload = JSON.parse(event.body || "{}"); } catch {}

    const user_sub = userObj.sub || userObj.user?.sub || null;

    // === التقاط الإيميل من أكثر من مكان ===
    let email = (
      userObj.email ||
      userObj.user?.email ||
      userObj["https://n-athar.co/email"] ||
      userObj["https://athar.co/email"] ||
      ""
    );
    email = (email || "").toLowerCase();

    // من الـ JWT إذا موجود
    if (!email) {
      const a = event.headers.authorization || event.headers.Authorization || "";
      const jwt  = a.startsWith("Bearer ") ? a.slice(7) : "";
      try {
        const p = JSON.parse(Buffer.from((jwt.split(".")[1] || ""), "base64url").toString("utf8"));
        email = (p.email || p["https://n-athar.co/email"] || p["https://athar.co/email"] || "").toLowerCase();
      } catch {}
    }

    // من الـ payload القادم من الواجهة (fallback أخير)
    if (!email && payload?.email) {
      email = String(payload.email).toLowerCase();
    }

    if (!user_sub && !email) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
    }

    // 2) مدخلات الواجهة (نستخدم payload المقروء أعلاه)
    const planRaw = payload.plan;
    const plan    = normalizePlan(planRaw);
    const promo   = (payload.promo || "").trim();

    if (!PRICE_SAR[plan]) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Plan not supported" }) };
    }

    // 3) السعر النهائي (بالهللات)
    const baseSar     = PRICE_SAR[plan];
    const percent     = await resolvePromoPercent(promo);
    perf.mark("promo_done");
    const discounted  = Math.max(0, baseSar * (1 - percent / 100));
    const amountCents = Math.round(discounted * 100); // هللات

    // شرط Moyasar: الحد الأدنى 100 هللة (1.00 SAR)
    if (amountCents < 100) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Minimum amount is 1.00 SAR" }) };
    }

    // 4) مفاتيح/روابط
    const moyasarSecrets = collectMoyasarSecrets();
    if (moyasarSecrets.length === 0) {
      if (shouldUseMockPayments()) {
        const mockUrl = buildMockInvoiceUrl(plan, promo);
        perf.end({ statusCode: 200, mock: true, reason: "missing_secret" });
        return {
          statusCode: 200,
          headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ url: mockUrl, mock: true }),
        };
      }

      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({
          error: "Missing Moyasar secret",
          details:
            "Set MOYASAR_SK (or MOYASAR_SECRET_KEY) to a valid Moyasar secret key that starts with sk_"
        })
      };
    }

    const BASE = resolveBaseUrl(event);

    const callbackUrl = `${BASE}/.netlify/functions/payments-webhook`; // Webhook
    const returnUrl   = `${BASE}/pricing?paid=1`;                      // الرجوع للمستخدم بعد الدفع

    // 5) إنشاء الفاتورة لدى Moyasar
    const invoicePayload = {
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
      return_url: returnUrl,
      redirect_url: returnUrl
    };

    let msRes = null;
    let text = "";
    let out = {};
    let upstreamAttempts = 0;

    for (const secret of moyasarSecrets) {
      upstreamAttempts += 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PAYMENT_UPSTREAM_TIMEOUT_MS);
      try {
        msRes = await fetch("https://api.moyasar.com/v1/invoices", {
          method: "POST",
          headers: {
            Authorization: "Basic " + Buffer.from(secret + ":").toString("base64"),
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify(invoicePayload),
          signal: controller.signal,
        });

        text = await msRes.text();
        out = {};
        try { out = JSON.parse(text); } catch {}
      } catch (error) {
        msRes = { ok: false, status: 504 };
        out = {};
        text = `Moyasar request timeout after ${PAYMENT_UPSTREAM_TIMEOUT_MS}ms`;
        console.warn("payments-create-invoice upstream timeout:", error?.message || error);
      } finally {
        clearTimeout(timer);
      }

      if (msRes.status !== 401) {
        break;
      }
    }
    perf.mark("moyasar_done");

    if (!msRes.ok || !out?.url) {
      const upstreamMessage =
        (out && typeof out === "object" && (out.message || out.error_description || out.error)) ||
        null;
      const invalidAuth = msRes.status === 401;

      if (invalidAuth && canFallbackToMock()) {
        const mockUrl = buildMockInvoiceUrl(plan, promo);
        console.warn("payments-create-invoice: falling back to mock due to invalid Moyasar credentials");
        perf.end({ statusCode: 200, mock: true, reason: "invalid_credentials" });
        return {
          statusCode: 200,
          headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({
            url: mockUrl,
            mock: true,
            warning: "Moyasar credentials invalid; used mock payment flow",
          }),
        };
      }

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
        statusCode: invalidAuth ? 500 : 502,
        headers: CORS,
        body: JSON.stringify({
          error: invalidAuth
            ? "Invalid Moyasar credentials"
            : "Moyasar create invoice failed",
          details: upstreamMessage || text,
          provider_status: msRes.status
        })
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
    perf.mark("intent_done");

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
    perf.mark("log_done");

    // 7) نعيد رابط الدفع للمستخدم
    perf.end({ statusCode: 200, upstream_attempts: upstreamAttempts });
    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ url: out.url })
    };

  } catch (e) {
    console.error("payments-create-invoice error:", e);
    perf.end({ statusCode: 500, unhandled: true });
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Server error" }) };
  }
};
