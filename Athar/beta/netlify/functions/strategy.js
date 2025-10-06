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
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: "Method Not Allowed",
    };
  }

  // ==== Body ====
  let payload = {};
  try { payload = JSON.parse(event.body || "{}"); }
  catch {
    return { statusCode: 400, headers: { "Access-Control-Allow-Origin": "*" }, body: "Bad JSON body" };
  }

  const { stage, subject, bloomType, lesson, variant, diag } = payload;

  // ==== ENV ====
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: "Missing GEMINI_API_KEY" };
  }

  const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  // أضفت pro كخيار أخير (لو حسابك يسمح). لو رجّع 403 ننتقل لغيره.
  const FALLBACKS = [PRIMARY_MODEL, "gemini-1.5-flash-8b", "gemini-1.5-flash-latest", "gemini-1.5-pro"];

  const TIMEOUT_MS = +(process.env.TIMEOUT_MS || 35000);
  const RETRIES    = +(process.env.RETRIES    || 2);
  const BACKOFF_MS = +(process.env.BACKOFF_MS || 800);

  // ==== Guides ====
  const STAGE_GUIDE = {
    "primary-lower": `- الفئة: ابتدائي دنيا. لغة بسيطة جدًا، نشاطات قصيرة/حركية.`,
    "primary-upper": `- الفئة: ابتدائي عليا. خطوات مرقّمة، تعاون بسيط، ربط بالواقع.`,
    "middle":        `- الفئة: متوسط. استقصاء موجّه، نقاش، تجارب مصغّرة.`,
    "secondary":     `- الفئة: ثانوي. نقاش نقدي، مشاريع قصيرة، مخرجات قابلة للتقييم.`
  };
  const stageNote = STAGE_GUIDE[stage] || `- الفئة: عام. صياغة واضحة ومتدرجة.`;

  const typePart   = (bloomType && bloomType !== "الكل") ? `(تصنيف بلوم: "${bloomType}")` : "(تصنيف بلوم: اختاري مستويات ملائمة)";
  const lessonPart = lesson ? `ومناسبة لدرس "${lesson}"` : "";

  const VARIANT_NOTE = `
- IMPORTANT: استراتيجية مختلفة جذريًا (محطات/مناظرة/قلب الصف/محاكاة/لعب أدوار...).
- strategy_name فريد 100%.
- novelty seed: ${[
    stage || "any-stage", subject || "any-subject", bloomType || "any-bloom",
    (lesson || "any-lesson"), (variant || Date.now())
  ].join(" | ")}
- بدّلي الزاوية والمنتج النهائي وأساليب التقويم.`;

  const BASE_PROMPT =
