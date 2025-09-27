// /.netlify/functions/payments-webhook.js
// Moyasar Webhook (LIVE) — يدير حالات paid/refunded/canceled/expired ويحدّث العضوية ويحتفظ بـ invoice_url

const { createClient } = require("@supabase/supabase-js");
const { CORS, preflight } = require("./_cors.js");

// --- Supabase (باستخدام Service Role) ---
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE}` } }
  }
);

// مفتاح سرّي للوصول إلى API ميسّر (لاستعلام الفاتورة عند الحاجة)
const MOYASAR_SECRET = process.env.MOYASAR_SK;

// ---------- Utils ----------
function readHeader(event, k) {
  const h = event.headers || {};
  // بعض منصات السيرفر تحفظ المفاتيح بحروف صغيرة
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

function parseMoyasarEvent(body) {
  // صيغ مختلفة للـ webhook؛ نطبّعها هنا
  const root = body?.data ? body.data : body || {};
  return {
    provider_event_id: body?.id || root?.id || null,
    object: (root?.object || body?.object || "").toLowerCase(), // 'invoice' | 'payment'
    type:   (body?.type   || body?.event  || "").toLowerCase(), // payment_paid ...
    status: (root?.status || body?.status || "").toLowerCase(), // paid / refunded / canceled / expired
    amount: root?.amount ?? null,          // عادة بالهللات
    currency: root?.currency ?? null,
    metadata: root?.metadata || body?.metadata || {},
    invoice_id: root?.invoice_id || root?.id || null, // مع invoice: id نفسه
    invoice_url: root?.url || null
  };
}

// استعلام الفاتورة من ميسّر للحصول على url الحالي (عند الحاجة)
async function fetchInvoiceUrl(invoiceId) {
  if (!invoiceId || !MOYASAR_SECRET) return null;
  try {
    const res = await fetch(`https://api.moyasar.com/v1/invoices/${invoiceId}`, {
      headers: {
        "Authorization": "Basic " + Buffer.from(MOYASAR_SECRET + ":").toString("base64")
      }
    });
    const data = await res.json().catch(() => ({}));
    return (res.ok && data?.url) ? data.url : null;
  } catch {
    return null;
  }
}

// ---------- Membership helpers ----------
// نجلب العضوية الحالية (إن وجدت) للمستخدم عبر user_sub أو email
async function getExistingMembership(user_sub, email) {
  const q = supabase
    .from("memberships")
    .select("id, plan, status, expires_at, end_at, email, user_sub")
    .limit(1);

  if (user_sub) q.eq("user_sub", user_sub);
  else if (email) q.eq("email", email.toLowerCase());

  const { data, error } = await q.maybeSingle();
  if (error) {
    console.warn("getExistingMembership error:", error.message);
    return null;
  }
  return data || null;
}

// عند الدفع: نفعّل أو نمدّد الاشتراك
async function upsertMembershipActive(meta) {
  const email    = (meta?.email || "").toLowerCase();
  const user_sub = meta?.user_sub || null;
  const plan     = meta?.plan || "monthly";
  const days     = Math.max(1, Number(meta?.period_days || 30));

  if (!email && !user_sub) return;

  // من أين يبدأ التمديد؟ لو كان عنده اشتراك ساري نمدّد من تاريخ الانتهاء الحالي
  const existing = await getExistingMembership(user_sub, email);
  const now = new Date();

  let baseStart = now; // لو مافيه صلاحية سارية
  if (existing) {
    const exp = existing.expires_at || existing.end_at;
    if (exp) {
      const expD = new Date(exp);
      if (!isNaN(+expD) && expD > now) {
        baseStart = expD; // تمديد من نهاية الصلاحية الحالية
      }
    }
  }

  const newExpires = new Date(baseStart.getTime() + days * 24 * 60 * 60 * 1000);

  // upsert حسب user_sub أو email (حسب المتوفر عندك قيد UNIQUE في الجدول)
  const row = {
    user_sub: user_sub || null,
    email,
    plan,
    status: "active",
    start_at: now.toISOString(),
    end_at: null, // نتركه null ونستخدم expires_at كمصدر الحقيقة
    expires_at: newExpires.toISOString(),
    updated_at: now.toISOString(),
    activated_at: now.toISOString()
  };

  // عندك UNIQUE(email) و UNIQUE(user_id) في الجدول، ولكن الحقل المستخدم عندنا user_sub/email
  // سنستخدم upsert بدون onConflict (Supabase سيحاول على المفتاح الفريد)، أو
  // نعمل upsert ذكي: إن وجد سجل نحدّث، وإلا ندرج.
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
  // CORS preflight
  const pf = preflight(event);
  if (pf) return pf;

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
  }

  // دعم محتوى base64 لو مفعّل
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf8")
    : (event.body || "");
  const bodyObj = safeJson(raw);

  // 1) التحقق من توكن الويبهوك
  const incoming = getWebhookToken(event, bodyObj);
  if (!incoming || incoming !== process.env.MOYASAR_WEBHOOK_TOKEN) {
    return { statusCode: 401, headers: CORS, body: "Invalid token" };
  }

  // 2) تطبيع الحدث
  const evt = parseMoyasarEvent(bodyObj);
  const t = evt.type;      // نوع الحدث (payment_paid, ...)
  const s = evt.status;    // الحالة (paid, refunded, ...)
  const meta = evt.metadata || {};

  // 3) تنفيذ الأثر على العضوية (بحسب الحالة)
  try {
    if (t === "payment_paid" || s === "paid") {
      await upsertMembershipActive(meta);
    } else if (t === "payment_refunded" || s === "refunded") {
      await setMembershipStatus(meta, "refunded");
    } else if (t === "payment_canceled" || s === "canceled") {
      await setMembershipStatus(meta, "canceled");
    } else if (t === "payment_expired" || s === "expired") {
      await setMembershipStatus(meta, "expired");
    }
  } catch (e) {
    console.error("membership action error:", e);
  }

  // 4) الحصول على invoice_url (لو غير موجود في الحدث)
  let invoice_url = evt.invoice_url || null;
  const invoice_id = evt.invoice_id || null;
  if (!invoice_url && invoice_id) {
    invoice_url = await fetchInvoiceUrl(invoice_id);
  }

  // 5) التسجيل في payments_log (upsert لمنع التكرار على provider_event_id)
  try {
    await supabase
      .from("payments_log")
      .upsert([{
        gateway: "moyasar",
        provider_event_id: evt.provider_event_id || null, // يفضّل يكون UNIQUE في الجدول
        event_type: evt.type || null,
        object: evt.object || null,
        status: evt.status || null,
        amount: evt.amount,          // (هللات غالباً)
        currency: evt.currency || "SAR",
        email: (meta?.email || null)?.toLowerCase?.() || null,
        user_sub: meta?.user_sub || null,
        invoice_id: invoice_id || null,
        invoice_url: invoice_url || null,
        raw: bodyObj
      }], { onConflict: "provider_event_id" }); // تأكدي من وجود UNIQUE(provider_event_id)
  } catch (e) {
    console.warn("payments_log upsert warn:", e?.message || e);
  }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
};
