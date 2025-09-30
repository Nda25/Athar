// netlify/functions/murtakaz.js  (CommonJS)
// مُرتكز — يولّد خطة درس عبر Gemini مع fallback تلقائي بين v1 و v1beta.

const { GoogleGenerativeAI } = require("@google/generative-ai");

/* ===== CORS ===== */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

/* ===== ضبط الموديلات =====
   - PRIMARY: مناسب لـ v1 (أسماء -latest)
   - FALLBACK: مناسب لـ v1beta (بدون -latest)
   يمكنك تغييرها من متغيرات البيئة إن أحببت. */
const MODEL_PRIMARY  = process.env.GEMINI_MODEL_ID_PRIMARY  || "gemini-1.5-pro-latest";
const MODEL_FALLBACK = process.env.GEMINI_MODEL_ID_FALLBACK || "gemini-1.5-pro";

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: CORS, body: "" };
    }
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers: CORS, body: "Missing GEMINI_API_KEY" };
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const {
      mode, subject, topic, sourceText,
      age, duration, bloomMain, bloomSupport,
      goalCount, notes, level, adapt, variant
    } = safeJson(event.body, {});

    /* ===== تجهيز البرومبت ===== */
    const AGE_LABELS = { p1: "ابتدائي دُنيا", p2: "ابتدائي عُليا", m: "متوسط", h: "ثانوي" };
    const ageLabel = AGE_LABELS[age] || age || "—";
    const dhow = (v) => (v == null ? "—" : String(v));
    const goalN = Math.max(1, Number(goalCount) || 2);

    const strictJSON = `
أنت مخطط دروس ذكي لمدارس السعودية (مناهج 2025+).
- لا تكتب أي شيء خارج JSON.
- اجعل الأهداف والأنشطة قابلة للقياس وتراعي ${ageLabel} وزمن ${dhow(duration||45)} دقيقة.
- طابق أفعال بلوم مع "${dhow(bloomMain)}" (+ "${dhow(bloomSupport)}" إن وُجد).
- "structure" = قبل/أثناء/بعد مع دقائق تقريبية داخل زمن الحصة.
- "diff" = [دعم، إثراء، مرونة العرض]. "success" = معيار قصير قابل للملاحظة.
- JSON فقط.
`.trim();

    const pre    = Math.min(10, Math.max(3, Math.round((duration || 45) * 0.20)));
    const during = Math.max(15, Math.round((duration || 45) * 0.55));
    const post   = Math.max(5, Math.round((duration || 45) * 0.25));

    function buildPrompt(reinforceNovelty = false) {
      const nov = variant || Date.now();
      const note = reinforceNovelty
        ? `[تنويع صارم] غيّر العنوان والتسلسل والمنتج النهائي جذريًا.`
        : `لو وُجد variant=${nov} فلتكن الاستجابة مختلفة جذريًا.`;

      return `
${strictJSON}

أعد JSON بهذه المفاتيح فقط:
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
  "activities": ["تمهيد محسوس", "نشاط تعاوني رئيسي", "تطبيق فردي قصير", "منتج نهائي/عرض وجيز"],
  "assessment": ["س١ واضح مباشر: __", "س٢ أعلى في بلوم: __", "س٣ تذكرة خروج قابلة للقياس: __"],
  "diff": ["دعم: __", "إثراء: __", "مرونة العرض: __"],
  "oneMin": "نص الدقيقة الواحدة الملائم"
}

المعطيات:
- المادة: ${dhow(subject)}
- النمط: ${dhow(mode)} (topic/text)
- الموضوع: ${dhow(topic)}
- النص للتحليل: ${(sourceText || "—").slice(0, 1200)}
- ملاحظات المعلم: ${dhow(notes)}
- مستوى الصف: ${dhow(level)}
- تعلم تكيفي: ${adapt ? "نعم" : "لا"}
- Bloom: ${dhow(bloomMain)} / ${dhow(bloomSupport)}
- الزمن: ${dhow(duration||45)} دقيقة
- variant: ${nov}

${note}
- إن كان النمط "text": استخرج Topic مناسبًا من النص ووافق الأهداف معه.
- أمثلة واقعية من بيئة المدرسة السعودية.
- JSON فقط.
`.trim();
    }

    /* ===== مولّد مع fallback تلقائي ===== */
    async function generateWithFallback(promptText) {
      // المحاولة 1 — v1 (أسماء -latest)
      try {
        const model = genAI.getGenerativeModel({ model: MODEL_PRIMARY /* (v1 الافتراضي) */ });
        return await ask(model, promptText);
      } catch (e) {
        const s = String(e && e.message || e);
        const looksLikeVersionMismatch =
          s.includes("404") || s.toLowerCase().includes("not found") || s.includes("v1beta");
        if (!looksLikeVersionMismatch) throw e;
        // المحاولة 2 — v1beta (بدون -latest)
        const model = genAI.getGenerativeModel({ model: MODEL_FALLBACK, apiVersion: "v1beta" });
        return await ask(model, promptText);
      }
    }

    async function ask(model, promptText) {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: promptText }] }]
      });
      const raw = (result?.response?.text?.() || "").trim();

      let payload;
      try {
        const m = raw.match(/\{[\s\S]*\}$/m) || raw.match(/\{[\s\S]*\}/m);
        payload = JSON.parse(m ? m[0] : raw);
      } catch (e) {
        const err = new Error("Bad JSON from model");
        err.body = raw.slice(0, 400);
        throw err;
      }
      return payload;
    }

    // أولًا طبيعي، ولو فشل نعيد بالبنية المشددة للتنويع
    let payload;
    try {
      payload = await generateWithFallback(buildPrompt(false));
    } catch {
      payload = await generateWithFallback(buildPrompt(true));
    }

    const safeArr = (a) => Array.isArray(a) ? a.filter(Boolean) : [];
    const body = {
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
      headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body)
    };

  } catch (err) {
    console.error("murtakaz error:", err);
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" },
      body: `Server error: ${err.message || String(err)}`
    };
  }
};

/* ===== Utils ===== */
function safeJson(str, fallback = null) {
  try { return JSON.parse(str || "null") ?? fallback; }
  catch { return fallback; }
}
