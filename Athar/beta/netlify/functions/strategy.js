const { CORS, preflight } = require("./_cors.js");


// netlify/functions/strategy.js
exports.handler = async (event) => {
  const pre = preflight(event);
  if (pre) return pre;

  // نسمح فقط بـ POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { ...CORS }, body: "Method Not Allowed" };
  }

  // نقرأ جسم الطلب بأمان
  let payload = {};
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: { ...CORS }, body: "Bad JSON body" }; }

  const { stage, subject, bloomType, lesson, variant } = payload;

  // إعدادات من متغيّرات البيئة
  const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = (process.env.GEMINI_MODEL?.trim() || "gemini-1.5-flash-latest");
  

  const TIMEOUT_MS = +(process.env.TIMEOUT_MS || 23000);
  const RETRIES = +(process.env.RETRIES || 2);
  const BACKOFF_MS = +(process.env.BACKOFF_MS || 700);

  if (!API_KEY) {
    return { statusCode: 500, headers: { ...CORS }, body: "Missing GEMINI_API_KEY" };
  }



  // توصيف الأسلوب حسب المرحلة
  const STAGE_GUIDE = {
    "primary-lower": `
- الفئة: ابتدائي دنيا (الأول–الثالث).
- التعليمات: لغة بسيطة جداً، جُمل قصيرة، أنشطة لعب/حركة/بطاقات/مجموعات صغيرة، وقت نشاط قصير.
- الأمثلة محسوسة وقريبة من حياة الطفل (ألعاب، صور، قصص قصيرة).`,
    "primary-upper": `
- الفئة: ابتدائي عليا (الرابع–السادس).
- التعليمات: لغة واضحة، خطوات مرقمة، عمل تعاوني بسيط، مشاريع صفية صغيرة، ربط بالواقع.
- الأمثلة تُنمّي التنظيم الذاتي وحل المشكلات.`,
    "middle": `
- الفئة: متوسط.
- التعليمات: استقصاء موجه، نقاشات صفية، تجارب مصغّرة، مهام تفكير ناقد، تعلّم قائم على المشكلة.
- الأمثلة تُنمّي التحليل والمقارنة وصياغة فرضيات.`,
    "secondary": `
- الفئة: ثانوي.
- التعليمات: صرامة أكاديمية أعلى، منهجيات بحث/مختبر، عرض نتائج، نقاش نقدي، تفكير عالي الرتبة.
- الأمثلة تربط بالمستقبل/المسارات وتوظيف مهارات القرن 21.`
  };

  const stageNote = STAGE_GUIDE[stage] || `
- الفئة: عام.
- التعليمات: صياغة واضحة ومتدرجة من السهل إلى الصعب مع أمثلة مناسبة للعمر.`;

  const typePart   = (bloomType && bloomType !== "الكل") ? `(تصنيف بلوم: "${bloomType}")` : "(تصنيف بلوم: اختاري مستويات ملائمة)";
  const lessonPart = lesson ? `ومناسبة لدرس "${lesson}"` : "";

  // لو طلبنا بديل: نُجبر التنويع وتغيير الفكرة جذريًا
  const VARIANT_NOTE = `
- IMPORTANT: أعطِ استراتيجية مختلفة جذريًا عن أي مقترح سابق. غيّر آلية التنظيم (محطات/تعاقب أدوار/مناظرة/قلب الصف/مسرحة/لعب أدوار/مختبر مصغّر/محاكاة .).
- strategy_name فريد 100%، لا يُكرر أسماء الدروس/المواد أو أي عبارة وردت في الطلب.
- استخدم بذرة تنويع داخلية (novelty seed): ${[
    stage || "any-stage",
    subject || "any-subject",
    bloomType || "any-bloom",
    (lesson || "any-lesson"),
    (variant || Date.now())
  ].join(" | ")}
- لا تعيدي أي صياغات سبق استخدامها ضمن نفس الفكرة؛ بدّلي الزاوية والمنتج النهائي ومخرجات التعلم وأساليب التقويم كليًا.`;

  const BASE_PROMPT =
`أريد استراتيجية تدريس لمادة ${subject} ${typePart} ${lessonPart}.
${stageNote}
${VARIANT_NOTE}

القيود الإلزامية:
- أعطِ خطوات "قابلة للتنفيذ" تبدأ بصيغة زمنية (مثال: "الدقيقة 0–5: .").
- اجعل "goals" قابلة للقياس (أفعال سلوكية + معيار %/عدد/زمن).
- اجعل "assessment" يشمل أدوات تقويم عملية + "روبرك مختصر" (3 مستويات مع مؤشرات).
- اربط كل ذلك بمستويات بلوم الملائمة داخل "bloom" (يمكن مستوى أو مستويان).
- "diff_support/core/challenge": أنشطة مختلفة حقيقية، لكل مستوى مخرج observable (منتج/أداء).
- "materials": مواد محددة وواضحة (اكتبيها كسطر واحد مفصول بـ "؛ ").
- "examples": أمثلة تطبيق واقعية مبتكرة وغير مباشرة، لا تُكرر محتوى الخطوات.
- "expected_impact": صياغة أثر متوقّع مع مؤشرات نجاح (مثلاً: % إتقان، عدد مُنتجات، زمن إنجاز).

أرسلي **فقط** JSON وفق المخطط التالي واملئي كل الحقول بنصوص غير فارغة:
- goals: 3 إلى 6 عناصر (صياغة قابلة للقياس)
- steps: 4 إلى 8 عناصر (ابدئي كل عنصر بـ "الدقيقة X–Y")
- examples: 2 إلى 4 عناصر (جديدة عن الخطوات)
- صِيغي بلغة عربية دقيقة ومختصرة ومناسبة للعمر؛ بدون أي نص خارجي خارج JSON.`;

  // مخطط الاستجابة + required
  const responseSchema = {
    type: "OBJECT",
    required: [
      "strategy_name","bloom","importance","materials","goals","steps",
      "examples","assessment","diff_support","diff_core","diff_challenge",
      "expected_impact","citations"
    ],
    properties: {
      strategy_name: { type: "STRING" },
      bloom:         { type: "STRING" },
      importance:    { type: "STRING" },
      materials:     { type: "STRING" },
      goals:         { type: "ARRAY", items: { type: "STRING" }, minItems: 3 },
      steps:         { type: "ARRAY", items: { type: "STRING" }, minItems: 4 },
      examples:      { type: "ARRAY", items: { type: "STRING" }, minItems: 2 },
      assessment:    { type: "STRING" },
      diff_support:  { type: "STRING" },
      diff_core:     { type: "STRING" },
      diff_challenge:{ type: "STRING" },
      expected_impact:{ type:"STRING" },
      citations:     { type: "ARRAY", items: { type: "OBJECT", required:["title","benefit"], properties: {
        title:   { type: "STRING" },
        benefit: { type: "STRING" }
      }}}
    }
  };

