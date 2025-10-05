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
  catch { 
    return { 
      statusCode: 400, 
      headers: { "Access-Control-Allow-Origin": "*" },
      body: "Bad JSON body" 
    }; 
  }

  const { stage, subject, bloomType, lesson, variant, diag, tiny } = payload;

  // ==== إعدادات البيئة ====
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return { 
      statusCode: 500, 
      headers: { "Access-Control-Allow-Origin": "*" },
      body: "Missing GEMINI_API_KEY" 
    };
  }

  // استخدمي الألياس الرسمية السريعة
  const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
  const FALLBACKS = [PRIMARY_MODEL, "gemini-flash-latest", "gemini-flash-lite-latest"];

  // مهلة داخلية مناسبة لقيود Netlify
  const TIMEOUT_MS = +(process.env.TIMEOUT_MS || 12000);
  const RETRIES    = +(process.env.RETRIES    || 0);
  const BACKOFF_MS = +(process.env.BACKOFF_MS || 400);

  // ==== أدلة الأسلوب ====
  const STAGE_GUIDE = {
    "primary-lower": `- الفئة: ابتدائي دنيا. لغة بسيطة، أنشطة قصيرة/حركية.`,
    "primary-upper": `- الفئة: ابتدائي عليا. خطوات مرقمة، تعاون بسيط، ربط بالواقع.`,
    "middle":        `- الفئة: متوسط. استقصاء موجه، نقاش، تجارب مصغّرة.`,
    "secondary":     `- الفئة: ثانوي. نقاش نقدي، مشاريع/بحث مختصر.`
  };
  const stageNote  = STAGE_GUIDE[stage] || `- الفئة: عام. صياغة واضحة ومتدرجة.`;
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
  const BASE_PROMPT_FULL =
`أريد استراتيجية تدريس لمادة ${subject} ${typePart} ${lessonPart}.
${stageNote}
${VARIANT_NOTE}

القيود الإلزامية:
- ابدئي كل خطوة بصيغة زمنية: "الدقيقة 0–5: …".
- "goals": قابلة للقياس (فعل سلوكي + معيار %/عدد/زمن).
- "assessment": أدوات عملية + "روبرك مختصر" (3 مستويات بمؤشرات).
- اربط بمستويات بلوم الملائمة داخل "bloom".
- "diff_support/core/challenge": منتجات/أداء observable لكل مستوى.
- "materials": عناصر محددة كسطر واحد مفصول بـ "؛ ".
- "examples": أمثلة جديدة لا تكرر خطوات التنفيذ.
- "expected_impact": مؤشرات نجاح (% إتقان/عدد منتجات/زمن إنجاز).

أرسلي فقط JSON بالمخطط التالي واملئي جميع الحقول:
- goals: 3–6
- steps: 4–8 (تبدأ بـ "الدقيقة X–Y")
- examples: 2–4
- بلا أي نص خارج JSON. لغة عربية دقيقة ومختصرة.`;

  // نسخة خفيفة جدًا للتشخيص/السرعة
  const BASE_PROMPT_TINY =
