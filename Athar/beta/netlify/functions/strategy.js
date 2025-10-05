// netlify/functions/strategy.js
exports.handler = async (event) => {
  // ==== CORS ====
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  // ==== POST فقط ====
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // ==== جسم الطلب ====
  let payload = {};
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: "Bad JSON body" }; }

  const qs = event.queryStringParameters || {};
  const diag = payload.diag === true || qs.diag === "1" || qs.diag === "true";

  const { stage, subject, bloomType, lesson, variant } = payload;

  // ==== إعدادات البيئة ====
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) return { statusCode: 500, body: "Missing GEMINI_API_KEY" };

  // alias رسمي سريع
  const MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";

  // مهل مخفّضة (تناسب حدود Netlify)
  const TIMEOUT_MS = +(process.env.TIMEOUT_MS || 8000);  // 8s داخلية
  const MAX_TOKENS = +(process.env.MAX_TOKENS || 600);   // حمل قليل للتشخيص

  // ==== أدلة الأسلوب ====
  const STAGE_GUIDE = {
    "primary-lower": `- الفئة: ابتدائي دنيا. لغة بسيطة، أنشطة قصيرة/حركية.`,
    "primary-upper": `- الفئة: ابتدائي عليا. خطوات مرقمة، تعاون بسيط، ربط بالواقع.`,
    "middle":        `- الفئة: متوسط. استقصاء موجه، نقاش، تجارب مصغّرة.`,
    "secondary":     `- الفئة: ثانوي. نقاش نقدي، مشاريع/بحث مختصر.`
  };
  const stageNote = STAGE_GUIDE[stage] || `- الفئة: عام. صياغة واضحة ومتدرجة.`;
  const typePart   = (bloomType && bloomType !== "الكل") ? `(تصنيف بلوم: "${bloomType}")` : "(تصنيف بلوم: اختاري مستويات ملائمة)";
  const lessonPart = lesson ? `ومناسبة لدرس "${lesson}"` : "";

  const VARIANT_NOTE = `
- IMPORTANT: استراتيجية مختلفة جذريًا عن أي مقترح سابق (محطات/مناظرة/قلب الصف/محاكاة/لعب أدوار...).
- strategy_name فريد 100% ولا يكرر أسماء الدروس/المواد.
- novelty seed: ${[
    stage || "any-stage",
    subject || "any-subject",
    bloomType || "any-bloom",
    (lesson || "any-lesson"),
    (variant || Date.now())
  ].join(" | ")}
- بدّلي الزاوية والمنتج النهائي وأساليب التقويم كليًا.`;

  // ==== البرومبت ====
  const BASE_PROMPT =
