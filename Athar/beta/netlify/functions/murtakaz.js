// netlify/functions/murtakaz.js  (CommonJS)
// مولّد خطط "مُرتكز" — نسخة مُحدّثة للعمل مع Gemini 1.5 (v1beta)

const { GoogleGenerativeAI } = require("@google/generative-ai");

/* إعدادات عامة */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

// اسم الموديل الموصى به حالياً
const MODEL_ID = "gemini-1.5-pro-latest"; // بدّليه إلى "gemini-1.5-flash-latest" لو تبين الأرخص
const API_VERSION = "v1beta";             // لتجنّب تعارض النسخ التي تظهر برسالة 404/Not found

exports.handler = async (event) => {
  try {
    // Preflight
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: CORS_HEADERS, body: "" };
    }

    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: CORS_HEADERS, body: "Method Not Allowed" };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers: CORS_HEADERS, body: "Missing GEMINI_API_KEY" };
    }

    // قراءة جسم الطلب
    const {
      mode,            // "topic" أو "text"
      subject,         // المادة
      topic,           // الموضوع (إن وُجد)
      sourceText,      // نص للتحليل إن كان النمط "text"
      age,             // p1/p2/m/h أو نص
      duration,        // مدة الحصة بالدقائق
      bloomMain,       // مستوى بلوم الأساسي
      bloomSupport,    // مستوى بلوم الداعم
      goalCount,       // عدد الأهداف
      notes,           // ملاحظات المعلّم
      level,           // مستوى الصف
      adapt,           // تعلم تكيفي (boolean)
      variant          // مفتاح للتنويع الجذري
    } = safeJson(event.body, {});

    // تهيئة Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL_ID,
      apiVersion: API_VERSION
    });

    // تسميات الفئات العمرية
    const AGE_LABELS = { p1: "ابتدائي دُنيا", p2: "ابتدائي عُليا", m: "متوسط", h: "ثانوي" };
    const ageLabel = AGE_LABELS[age] || age || "—";
    const dhow = (v) => (v == null ? "—" : String(v));

    // قواعد الصياغة الصارمة (إخراج JSON فقط)
    const strictJSON = `
أنت مخطط دروس ذكي لمدارس السعودية (مناهج 2025+) بالعربية الفصحى.
- لا تكتب أي نص خارج JSON.
- أعطِ تفاصيل قابلة للتطبيق والقياس، تراعي ${ageLabel} وزمن الحصة (${dhow(duration || 45)} دقيقة) وبيئة الصف السعودية.
- مواءمة بلوم: انسج الأهداف والأنشطة والتقويم بأفعال ومهام تتطابق مع "${dhow(bloomMain)}" (+ "${dhow(bloomSupport)}" إن وُجد).
- امنع التكرار: لو مُمرّر متغير "variant" فاعتمد زاوية وتنظيمًا مختلفين 100%.
- اجعل "structure" خطوات قبل/أثناء/بعد بمؤشرات زمنية تقريبية ضمن زمن الحصة.
- اجعل "goals" ذكية (قابلة للقياس) ومُصاغة بأفعال بلوم الصحيحة للمستوى.
- اجعل "activities" متعددة الزوايا: تمهيد محسوس/نشاط تعاوني/تمرين فردي/منتج نهائي قصير.
- اجعل "diff": (دعم)، (إثراء)، (مرونة العرض).
- "success": معيار نجاح قصير قابل للملاحظة.
- اللغة عربية سليمة خالية من الحشو.
- JSON فقط.
`.trim();

    const goalN = Math.max(1, Number(goalCount) || 2);

    function buildPrompt(reinforceNovelty = false) {
      const novelty = variant || Date.now();
      const noveltyNote = reinforceNovelty
        ? `[تنويع صارم] بدّل العناوين والتسلسل والمنتج النهائي وطرق التقييم جذريًا. لا تُعيد أي صياغة سابقة.`
        : `لو وُجد variant=${novelty}: اختر عنوانًا وهيكلة ونشاطًا/منتجًا نهائيًا مختلفًا جذريًا.`;

      const pre = Math.min(10, Math.max(3, Math.round((duration || 45) * 0.20)));
      const during = Math.max(15, Math.round((duration || 45) * 0.55));
      const post = Math.max(5, Math.round((duration || 45) * 0.25));

      return `
${strictJSON}

أعِد JSON بهذه الحقول والقيم فقط:
{
  "meta": {
    "topic": "عنوان مختصر مبتكر ومحدد",
    "age": "${dhow(age)}",
    "ageLabel": "${ageLabel}",
    "mainBloomLabel": "${dhow(bloomMain)}",
    "supportBloomLabel": "${dhow(bloomSupport)}"
  },
  "goals": [ ${Array.from({length: goalN}).map(() => `"__"`).join(", ")} ],
  "success": "__",
  "structure": ["قبل (تهيئة ${pre}د): __", "أثناء (${during}د): __", "بعد (${post}د): __"],
  "activities": ["تمهيد محسوس ملائم للعمر", "نشاط رئيسي تعاوني موجّه بوضوح", "تمرين تطبيق فردي قصير", "منتج تقويمي نهائي أو عرض وجيز"],
  "assessment": ["س١ (واضح ومباشر مرتبط بالموضوع): __", "س٢ (أعلى قليلاً في بلوم): __", "س٣ (تذكرة خروج قابلة للقياس): __"],
  "diff": ["دعم: __", "إثراء: __", "مرونة العرض: __"],
  "oneMin": "نص الدقيقة الواحدة الملائم"
}

المعطيات:
- المادة: ${dhow(subject)}
- النمط: ${dhow(mode)}  (topic/text)
- الموضوع (إن وُجد): ${dhow(topic)}
- النص للتحليل (إن وُجد): ${(sourceText || "—").slice(0, 1200)}
- ملاحظات المعلم: ${dhow(notes)}
- مستوى الصف: ${dhow(level)}
- تعلم تكيفي: ${adapt ? "نعم" : "لا"}
- Bloom (أساسي/داعم): ${dhow(bloomMain)} / ${dhow(bloomSupport)}
- زمن الحصة (د): ${dhow(duration || 45)}
- الفئة العمرية: ${ageLabel}
- variant: ${novelty}

${noveltyNote}
- إن كان النمط "text": استخرج Topic مناسبًا من النص ووافق الأهداف معه.
- استخدم أمثلة واقعية من بيئة المدرسة السعودية.
- أخرج JSON فقط لا غير.
`.trim();
    }

    async function callOnce(promptText) {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: promptText }] }]
      });

      const raw = (result.response && result.response.text && result.response.text()) || "";
      const text = String(raw).trim();

      // التقاط JSON حتى لو التفّ داخل نص
      let payload;
      try {
        const m = text.match(/\{[\s\S]*\}$/m) || text.match(/\{[\s\S]*\}/m);
        payload = JSON.parse(m ? m[0] : text);
      } catch (e) {
        const err = new Error("Bad JSON from model");
        err.body = text.slice(0, 400);
        throw err;
      }
      return payload;
    }

    // محاولة أولى ثم تشديد التنويع لو فشل
    let payload;
    try {
      payload = await callOnce(buildPrompt(false));
    } catch {
      payload = await callOnce(buildPrompt(true));
    }

    // تنظيف الحد الأدنى دون تغيير شكل الحقول
    const safeArr = (a) => Array.isArray(a) ? a.filter(Boolean) : [];
    const responseBody = {
      meta: payload.meta || {
        topic: topic || "—",
        age: age || "",
        ageLabel,
        mainBloomLabel: bloomMain || "",
        supportBloomLabel: bloomSupport || ""
      },
      goals: safeArr(payload.goals),
      success: payload.success || "",
      structure: safeArr(payload.structure),
      activities: safeArr(payload.activities),
      assessment: safeArr(payload.assessment),
      diff: safeArr(payload.diff),
      oneMin: payload.oneMin || ""
    };

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(responseBody)
    };

  } catch (err) {
    console.error("murtakaz error:", err);
    const msg = (err && err.message) ? err.message : String(err);
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
      body: `Server error: ${msg}`
    };
  }
};

/* ===== أدوات مساعدة صغيرة ===== */
function safeJson(str, fallback = null) {
  try { return JSON.parse(str || "null") ?? fallback; }
  catch { return fallback; }
}
