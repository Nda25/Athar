// netlify/functions/murtakaz.js  (CommonJS) — نسخة كاملة v1 + حماية أساسية

const { GoogleGenerativeAI } = require("@google/generative-ai");

/* ========= إعدادات عامة ========= */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "https://n-athar.co,https://www.n-athar.co,https://athar.sa")
  .split(",").map(s => s.trim()).filter(Boolean);

// استخدمي pro-latest (أعلى جودة) أو flash-latest (أرخص وأسرع أثناء التجارب)
const MODEL_ID = process.env.GEMINI_MODEL_ID || "gemini-2.5-flash-flash-pro-latest";

// حدود أمان بسيطة
const MAX_BODY_BYTES = +(process.env.MAX_BODY_BYTES || 200 * 1024); // 200KB
const MAX_TEXT_CHARS = +(process.env.MAX_TEXT_CHARS || 1200);      // أقصى طول للنص للتحليل

/* ========= CORS ========= */
function corsHeaders(origin) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin"
  };
}

/* ========= المساعدات ========= */
function safeJson(str, fallback = null) {
  try { return JSON.parse(str || "null") ?? fallback; } catch { return fallback; }
}
const cut = (s, n) => (s || "").slice(0, n);

/* ========= الفنكشن ========= */
exports.handler = async (event) => {
  const origin = (event.headers?.origin || "").trim();
  const CORS = corsHeaders(origin);

  try {
    // Preflight
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: CORS, body: "" };
    }

    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
    }

    // تحقّق من الأصل (إن أردتِ رفض غير المسموحين صراحةً)
    if (ALLOWED_ORIGINS.length && origin && !ALLOWED_ORIGINS.includes(origin)) {
      return { statusCode: 403, headers: CORS, body: "Forbidden origin" };
    }

    // حجم الطلب
    const rawLen = Buffer.byteLength(event.body || "", "utf8");
    if (rawLen > MAX_BODY_BYTES) {
      return { statusCode: 413, headers: CORS, body: "Payload too large" };
    }

    // مفتاح الـ API
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers: CORS, body: "Missing GEMINI_API_KEY" };
    }

    // قراءة المدخلات
    const {
      mode,            // "topic" | "text"
      subject,         // المادة
      topic,           // الموضوع (اختياري في نمط text)
      sourceText,      // نص للتحليل (لنمط text)
      age,             // p1/p2/m/h أو نص
      duration,        // دقائق الحصة
      bloomMain,       // بلوم الأساسي
      bloomSupport,    // بلوم الداعم (اختياري)
      goalCount,       // عدد الأهداف
      notes,           // ملاحظات المعلم
      level,           // مستوى الصف
      adapt,           // Boolean
      variant          // لتنويع ناتج مختلف جذريًا
    } = safeJson(event.body, {}) || {};

    // تنظيف وقيود طول
    const S = {
      mode: (mode || "topic"),
      subject: cut(subject || "—", 100),
      topic: cut(topic || "—", 140),
      sourceText: cut(sourceText || "", MAX_TEXT_CHARS),
      age: (age || "p2"),
      duration: Math.max(15, Math.min(90, +duration || 45)),
      bloomMain: (bloomMain || "understand"),
      bloomSupport: (bloomSupport || ""),
      goalCount: Math.max(1, Math.min(5, +goalCount || 2)),
      notes: cut(notes || "", 240),
      level: (level || "mixed"),
      adapt: !!adapt,
      variant: String(variant || Date.now())
    };

    // تهيئة الموديل — لا نمرّر apiVersion (نترك SDK على v1)
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_ID });

    // قواميس صغيرة
    const AGE_LABEL = { p1: "ابتدائي دُنيا", p2: "ابتدائي عُليا", m: "متوسط", h: "ثانوي" };
    const dhow = (v) => (v == null ? "—" : String(v));
    const ageLabel = AGE_LABEL[S.age] || S.age || "—";

    // تقسيم زمن الحصة
    const pre = Math.min(10, Math.max(3, Math.round(S.duration * 0.20)));
    const during = Math.max(15, Math.round(S.duration * 0.55));
    const post = Math.max(5, Math.round(S.duration * 0.25));

    // برومبت صارم يخرج JSON فقط
    const prompt = `
أنت مخطط دروس ذكي لمدارس السعودية (مناهج 2025+) بالعربية الفصحى.
- أخرج JSON فقط لا غير.
- اجعل الأهداف/الأنشطة/التقويم منسوجة بأفعال بلوم الصحيحة لمستوى "${dhow(S.bloomMain)}" (+ "${dhow(S.bloomSupport)}" إن وُجد).
- اجعل الأنشطة واقعية لبيئة المدرسة السعودية، قابلة للتطبيق والقياس، ضمن ${S.duration} دقيقة.
- structure = قبل/أثناء/بعد بمؤشرات زمنية تقريبية (ضمن زمن الحصة).
- diff = [دعم، إثراء، مرونة العرض]. success = معيار نجاح قصير قابل للملاحظة.
- لو النمط "text": استخرج Topic مناسبًا من النص ووافق الأهداف معه.
- لو مُمرَّر "variant": نوّع جذريًا في العنوان والتنظيم والمنتج النهائي.

أعد JSON بهذه المفاتيح فقط:
{
  "meta": {
    "topic": "عنوان مختصر مبتكر ومحدد",
    "age": "${dhow(S.age)}",
    "ageLabel": "${ageLabel}",
    "mainBloomLabel": "${dhow(S.bloomMain)}",
    "supportBloomLabel": "${dhow(S.bloomSupport)}"
  },
  "goals": [ ${Array.from({length: S.goalCount}).map(()=>'"__"').join(", ")} ],
  "success": "__",
  "structure": ["قبل (تهيئة ${pre}د): __", "أثناء (${during}د): __", "بعد (${post}د): __"],
  "activities": ["تمهيد محسوس ملائم للعمر", "نشاط تعاوني رئيسي موجّه", "تطبيق فردي قصير", "منتج نهائي/عرض وجيز"],
  "assessment": ["س١ واضح مباشر مرتبط بالموضوع: __", "س٢ أعلى قليلاً في بلوم: __", "س٣ تذكرة خروج قابلة للقياس: __"],
  "diff": ["دعم: __", "إثراء: __", "مرونة العرض: __"],
  "oneMin": "نص الدقيقة الواحدة الملائم"
}

المعطيات:
- النمط: ${dhow(S.mode)} (topic/text)
- المادة: ${dhow(S.subject)}
- الموضوع: ${dhow(S.topic)}
- النص للتحليل: ${S.sourceText || "—"}
- ملاحظات المعلم: ${dhow(S.notes)}
- مستوى الصف: ${dhow(S.level)}
- تعلم تكيفي: ${S.adapt ? "نعم" : "لا"}
- Bloom: ${dhow(S.bloomMain)} / ${dhow(S.bloomSupport)}
- الزمن: ${S.duration} دقيقة
- variant: ${S.variant}

- أمثلة محلية سعودية. لغة عربية سليمة مختصرة. JSON فقط.
`.trim();

    // استدعاء Gemini
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    // التقاط الـ JSON حتى لو التفّ داخل أسطر
    const raw = String(result?.response?.text?.() || "").trim();
    const m = raw.match(/\{[\s\S]*\}$/m) || raw.match(/\{[\s\S]*\}/m);
    let payload;
    try { payload = JSON.parse(m ? m[0] : raw); }
    catch (e) {
      // نعيد 502 بدل 500 لأن الخطأ من مزود الذكاء (تنسيق خرج)
      return { statusCode: 502, headers: CORS, body: "Bad model output (non-JSON)" };
    }

    const sa = (a) => Array.isArray(a) ? a.filter(Boolean) : [];
    const body = {
      meta: payload.meta || {
        topic: S.topic || "—",
        age: S.age || "",
        ageLabel,
        mainBloomLabel: S.bloomMain || "",
        supportBloomLabel: S.bloomSupport || ""
      },
      goals: sa(payload.goals),
      success: payload.success || "",
      structure: sa(payload.structure),
      activities: sa(payload.activities),
      assessment: sa(payload.assessment),
      diff: sa(payload.diff),
      oneMin: payload.oneMin || ""
    };

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body)
    };

  } catch (err) {
    // لوج واضح في نتلايفي
    console.error("murtakaz error:", err);
    const msg = (err && err.message) ? err.message : String(err);
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" },
      body: `Server error: ${msg}`
    };
  }
};