`أريد استراتيجية تدريس لمادة ${subject} ${typePart} ${lessonPart}.
${stageNote}
${VARIANT_NOTE}

القيود الإلزامية:
- ابدئي كل خطوة بصيغة زمنية: "الدقيقة 0–5: …".
- "goals": قابلة للقياس (فعل سلوكي + معيار %/عدد/زمن).
- "assessment": أدوات عملية + "روبرك مختصر" (3 مستويات بمؤشرات).
- اربطي بمستويات بلوم داخل "bloom".
- "diff_support/core/challenge": منتجات Observable لكل مستوى.
- "materials": عناصر محددة مفصولة بـ "؛ ".
- "examples": لا تكرر خطوات التنفيذ.
- "expected_impact": مؤشرات نجاح (%/عدد/زمن).

أرسلي فقط JSON بالمخطط التالي واملئي جميع الحقول:
- goals: 3–6
- steps: 4–8 (تبدأ بـ "الدقيقة X–Y")
- examples: 2–4
- بلا أي نص خارج JSON. لغة عربية دقيقة ومختصرة.`;

  // ==== Schema ====
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

  // ==== Helpers ====
  const sleep = (ms)=> new Promise(r=>setTimeout(r, ms));

  // تحويل الأرقام العربية إلى لاتينية للّازم regex
  function arabicDigitsToLatin(s=""){
    return s.replace(/[٠-٩]/g, (d)=> "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  }

  // تنقية ومحاولة استخراج JSON حتى لو كان داخل ``` أو فيه فواصل زائدة
  function tryParseJsonSmart(text=""){
    let t = text.trim();

    // إزالة code fences
    t = t.replace(/^```json/i, "```").replace(/^```/, "").replace(/```$/, "").trim();

    // محاولة استخراج أول كائن بين { ... } بتوازن بسيط للأقواس
    const i = t.indexOf("{");
    const j = t.lastIndexOf("}");
    if (i !== -1 && j !== -1 && j > i) {
      t = t.slice(i, j + 1);
    }

    // إصلاح فواصل زائدة " ,\n}" → " }"
    t = t.replace(/,\s*([}\]])/g, "$1");
    // توحيد علامات اقتباس غريبة
    t = t.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

    // استبدال أرقام عربية
    t = arabicDigitsToLatin(t);

    try { return JSON.parse(t); }
    catch { return null; }
  }

  const MIN = { goals:3, steps:4, examples:2 };
  const STEP_RE = /الدقيقة\s*[0-9]+\s*[-–]\s*[0-9]+/;

  function isEmptyStr(s){ return !s || !String(s).trim(); }
  function isComplete(d){
    if (!d) return false;
    const must = ["strategy_name","bloom","importance","materials","assessment","diff_support","diff_core","diff_challenge","expected_impact"];
    for (const k of must) if (isEmptyStr(d[k])) return false;
    for (const k of ["goals","steps","examples","citations"]) if (!Array.isArray(d[k])) return false;
    if (d.goals.length   < MIN.goals) return false;
    if (d.steps.length   < MIN.steps) return false;
    if (d.examples.length< MIN.examples) return false;
    for (const c of d.citations) if (!c || isEmptyStr(c.title) || isEmptyStr(c.benefit)) return false;
    if (!d.steps.every(s => STEP_RE.test(arabicDigitsToLatin(String(s))))) return false;
    return true;
  }

  function makeReqBody(promptText){
    return {
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
        candidateCount: 1,
        maxOutputTokens: 1200,
        temperature: 0.55,
        topK: 32,
        topP: 0.9
      },
      safetySettings: []
    };
  }

  const urlFor = (m)=> `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${API_KEY}`;

  async function callOnce(model, promptText){
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("timeout")), TIMEOUT_MS);
    try {
      const res = await fetch(urlFor(model), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(makeReqBody(promptText)),
        signal: controller.signal
      });
      const text = await res.text();
      if (!res.ok) { const e = new Error(`HTTP ${res.status}`); e.status = res.status; e.body = text.slice(0,1500); throw e; }

      // الطبقة 1: JSON خارجي
      let outer;
      try { outer = JSON.parse(text); }
      catch { const e = new Error("Bad JSON from API"); e.status = 502; e.body = text.slice(0,1500); throw e; }

      // الطبقة 2: المحتوى الداخلي
      const raw = outer?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

      // جرّب parse مباشر
      let data = null;
      try { data = JSON.parse(raw); } catch { data = tryParseJsonSmart(raw); }

      // لو فشل، رجّع مع “raw” ليستعمل في إصلاح ذاتي
      return { data, raw };
    } finally { clearTimeout(timer); }
  }

  function makeRepairPrompt(prevRaw){
    const trimmed = (prevRaw || "").slice(0, 5000);
    return `${BASE_PROMPT}

الاستجابة السابقة كانت ناقصة/غير صالحة JSON. هذا ما أرسلتيه:
<RAW>
${trimmed}
</RAW>

رجاءً أرسلي الآن **JSON مكتمل وصحيح** يطابق الـschema، ويبدأ كل عنصر في steps بـ "الدقيقة X–Y".
لا تضيفي أي نص خارج JSON.`;
  }

  // ==== Diagnostics (اختياري) ====
  if (diag === true) {
    try {
      const model = FALLBACKS[0];
      const test = await fetch(urlFor(model), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(makeReqBody('{"ping":true}')),
      }).then(r=>r.status);
      return {
        statusCode: 200,
        headers: { "content-type":"application/json; charset=utf-8", "Access-Control-Allow-Origin":"*" },
        body: JSON.stringify({ ok:true, model, status:test })
      };
    } catch (e) {
      return {
        statusCode: e.status || 500,
        headers: { "Access-Control-Allow-Origin":"*" },
        body: `DIAG ERROR: ${e.status || ""} :: ${e.body || e.message}`
      };
    }
  }

  // ==== Main loop ====
  for (const MODEL of FALLBACKS) {
    let attempt = 0;
    let promptText = BASE_PROMPT;
    let lastRaw = null;

    while (attempt <= RETRIES + 1) { // +1 للإصلاح الذاتي
      try {
        const { data, raw } = await callOnce(MODEL, promptText);
        lastRaw = raw;

        if (isComplete(data)) {
          data._meta = { stage: stage||"", subject: subject||"", bloomType: bloomType||"", lesson: lesson||"", variant: variant||null, model: MODEL };
          return {
            statusCode: 200,
            headers: { "content-type":"application/json; charset=utf-8", "Access-Control-Allow-Origin":"*" },
            body: JSON.stringify(data)
          };
        }

        // محاولة إصلاح ذاتي مرّة واحدة فقط
        if (attempt === 0) {
          promptText = makeRepairPrompt(raw);
          attempt++;
          await sleep(BACKOFF_MS);
          continue;
        }

        // غير مكتمل بعد الإصلاح → جرّبي موديل ثاني
        break;

      } catch (e) {
        // لو 403 على pro أو rate-limit… ننتقل لفولباك التالي
        if (![429,500,502,503,504,403].includes(e.status || 0)) {
          // أخطاء أخرى: انتقلي للموديل التالي
        }
        break;
      }
    }
  }

  // فشل كل شيء
  return {
    statusCode: 502,
    headers: { "content-type":"text/plain; charset=utf-8", "Access-Control-Allow-Origin":"*" },
    body: "Model returned incomplete JSON after retries."
  };
};
