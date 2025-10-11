// netlify/functions/strategy.js
// يولّد استراتيجية تدريس مُحكمة بصيغة JSON واحدة (بدون أي حقول جديدة)
// إضافة: دمج استراتيجية ممتعة مناسبة للعمر (فن/سبب-نتيجة/رؤوس مرقمة…)
// الحماية/الاعتمادية: نفس منطق المهلة والمحاولات والفولباك

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let payload = {};
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: "Bad JSON body" }; }

  const { stage, subject, bloomType, lesson, variant, preferred } = payload;

  const API_KEY   = process.env.GEMINI_API_KEY;
  const PRIMARY   = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const FALLBACKS = (process.env.GEMINI_FALLBACKS || "gemini-1.5-flash-8b,gemini-1.5-flash-latest,gemini-1.5-pro")
                      .split(",").map(s=>s.trim()).filter(Boolean);
  const MODELS    = [PRIMARY, ...FALLBACKS];

  const TIMEOUT_MS  = +(process.env.TIMEOUT_MS || 30000);
  const MAX_RETRIES = +(process.env.RETRIES   || 3);
  const BACKOFF_MS  = +(process.env.BACKOFF_MS|| 800);

  if (!API_KEY) return { statusCode: 500, body: "Missing GEMINI_API_KEY" };

  /* ===== بنك الاستراتيجيات حسب المرحلة ===== */
  const STRATS_BY_STAGE = {
    "primary-lower": [
      "مخطط فن (نسختان دائريتان بسيطتان)",
      "السبب والنتيجة (سهم كبير + مربعات)",
      "الرؤوس المرقمة (أرقام 1–4 لكل مجموعة)",
      "فكر-زاوج-شارك (نسخة مبسطة)",
      "البطاقات المصوّرة/الصور-كلمات",
      "الخط الزمني المصغّر (3 خانات)"
    ],
    "primary-upper": [
      "مخطط فن",
      "السبب والنتيجة",
      "الرؤوس المرقمة",
      "فكر-زاوج-شارك",
      "القبعات الست المبسّطة (قبعتان فقط)",
      "تدوير المحطات (محطتان فقط)"
    ],
    "middle": [
      "رؤوس مرقمة (Numbered Heads Together)",
      "مخطط فن/تداخل ثلاثي عند الحاجة",
      "السبب والنتيجة + دليل من النص",
      "التفكير بصوت عالٍ + زميل المراجعة",
      "دوائر التعلم/محطات",
      "مثلث الادّعاء-الدليل-التفسير"
    ],
    "secondary": [
      "رؤوس مرقمة (بأدوار محددة)",
      "الادّعاء-الدليل-التفسير (CER)",
      "مخطط فن متقدم/مقارنة معيارية",
      "خريطة السبب-الأثر متعددة المستويات",
      "الندوة السقراطية المصغّرة",
      "فكر-اكتب-شارك (نسخة زمنية مضبوطة)"
    ]
  };

  const STAGE_HINT = {
    "primary-lower": "ابتدائي دنيا (6–9): لغة بسيطة جدًا، مهام قصيرة محسوسة.",
    "primary-upper": "ابتدائي عليا (10–12): أمثلة ملموسة وتمثيل بصري.",
    "middle":        "متوسط (13–15): تعاون منظم وتدرّج نحو التجريد.",
    "secondary":     "ثانوي (16–18): تفكير ناقد وتطبيقات واقعية."
  };

  const stageList = STRATS_BY_STAGE[stage] || STRATS_BY_STAGE["secondary"];
  const preferredClean = (preferred || "").trim();

  const tPart = (bloomType && bloomType !== "الكل") ? ` (تصنيف بلوم: ${bloomType})` : "";
  const lPart = lesson ? ` ومناسبة لدرس بعنوان: "${lesson}"` : "";
  const sPart = stage ? `\nالجمهور: ${STAGE_HINT[stage] || STAGE_HINT["secondary"]}.` : "";

  /* ===== برومبت مضبوط — بدون تغيير لشكل الإخراج ===== */
  const BASE_PROMPT =
