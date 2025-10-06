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

  // إعدادات من متغيّرات البيئة
  const API_KEY     = process.env.GEMINI_API_KEY;
  const PRIMARY     = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const FALLBACKS   = (process.env.GEMINI_FALLBACKS || "gemini-1.5-flash-8b,gemini-1.5-flash-latest,gemini-1.5-pro")
                        .split(",").map(s=>s.trim()).filter(Boolean);
  const MODELS      = [PRIMARY, ...FALLBACKS];

  const TIMEOUT_MS  = +(process.env.TIMEOUT_MS || 23000);
  const MAX_RETRIES = +(process.env.RETRIES || 2);        // إعادة المحاولة داخل نفس الموديل
  const BACKOFF_MS  = +(process.env.BACKOFF_MS || 700);

  if (!API_KEY) return { statusCode: 500, body: "Missing GEMINI_API_KEY" };

  // توصيف المرحلة (يؤثر على نبرة الاستراتيجية)
  const STAGE_HINT = {
    "primary-lower": "ابتدائي دنيا (أعمار 6–9)، أنشطة حسية قصيرة، لغة بسيطة جداً، أمثلة من الحياة اليومية.",
    "primary-upper": "ابتدائي عليا (أعمار 10–12)، تعليم بنائي، أمثلة ملموسة وتمثيل بصري.",
    "middle":        "متوسط (أعمار 13–15)، تعلّم تعاوني وتدرّج نحو التفكير المجرد.",
    "secondary":     "ثانوي (أعمار 16–18)، تفكير ناقد، تطبيقات واقعية، مصطلحات دقيقة دون تعقيد لغوي."
  };

  // بناء أجزاء البرومبت حسب المدخلات
  const tPart   = (bloomType && bloomType !== "الكل") ? ` (تصنيف بلوم: ${bloomType})` : "";
  const lPart   = lesson ? ` ومناسبة لدرس بعنوان: "${lesson}"` : "";
  const sPart   = stage ? `\nالجمهور: ${STAGE_HINT[stage] || "ثانوي (لغة واضحة وأنشطة مناسبة للعمر)."}` : "";

  // برومبت أساسي مُحكّم — يطلب JSON فقط
  const BASE_PROMPT =
