// netlify/functions/strategy.js
exports.handler = async (event) => {
  // نسمح فقط بـ POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // نقرأ جسم الطلب بأمان
  let payload = {};
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: "Bad JSON body" }; }

  const { stage, subject, bloomType, lesson, variant } = payload;

  // إعدادات من متغيّرات البيئة (ضعيها في Netlify dashboard)
  const API_KEY    = process.env.GEMINI_API_KEY;
  const MODEL      = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const TIMEOUT_MS = +(process.env.TIMEOUT_MS || 23000);
  const RETRIES    = +(process.env.RETRIES || 2);
  const BACKOFF_MS = +(process.env.BACKOFF_MS || 700);

  if (!API_KEY) return { statusCode: 500, body: "Missing GEMINI_API_KEY" };

  // توصيف الأسلوب حسب المرحلة (لغة/أنشطة مناسبة للعمر)
  const STAGE_GUIDE = {
    "primary-lower": `
- الفئة: ابتدائي دنيا (الأول–الثالث).
- التعليمات: لغة بسيطة جداً، جُمل قصيرة، أنشطة لعب/حركة/بطاقات/مجموعات صغيرة، وقت نشاط قصير.
- الأمثلة يجب أن تكون محسوسة وقريبة من حياة الطفل (ألعاب، صور، قصص قصيرة).`,
    "primary-upper": `
- الفئة: ابتدائي عليا (الرابع–السادس).
- التعليمات: لغة واضحة، خطوات مرقمة، عمل تعاوني بسيط، مشاريع صفية صغيرة، ربط بالواقع.
- الأمثلة يجب أن تُنمّي التنظيم الذاتي وحل المشكلات.`,
    "middle": `
- الفئة: متوسط.
- التعليمات: استقصاء موجه، نقاشات صفية، تجارب مبسطة/مصغرة، مهام تفكير ناقد، تعلّم قائم على مشكلة.
- الأمثلة تُنمّي التحليل والمقارنة وصياغة فرضيات.`,
    "secondary": `
- الفئة: ثانوي.
- التعليمات: صرامة أكاديمية أعلى، منهجيات بحث/مختبر، عرض نتائج، نقاش نقدي، تفكير عالي الرتبة.
- الأمثلة تُحفّز الإبداع والتحليل العميق وربط المفاهيم بالمستقبل/المسارات.`
  };

  const stageNote = STAGE_GUIDE[stage] || `
- الفئة: عام.
- التعليمات: صياغة واضحة ومتدرجة من السهل إلى الصعب مع أمثلة مناسبة للعمر.`;

  const typePart   = (bloomType && bloomType !== "الكل") ? `(تصنيف بلوم: "${bloomType}")` : "";
  const lessonPart = lesson ? `ومناسبة لدرس "${lesson}"` : "";

  // لو طلبنا بديل: نُجبر التنويع وتغيير الفكرة جذريًا
  const VARIANT_NOTE = variant ? `
- IMPORTANT: أعطِ استراتيجية مختلفة جذريًا عن أي مقترح سابق (زاوية/تقنية/منتج نهائي مختلف كليًا).
- غيّر طريقة التنظيم (فِرَق/محطات/قلب الصف/مناظرة/لعب أدوار… إلخ).` : "";

  // البرومبت الأساسي
  const BASE_PROMPT =
`أريد استراتيجية تدريس لمادة ${subject} ${typePart} ${lessonPart}.
${stageNote}
${VARIANT_NOTE}

أرسلي **فقط** JSON وفق المخطط التالي واملئي كل الحقول بنصوص غير فارغة:
- goals: 3 إلى 6 عناصر
- steps: 4 إلى 8 عناصر
- examples: 2 إلى 4 عناصر
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

  function makeReqBody(promptText){
    return {
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
        candidateCount: 1,
        maxOutputTokens: 2048,
        temperature: 0.75,      // نرفعها شوي للتنوع
        topK: 64,
        topP: 0.9
      },
      safetySettings: [
        // يمكنكِ تركها افتراضية أو تخصيصها حسب الحاجة
      ]
    };
  }

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const MIN = { goals:3, steps:4, examples:2 };
  function isEmptyStr(s){ return !s || !String(s).trim(); }
  function isComplete(d){
    if (!d) return false;
    const mustStrings = ["strategy_name","bloom","importance","materials","assessment","diff_support","diff_core","diff_challenge","expected_impact"];
    for (const k of mustStrings) if (isEmptyStr(d[k])) return false;
    for (const k of ["goals","steps","examples","citations"]) if (!Array.isArray(d[k])) return false;
    if ((d.goals||[]).length < MIN.goals) return false;
    if ((d.steps||[]).length < MIN.steps) return false;
    if ((d.examples||[]).length < MIN.examples) return false;
    for (const c of d.citations){ if (!c || isEmptyStr(c.title) || isEmptyStr(c.benefit)) return false; }
    return true;
  }

  async function callOnce(promptText){
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("timeout")), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
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

الاستجابة السابقة كانت ناقصة. أَعِد إرسال **JSON مكتمل** يملأ كل الحقول بنصوص غير فارغة،
وبحد أدنى (${MIN.goals}) أهداف، (${MIN.steps}) خطوات، (${MIN.examples}) أمثلة.
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

      return {
        statusCode: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
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
        return { statusCode: 504, body: "Gateway Timeout: model did not respond in time" };
      }
      const code = status || 500;
      const body = err.body || String(err.message || err);
      return { statusCode: code, body };
    }
  }
};