const url = `https://generativelanguage.googleapis.com/v1/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;

function makeReqBody(promptText){
  return {
    contents: [{ role: "user", parts: [{ text: promptText }] }],
    generationConfig: {
      response_mime_type: "application/json",
      response_schema: responseSchema,
      candidateCount: 1,
      maxOutputTokens: 2048,
      temperature: 0.8,
      topK: 64,
      topP: 0.9
    },
    safetySettings: []
  };
}

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const MIN = { goals:3, steps:4, examples:2 };
  const isEmptyStr = (s) => !s || !String(s).trim();
  function isComplete(d){
    if (!d) return false;
    const mustStrings = ["strategy_name","bloom","importance","materials","assessment","diff_support","diff_core","diff_challenge","expected_impact"];
    for (const k of mustStrings) if (isEmptyStr(d[k])) return false;
    for (const k of ["goals","steps","examples","citations"]) if (!Array.isArray(d[k])) return false;
    if ((d.goals||[]).length < MIN.goals) return false;
    if ((d.steps||[]).length < MIN.steps) return false;
    if ((d.examples||[]).length < MIN.examples) return false;
    for (const c of d.citations){ if (!c || isEmptyStr(c.title) || isEmptyStr(c.benefit)) return false; }
    if (!d.steps.every(s => /الدقيقة\s*\d+\s*[-–]\s*\d+/.test(String(s)))) return false;
    return true;
  }

  async function callOnce(promptText){
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("timeout")), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" }, // ✅ طلب خارجي: فقط نوع المحتوى
        body: JSON.stringify(makeReqBody(promptText)),
        signal: controller.signal
      });
      const text = await res.text();
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`);
        err.status = res.status;
        err.body = text;
        throw err;
      }
      let json;
      try { json = JSON.parse(text); }
      catch {
        const err = new Error("Bad JSON from API");
        err.status = 502;
        err.body = text.slice(0,300);
        throw err;
      }
      const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      let data;
      try { data = JSON.parse(raw); }
      catch {
        const err = new Error("Bad model JSON");
        err.status = 502;
        err.body = raw.slice(0,300);
        throw err;
      }
      return data;
    } finally { clearTimeout(timer); }
  }

  let attempt = 0;
  let promptText = BASE_PROMPT;

  while (true) {
    try {
      let data = await callOnce(promptText);

      if (!isComplete(data) && attempt <= RETRIES) {
        attempt++;
        await sleep(BACKOFF_MS * attempt);
        promptText =
`${BASE_PROMPT}

الاستجابة السابقة كانت ناقصة/غير عملية. أعِد إرسال **JSON مكتمل** يملأ كل الحقول بنصوص غير فارغة،
وبحد أدنى (${MIN.goals}) أهداف قابلة للقياس، (${MIN.steps}) خطوات تبدأ بـ "الدقيقة X–Y"، (${MIN.examples}) أمثلة جديدة.
لا تضِف أي نص خارج JSON.`;
        continue;
      }

      if (!isComplete(data)) {
        const err = new Error("Incomplete response from model after retries");
        err.status = 502;
        throw err;
      }

      data._meta = {
        stage: stage || "",
        subject: subject || "",
        bloomType: bloomType || "",
        lesson: lesson || "",
        variant: variant || null
      };

      // ✅ رد النجاح بهيدر CORS
      return {
        statusCode: 200,
        headers: { ...CORS },
        body: JSON.stringify(data)
      };

    } catch (err) {
      attempt++;
      const status = err.status || 0;
      const isTimeout = /timeout|AbortError/i.test(String(err?.message));
      const retriable = isTimeout || [429,500,502,503,504].includes(status);

      if (retriable && attempt <= RETRIES) {
        await sleep(BACKOFF_MS * attempt);
        continue;
      }

      if (isTimeout) {
        return { statusCode: 504, headers: { ...CORS }, body: "Gateway Timeout: model did not respond in time" };
      }
      const code = status || 500;
      const body = err.body || String(err.message || err);
      return { statusCode: code, headers: { ...CORS }, body };
    }
  }
};