`أنت خبيرة مناهج. أنشئي استراتيجية تدريس لمادة "${subject}"${tPart}${lPart}.
أعيدي **كائن JSON واحد فقط** بالمفاتيح نفسها أدناه، بلا أي نص خارج JSON ولا مفاتيح إضافية.

المتطلبات (بدون تغيير شكل الإخراج):
- "strategy_name": اذكري اسم الاستراتيجية المختارة صراحةً.
- "bloom": صرّحي بالمستوى/المستويات.
- "importance": لماذا هذه الاستراتيجية مناسبة للدرس والمرحلة.
- "materials": مواد/أدوات قابلة للتجهيز (أوراق/ملصقات/أرقام للمجموعات… عند الحاجة).
- "goals": 3–6 أهداف سلوكية قابلة للقياس.
- "steps": 5–8 خطوات عملية مرتبة زمنيًا. صيغي التنفيذ الدقيق للاستراتيجية المختارة (أدوار/أرقام/قالب فن…).
- "examples": 2–4 أمثلة تطبيقية قصيرة مرتبطة بالاستراتيجية.
- "assessment": أدوات تقويم/تذكرة خروج وكيفية الحكم.
- "diff_support": دعم المتعثرين مرتبط بالاستراتيجية.
- "diff_core": المستوى الأساسي.
- "diff_challenge": تحديات المتقدمين.
- "expected_impact": أثر متوقع.
- "citations": على الأقل مرجعان [{"title":"…","benefit":"…"}].

اختاري **استراتيجية واحدة فقط** من القائمة الآتية المناسبة للعمر (إلا إذا تم تفضيل اسم محدّد):
${preferredClean ? `الاستراتيجية المفضّلة (إلزامية): "${preferredClean}".` :
`استراتيجيات مقترحة حسب المرحلة: ${stageList.map(s=>`"${s}"`).join(", ")}.`}

قواعد:
- اذكري اسم الاستراتيجية المختارة صراحةً داخل "strategy_name".
- دمّجيها واقعيًا داخل "steps" و"materials" و"examples" و"assessment" (مثل: مخطط فن، السبب والنتيجة، رؤوس مرقّمة…).
- جُمَل قصيرة واضحة ومناسبة للعمر؛ لا تكرار للعناوين داخل المتن.
${sPart}
`;

  /* ===== مخطط الاستجابة (كما هو) ===== */
  const responseSchema = {
    type: "OBJECT",
    required: [
      "strategy_name","bloom","importance","materials","goals","steps",
      "examples","assessment","diff_support","diff_core","diff_challenge",
      "expected_impact","citations"
    ],
    properties: {
      strategy_name:  { type: "STRING" },
      bloom:          { type: "STRING" },
      importance:     { type: "STRING" },
      materials:      { type: "STRING" },
      goals:          { type: "ARRAY",  items: { type: "STRING" }, minItems: 3 },
      steps:          { type: "ARRAY",  items: { type: "STRING" }, minItems: 5 },
      examples:       { type: "ARRAY",  items: { type: "STRING" }, minItems: 2 },
      assessment:     { type: "STRING" },
      diff_support:   { type: "STRING" },
      diff_core:      { type: "STRING" },
      diff_challenge: { type: "STRING" },
      expected_impact:{ type: "STRING" },
      citations:      { type: "ARRAY",  items: { type: "OBJECT", required:["title","benefit"],
        properties: { title:{type:"STRING"}, benefit:{type:"STRING"} } } }
    }
  };

  const MIN = { goals:3, steps:2, examples:2 };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const isEmptyStr = (s) => !s || !String(s).trim();

  function isSoftComplete(d){
    if (!d || isEmptyStr(d.strategy_name)) return false;
    if (!Array.isArray(d.steps)   || d.steps.length   < MIN.steps)    return false;
    if (!Array.isArray(d.goals)   || d.goals.length   < MIN.goals)    return false;
    if (!Array.isArray(d.examples)|| d.examples.length< MIN.examples) return false;
    return true;
  }
  function isStrictComplete(d){
    if (!d) return false;
    const mustStrings = ["strategy_name","bloom","importance","materials","assessment","diff_support","diff_core","diff_challenge","expected_impact"];
    for (const k of mustStrings) if (isEmptyStr(d[k])) return false;
    for (const k of ["goals","steps","examples","citations"]) if (!Array.isArray(d[k])) return false;
    if ((d.goals||[]).length    < 3) return false;
    if ((d.steps||[]).length    < 5) return false;
    if ((d.examples||[]).length < 2) return false;
    for (const c of (d.citations||[])) {
      if (!c || isEmptyStr(c.title) || isEmptyStr(c.benefit)) return false;
    }
    return true;
  }

  async function callGeminiOnce(model, promptText){
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(new Error("timeout")), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema,
            candidateCount: 1,
            maxOutputTokens: 2048,
            temperature: 0.55
          }
        }),
        signal: controller.signal
      });
      const txt = await res.text();
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`);
        err.status = res.status; err.body = txt.slice(0, 800);
        throw err;
      }
      let outer; try { outer = JSON.parse(txt); }
      catch {
        const err = new Error("Bad JSON (outer) from API");
        err.status = 502; err.body = txt.slice(0, 800);
        throw err;
      }
      const raw = outer?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      let data;
      try { data = JSON.parse(raw); }
      catch { return { ok:false, rawText: raw, data: null }; }
      return { ok:true, rawText: raw, data };
    } finally { clearTimeout(timer); }
  }

  function repairPrompt(prevRaw){
    return `${BASE_PROMPT}