`أنت خبيرة مناهج. أنشئي استراتيجية تدريس لمادة "${subject}"${tPart}${lPart}.
اكتبي **كائن JSON واحد فقط** واملئي جميع الحقول بنص عربي واضح موجز مناسب للعمر، بدون أي نص خارج JSON.

المتطلبات:
- "strategy_name": اسم الاستراتيجية جذاب ودالّ.
- "bloom": صرّحي بالمستوى/المستويات.
- "importance": لماذا هذه الاستراتيجية مفيدة لهذا الدرس وهذه المرحلة.
- "materials": مواد/أدوات محددة قابلة للتجهيز.
- "goals": 3–6 أهداف سلوكية قابلة للقياس (أفعال ملاحظة + معيار نجاح رقمي أو وصفي واضح).
- "steps": 5–8 خطوات عملية مرتبة زمنيًا. يُفضّل البدء بصيغة "الدقيقة X–Y: …".
- "examples": 2–4 أمثلة عملية/مهمات تطبيقية قصيرة.
- "assessment": أدوات تقويم/تذاكر خروج محددة وكيفية الحكم (Rubric مختصر عند الحاجة).
- "diff_support": دعم المتعثرين.
- "diff_core": مستوى أساسي لمعظم الطلاب.
- "diff_challenge": تحديات المتقدمين.
- "expected_impact": أثر متوقع على التعلم.
- "citations": على الأقل مرجعان بصيغة [{"title":"…","benefit":"…"}] توضّح فائدة كل مرجع.

إرشادات الأسلوب:
- جُمَل قصيرة واضحة، مصطلحات دقيقة، دون حشو أو تنميق.
- لا تُكرر عناوين الحقول داخل النص.
${sPart}
`;

  // مخطط الاستجابة (يوجّه الموديل) — لا نعتمد عليه وحده للتحقق
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

  const MIN = { goals:3, steps:2, examples:2 }; // تحقّق مرن (لتفادي الانهيار)

  // أدوات مساعدة
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const isEmptyStr = (s) => !s || !String(s).trim();

  // تحقّق مرن: يكفي اسم الاستراتيجية + وجود مصفوفات أساسية بطول معقول
  function isSoftComplete(d){
    if (!d || isEmptyStr(d.strategy_name)) return false;
    if (!Array.isArray(d.steps)   || d.steps.length   < MIN.steps)   return false;
    if (!Array.isArray(d.goals)   || d.goals.length   < MIN.goals)   return false;
    if (!Array.isArray(d.examples)|| d.examples.length< MIN.examples) return false;
    return true;
  }

  // تحقّق صارم (نستخدمه للحكم "مكتمل تمامًا")
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

  // نادِي Gemini مرة واحدة (مع timeout)
  async function callGeminiOnce(model, promptText){
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("timeout")), TIMEOUT_MS);

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

      let outer;
      try { outer = JSON.parse(txt); }
      catch {
        const err = new Error("Bad JSON (outer) from API");
        err.status = 502; err.body = txt.slice(0, 800);
        throw err;
      }

      const raw = outer?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      let data;
      try { data = JSON.parse(raw); }
      catch {
        // النموذج أرسل نص غير JSON — نُرجعه كـ raw
        return { ok:false, rawText: raw, data: null };
      }

      return { ok:true, rawText: raw, data };
    } finally {
      clearTimeout(timer);
    }
  }

  // إصلاح ذاتي: إعادة صياغة مع تضمين الاستجابة السابقة
  function repairPrompt(prevRaw){
    return `${BASE_PROMPT}

الاستجابة السابقة كانت غير صالحة/ناقصة. هذا هو النص الذي أرسلتيه:
<<<
${prevRaw}
<<<

أعيدي الإرسال الآن كـ **JSON واحد مكتمل وصالح** يطابق الحقول المطلوبة أعلاه، بدون أي نص خارج JSON.`;
  }

  // حلقة التنفيذ عبر الموديلات + محاولات لكل موديل
  let finalStrict = null;      // مكتمل تمامًا
  let finalSoft   = null;      // مكتمل جزئيًا (يكفي للعرض)
  let finalRaw    = "";        // للنص الخام لأقرب محاولة مفيدة
  let usedModel   = "";

  for (const model of MODELS) {
    let promptText = BASE_PROMPT;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const resp = await callGeminiOnce(model, promptText);
        if (resp.ok && resp.data) {
          const d = resp.data;
          finalRaw = resp.rawText;
          usedModel = model;

          if (isStrictComplete(d)) { finalStrict = d; break; }
          if (isSoftComplete(d))   { finalSoft   = d; }

          // غير مكتمل: حضّري محاولة إصلاح
          promptText = repairPrompt(resp.rawText);
          await sleep(BACKOFF_MS * (attempt + 1));
          continue;
        } else {
          // raw نصّي؛ جرّبي إصلاح
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
        // خطأ غير قابل للاسترجاع داخل هذا الموديل — انتقل للذي يليه
        break;
      }
    }
    if (finalStrict) break; // وجدنا مكتملًا — نخرج مبكرًا
  }

  // تجهيز الاستجابات بحسب الحالة
  const commonHeaders = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  };

  // لو مكتمل تمامًا
  if (finalStrict) {
    finalStrict._meta = {
      model: usedModel,
      subject: subject || "",
      stage: stage || "",
      bloomType: bloomType || "",
      lesson: lesson || "",
      variant: variant || ""
    };
    return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(finalStrict) };
  }

  // لو عندنا ناتج جزئي صالح للعرض — رجّعه مع debug
  if (finalSoft) {
    finalSoft._meta = {
      model: usedModel,
      subject: subject || "",
      stage: stage || "",
      bloomType: bloomType || "",
      lesson: lesson || "",
      variant: variant || ""
    };
    const debugPayload = {
      debug: "incomplete",
      parsed: finalSoft,
      rawText: finalRaw || ""
    };
    return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(debugPayload) };
  }

  // لا مكتمل ولا جزئي — رجّع رسالة واضحة (تلتقطها واجهتك وتعرض صندوق التشخيص)
  const failMsg = "Model returned incomplete JSON after retries";
  const debugFail = { debug: "incomplete", parsed: null, rawText: finalRaw || "", message: failMsg };
  return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(debugFail) };
};