`أريد استراتيجية تدريس لمادة ${subject || "أي مادة"} ${typePart} ${lessonPart}.
${stageNote}
${VARIANT_NOTE}

القيود الإلزامية:
- ابدئي كل خطوة بصيغة زمنية: "الدقيقة 0–5: …".
- "goals": قابلة للقياس (فعل سلوكي + معيار %/عدد/زمن).
- "assessment": أدوات عملية + "روبرك مختصر" (3 مستويات بمؤشرات).
- "bloom": اربطي المستويات المناسبة.
- "diff_support/core/challenge": منتجات/أداء observable لكل مستوى.
- "materials": عناصر محددة كسطر واحد مفصول بـ "؛ ".
- "examples": أمثلة جديدة لا تكرر خطوات التنفيذ.
- "expected_impact": مؤشرات نجاح (% إتقان/عدد منتجات/زمن إنجاز).

أرسلي فقط JSON بالمخطط التالي واملئي جميع الحقول:
- goals: 3–6
- steps: 4–8 (تبدأ بـ "الدقيقة X–Y")
- examples: 2–4
- بلا أي نص خارج JSON. لغة عربية دقيقة ومختصرة.`;

  // ==== مخطط الاستجابة ====
  const responseSchema = {
    type: "OBJECT",
    required: [
      "strategy_name","bloom","importance","materials","goals","steps",
      "examples","assessment","diff_support","diff_core","diff_challenge",
      "expected_impact","citations"
    ],
    properties: {
      strategy_name:{ type:"STRING" },
      bloom:{ type:"STRING" },
      importance:{ type:"STRING" },
      materials:{ type:"STRING" },
      goals:{ type:"ARRAY", items:{ type:"STRING" }, minItems:3 },
      steps:{ type:"ARRAY", items:{ type:"STRING" }, minItems:4 },
      examples:{ type:"ARRAY", items:{ type:"STRING" }, minItems:2 },
      assessment:{ type:"STRING" },
      diff_support:{ type:"STRING" },
      diff_core:{ type:"STRING" },
      diff_challenge:{ type:"STRING" },
      expected_impact:{ type:"STRING" },
      citations:{ type:"ARRAY", items:{ type:"OBJECT", required:["title","benefit"], properties:{
        title:{ type:"STRING" }, benefit:{ type:"STRING" }
      }}}
    }
  };

  const MIN = { goals:3, steps:4, examples:2 };
  const isEmptyStr = (s)=> !s || !String(s).trim();
  function isComplete(d){
    if (!d) return false;
    const must = ["strategy_name","bloom","importance","materials","assessment","diff_support","diff_core","diff_challenge","expected_impact"];
    for (const k of must) if (isEmptyStr(d[k])) return false;
    for (const k of ["goals","steps","examples","citations"]) if (!Array.isArray(d[k])) return false;
    if (d.goals.length < MIN.goals) return false;
    if (d.steps.length < MIN.steps) return false;
    if (d.examples.length < MIN.examples) return false;
    for (const c of d.citations) if (!c || isEmptyStr(c.title) || isEmptyStr(c.benefit)) return false;
    if (!d.steps.every(s => /الدقيقة\s*\d+\s*[-–]\s*\d+/.test(String(s)))) return false;
    return true;
  }

  function makeReqBody(promptText){
    return {
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
        candidateCount: 1,
        maxOutputTokens: MAX_TOKENS, // حمل قليل لتسليم أسرع
        temperature: 0.5,
        topK: 32,
        topP: 0.9
      },
      safetySettings: []
    };
  }

  async function callOnce(model, promptText){
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
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
        err.body = text.slice(0, 400);
        throw err;
      }
      let outer;
      try { outer = JSON.parse(text); }
      catch { const e = new Error("Bad JSON from API"); e.status = 502; e.body = text.slice(0,300); throw e; }
      const raw = outer?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      let data;
      try { data = JSON.parse(raw); }
      catch { const e = new Error("Bad model JSON"); e.status = 502; e.body = raw.slice(0,300); throw e; }
      return data;
    } finally { clearTimeout(timer); }
  }

  // ==== وضع التشخيص (body أو ?diag=1) ====
  if (diag) {
    try {
      const data = await callOnce(MODEL, 'أرسلي JSON {"ok":true} فقط.');
      return {
        statusCode: 200,
        headers: { "content-type":"application/json; charset=utf-8", "Access-Control-Allow-Origin":"*" },
        body: JSON.stringify({ model: MODEL, ok: true, data, timeout_ms: TIMEOUT_MS, max_tokens: MAX_TOKENS })
      };
    } catch (e) {
      return {
        statusCode: e.status || 500,
        headers: { "Access-Control-Allow-Origin":"*" },
        body: `DIAG ERROR (${MODEL}): ${e.status || ""} :: ${e.body || e.message}`
      };
    }
  }

  // ==== التنفيذ (بدون fallbacks للتشخيص) ====
  try {
    const data = await callOnce(MODEL, BASE_PROMPT);
    if (!isComplete(data)) {
      const e = new Error("Incomplete response from model");
      e.status = 502; throw e;
    }
    data._meta = { stage: stage||"", subject: subject||"", bloomType: bloomType||"", lesson: lesson||"", variant: variant||null, model: MODEL };
    return {
      statusCode: 200,
      headers: { "content-type":"application/json; charset=utf-8", "Access-Control-Allow-Origin":"*" },
      body: JSON.stringify(data)
    };
  } catch (e) {
    const code = e.status || (/timeout/i.test(String(e.message)) ? 504 : 500);
    return {
      statusCode: code,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: (e.body || e.message || "Unknown error").slice(0,500)
    };
  }
};