`أريد مخطط استراتيجية تدريس سريع لمادة ${subject} ${typePart} ${lessonPart}.
${stageNote}

أرسلي **فقط JSON** بهذه الحقول:
{
  "strategy_name": "...",
  "goals": ["هدف قابل للقياس", "هدف قابل للقياس"],
  "steps": ["الدقيقة 0–5: ...", "الدقيقة 5–10: ..."]
}
- لا تضيفي حقول أخرى.
- كل خطوة تبدأ بعبارة "الدقيقة X–Y".
- صياغة عربية مختصرة.`;

  // ==== مخطط الاستجابة ====
  // كامل
  const schemaFull = {
    type: "OBJECT",
    required: [
      "strategy_name","bloom","importance","materials","goals","steps",
      "examples","assessment","diff_support","diff_core","diff_challenge",
      "expected_impact" /* citations أصبحت اختيارية */
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
      // citations اختيارية الآن
      citations:{ type:"ARRAY", items:{ type:"OBJECT", properties:{
        title:{ type:"STRING" }, benefit:{ type:"STRING" }
      }}}
    }
  };

  // خفيف
  const schemaTiny = {
    type: "OBJECT",
    required: ["strategy_name","goals","steps"],
    properties: {
      strategy_name:{ type:"STRING" },
      goals:{ type:"ARRAY", items:{ type:"STRING" }, minItems:2 },
      steps:{ type:"ARRAY", items:{ type:"STRING" }, minItems:2 }
    }
  };

  const responseSchema = tiny ? schemaTiny : schemaFull;

  const sleep = (ms)=> new Promise(r=>setTimeout(r, ms));

  // حدود دنيا ديناميكية حسب النمط
  const MIN = tiny ? { goals:2, steps:2, examples:0 } : { goals:3, steps:4, examples:2 };
  const isEmptyStr = (s)=> !s || !String(s).trim();

  function isComplete(d){
    if (!d) return false;

    if (tiny) {
      if (isEmptyStr(d.strategy_name)) return false;
      if (!Array.isArray(d.goals) || d.goals.length < MIN.goals) return false;
      if (!Array.isArray(d.steps) || d.steps.length < MIN.steps) return false;
      if (!d.steps.every(s => /الدقيقة\s*\d+\s*[-–]\s*\d+/.test(String(s)))) return false;
      return true;
    }

    const must = ["strategy_name","bloom","importance","materials","assessment","diff_support","diff_core","diff_challenge","expected_impact"];
    for (const k of must) if (isEmptyStr(d[k])) return false;
    for (const k of ["goals","steps","examples"]) if (!Array.isArray(d[k])) return false;
    if (d.goals.length    < MIN.goals)    return false;
    if (d.steps.length    < MIN.steps)    return false;
    if (d.examples.length < MIN.examples) return false;
    if (!d.steps.every(s => /الدقيقة\s*\d+\s*[-–]\s*\d+/.test(String(s)))) return false;
    // citations أصبحت اختيارية؛ لا نتحقق منها
    return true;
  }

  function makeReqBody(promptText){
    return {
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
        candidateCount: 1,
        maxOutputTokens: tiny ? 380 : 750,
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
      catch {
        const e = new Error("Bad JSON from API"); 
        e.status = 502; 
        e.body = text.slice(0,300); 
        throw e; 
      }

      const raw = outer?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      // لوق للنص الخام (شوفيه في Netlify logs)
      try { console.log("[strategy][RAW]", raw.slice(0, 500)); } catch {}

      let data;
      try { data = JSON.parse(raw); }
      catch {
        // بدلاً من الفشل: نرجّع الـ RAW للواجهة لتشخيص الكسر
        return { _raw: raw, _model: model };
      }
      return data;
    } finally { clearTimeout(timer); }
  }

  // ==== وضع التشخيص السريع ====
  if (diag === true) {
    try {
      const model = FALLBACKS[0];
      const data = await callOnce(model, 'أرسلي JSON {"ok":true} فقط.');
      return {
        statusCode: 200,
        headers: { "content-type":"application/json; charset=utf-8", "Access-Control-Allow-Origin":"*" },
        body: JSON.stringify({ model, data })
      };
    } catch (e) {
      return {
        statusCode: e.status || 500,
        headers: { "Access-Control-Allow-Origin":"*" },
        body: `DIAG ERROR: ${e.status || ""} :: ${e.body || e.message}`
      };
    }
  }

  // ==== التنفيذ مع fallbacks ====
  const BASE_PROMPT = tiny ? BASE_PROMPT_TINY : BASE_PROMPT_FULL;
  let promptText = BASE_PROMPT;

  for (const MODEL of FALLBACKS) {
    let attempt = 0;
    while (attempt <= RETRIES) {
      try {
        const data = await callOnce(MODEL, promptText);

        // لو رجعنا RAW بدل JSON (كسر في البارسينق) نمرره كما هو للواجهة
        if (data && data._raw) {
          return {
            statusCode: 200,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify(data)
          };
        }

        if (!isComplete(data) && attempt <= RETRIES) {
          attempt++;
          await sleep(BACKOFF_MS * attempt);
          promptText = `${BASE_PROMPT}

الاستجابة السابقة كانت ناقصة/غير عملية. أعِدي إرسال JSON مكتمل فقط.
${tiny ? `- على الأقل (${MIN.goals}) أهداف و(${MIN.steps}) خطوات تبدأ بـ "الدقيقة X–Y".` :
`- (${MIN.goals}) أهداف قابلة للقياس، (${MIN.steps}) خطوات تبدأ بـ "الدقيقة X–Y"، (${MIN.examples}) أمثلة جديدة.`}
لا تضيفي أي نص خارج JSON.`;
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
          variant: variant || null,
          model: MODEL,
          tiny: !!tiny
        };

        return {
          statusCode: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*"
          },
          body: JSON.stringify(data)
        };

      } catch (err) {
        // جرّبي الموديل التالي
        break;
      }
    }
  }

  // ==== فشل نهائي ====
  const msg = "Gateway Timeout: model did not respond in time";
  return {
    statusCode: 504,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: msg
  };
};