الاستجابة السابقة غير صالحة/ناقصة. هذا نصّك:
<<<
${prevRaw}
<<<
أعيدي الآن **JSON واحدًا صالحًا مكتملًا** بالمفاتيح نفسها دون أي إضافة أو نص خارجي.`;
  }

  let finalStrict=null, finalSoft=null, finalRaw="", usedModel="";
  for (const model of MODELS) {
    let promptText = BASE_PROMPT;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const resp = await callGeminiOnce(model, promptText);
        if (resp.ok && resp.data) {
          const d = resp.data; finalRaw = resp.rawText; usedModel = model;
          if (isStrictComplete(d)) { finalStrict = d; break; }
          if (isSoftComplete(d))   { finalSoft   = d; }
          promptText = repairPrompt(resp.rawText);
          await sleep(BACKOFF_MS * (attempt + 1));
          continue;
        } else {
          finalRaw = resp.rawText;
          promptText = repairPrompt(resp.rawText);
          await sleep(BACKOFF_MS * (attempt + 1));
          continue;
        }
      } catch (err) {
        const status = err.status || 0;
        const isTimeout = /timeout|AbortError/i.test(String(err?.message));
        const retriable = isTimeout || [429,500,502,503,504].includes(status);
        if (retriable && attempt < MAX_RETRIES) {
          await sleep(BACKOFF_MS * (attempt + 1));
          continue;
        }
        break;
      }
    }
    if (finalStrict) break;
  }

  const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

  if (finalStrict) {
    finalStrict._meta = { model: usedModel, subject: subject||"", stage: stage||"", bloomType: bloomType||"", lesson: lesson||"", variant: variant||"", preferred: preferredClean||"" };
    return { statusCode: 200, headers, body: JSON.stringify(finalStrict) };
  }
  if (finalSoft) {
    finalSoft._meta = { model: usedModel, subject: subject||"", stage: stage||"", bloomType: bloomType||"", lesson: lesson||"", variant: variant||"", preferred: preferredClean||"" };
    return { statusCode: 200, headers, body: JSON.stringify({ debug:"incomplete", parsed: finalSoft, rawText: finalRaw||"" }) };
  }

  const failMsg = "Model returned incomplete JSON after retries";
  return { statusCode: 200, headers, body: JSON.stringify({ debug:"incomplete", parsed:null, rawText: finalRaw||"", message: failMsg }) };
};
