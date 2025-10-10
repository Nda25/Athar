// netlify/functions/strategy.js
// توليد استراتيجية + اقتراحات جاهزة (bonus_strategies) مناسبة للعمر
// يعتمد على Gemini (JSON فقط) مع محاولات وإصلاح، ويضيف مكتبة محلية لضمان اقتراحات ثرية.

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let payload = {};
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: "Bad JSON body" }; }

  const {
    stage,           // "primary-lower" | "primary-upper" | "middle" | "secondary"
    subject,         // مادة
    bloomType,       // "الكل" أو مستوى محدد
    lesson,          // عنوان الدرس (اختياري)
    variant,         // seed اختياري
    extraCount = 4,  // عدد الاقتراحات الإضافية المرغوب (3-5 مقترح)
  } = payload;

  const API_KEY     = process.env.GEMINI_API_KEY;
  const PRIMARY     = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const FALLBACKS   = (process.env.GEMINI_FALLBACKS || "gemini-1.5-flash-8b,gemini-1.5-pro")
                        .split(",").map(s=>s.trim()).filter(Boolean);
  const MODELS      = [PRIMARY, ...FALLBACKS];

  const TIMEOUT_MS  = +(process.env.TIMEOUT_MS || 30000);
  const MAX_RETRIES = +(process.env.RETRIES || 3);
  const BACKOFF_MS  = +(process.env.BACKOFF_MS || 800);

  if (!API_KEY) return { statusCode: 500, body: "Missing GEMINI_API_KEY" };

  /* ===== توصيف المرحلة ===== */
  const STAGE_HINT = {
    "primary-lower": "ابتدائي دنيا (6–9): لغة شديدة البساطة، أنشطة حسية هادئة، زمن قصير.",
    "primary-upper": "ابتدائي عليا (10–12): أمثلة ملموسة، تمثيل بصري، تعاون بسيط.",
    "middle":        "متوسط (13–15): تعاون منظم، انتقال للتجريد، نقاش موجّه.",
    "secondary":     "ثانوي (16–18): تطبيقات واقعية، مصطلحات أدق، تفكير ناقد."
  };

  /* ===== مكتبة اقتراحات جاهزة حسب المرحلة ===== */
  const LIB = [
    // مناسبة لكل المراحل مع فروقات لفظية بسيطة
    {
      name: "مخطط فن (Venn)",
      fit: ["primary-upper","middle","secondary"],
      time: "8–12 د",
      when_to_use: "للمقارنة بين مفهومين أو حالتين أو طريقتين.",
      steps: [
        "قسّمي الصف إلى ثنائيات أو مجموعات صغيرة.",
        "ارسمي دائرتين متداخلتين على ورقة أو على السبورة.",
        "اطلبي من الطالبات كتابة أوجه الشبه في المنتصف والاختلاف في الجانبين.",
        "شاركي نموذجًا سريعًا ثم اعطي 3 دقائق للعرض الشفهي."
      ]
    },
    {
      name: "السبب والنتيجة",
      fit: ["primary-upper","middle","secondary"],
      time: "6–10 د",
      when_to_use: "لتتبّع أثر تغيّر متغير أو حدث على نتائج الدرس.",
      steps: [
        "وزّعي مخطط سبب←نتيجة (سهم واحد أو سلسلة قصيرة).",
        "اختاري مثالًا من الدرس وحدّدي السبب مع المجموعة.",
        "املئي نتيجتين محتملتين، ثم اختاري الأرجح ولماذا.",
        "تذكرة خروج: اكتبي سببًا جديدًا ونتيجته المتوقعة."
      ]
    },
    {
      name: "نداء الأرقام (Numbered Heads Together)",
      fit: ["primary-upper","middle","secondary"],
      time: "7–10 د",
      when_to_use: "لضمان مشاركة الجميع وتوزيع الأدوار.",
      steps: [
        "قسّمي كل مجموعة إلى 4 أدوار مرقّمة (1–4).",
        "اطرحي سؤالًا تطبيقيًا قصيرًا وامنحي 2–3 دقائق للنقاش.",
        "انادي رقمًا عشوائيًا؛ يقف نفس الرقم من كل مجموعة ويقدّم الإجابة.",
        "دوّري الأدوار في السؤال التالي حفاظًا على العدالة."
      ]
    },
    {
      name: "فكّر–شارك–ناقش (Think–Pair–Share)",
      fit: ["primary-upper","middle","secondary"],
      time: "5–8 د",
      when_to_use: "لتفعيل الفهم المبدئي أو مراجعة سريعة.",
      steps: [
        "سؤال مركّز؛ دقيقة تفكير فردي صامت.",
        "دقيقتان مشاركة مع زميلة واحدة.",
        "عرض 2–3 ثنائيات مختارة بسرعة على الصف."
      ]
    },
    // مفضّلة للابتدائي دُنيا
    {
      name: "صور متسلسلة",
      fit: ["primary-lower","primary-upper"],
      time: "6–8 د",
      when_to_use: "لبناء فهم ترتيبي لعملية/دورة.",
      steps: [
        "اعرضي 3–4 صور مرتبة عشوائيًا على السبورة.",
        "اطلبي ترتيبها منطقيًا مع جملة بسيطة لكل خطوة.",
        "اسألي: ماذا يحدث لو حذفنا خطوة؟ (نتيجة متوقعة)."
      ]
    },
    {
      name: "KWL (أعرف–أريد أن أعرف–تعلمت)",
      fit: ["primary-lower","primary-upper"],
      time: "6–10 د",
      when_to_use: "لتهيئة الدرس وقياس التعلّم بعده.",
      steps: [
        "اعملي جدول 3 أعمدة على السبورة.",
        "أكملي خانتي (أعرف/أريد) شفهيًا بسرعة.",
        "بعد النشاط الرئيس، املؤوا (تعلمت) بجمل قصيرة."
      ]
    },
    // للمتوسط/الثانوي
    {
      name: "المربعات الأربع (Four Corners)",
      fit: ["middle","secondary"],
      time: "10–12 د",
      when_to_use: "لاستكشاف مواقف/فرضيات متعددة.",
      steps: [
        "اربطي كل زاوية بخيار/رأي/فرضية.",
        "اطلبي من كل طالبة الوقوف في الزاوية التي تمثل رأيها.",
        "منح 1–2 دقيقة لتحضير تبرير مختصر.",
        "مشاركة 2 ممثلات من كل زاوية."
      ]
    },
    {
      name: "نموذج فراير (Frayer Model)",
      fit: ["middle","secondary"],
      time: "8–12 د",
      when_to_use: "لتعميم مصطلح: تعريف، خصائص، أمثلة، لاأمثلة.",
      steps: [
        "قسّمي الورقة إلى 4 مربعات.",
        "املئي الخانات مع أمثلة من سياق الدرس.",
        "المشاركة السريعة: بطاقة من كل مجموعة."
      ]
    },
    {
      name: "جولة المعرض (Gallery Walk)",
      fit: ["middle","secondary"],
      time: "12–15 د",
      when_to_use: "لعرض منتجات قصيرة ومقارنة الحلول.",
      steps: [
        "علّقي أوراق/شرائح مختصرة في أنحاء الصف.",
        "جولات 2–3 دقائق لكل محطة مع لاصق تعليقات.",
        "نقاش ختامي عن أفضل الحلول ولماذا."
      ]
    }
  ];

  const fitFor = (st) => (s) => (s.fit || []).includes(st);
  const dedupByName = (arr) => {
    const seen = new Set(); const out = [];
    for (const x of arr) {
      const k = String(x.name || "").trim().toLowerCase();
      if (!k || seen.has(k)) continue;
      seen.add(k); out.push(x);
    }
    return out;
  };

  const tPart = (bloomType && bloomType !== "الكل") ? ` (تصنيف بلوم: ${bloomType})` : "";
  const lPart = lesson ? ` ومناسبة لدرس بعنوان: "${lesson}"` : "";
  const sPart = stage ? `\nالجمهور: ${STAGE_HINT[stage] || "ثانوي (لغة واضحة وأنشطة مناسبة للعمر)."}` : "";

  /* ===== برومبت أساسي يطلب JSON + bonus_strategies ===== */
  const BASE_PROMPT =
`أنت خبيرة مناهج. أنشئي استراتيجية تدريس لمادة "${subject}"${tPart}${lPart}.
اكتبي **كائن JSON واحد فقط** واملئي جميع الحقول بنص عربي واضح موجز مناسب للعمر، بدون أي نص خارج JSON.

المتطلبات:
- "strategy_name": اسم الاستراتيجية جذاب ودالّ.
- "bloom": صرّحي بالمستوى/المستويات.
- "importance": لماذا هذه الاستراتيجية مفيدة لهذا الدرس وهذه المرحلة.
- "materials": مواد/أدوات محددة قابلة للتجهيز.
- "goals": 3–6 أهداف سلوكية قابلة للقياس (أفعال ملاحظة + معيار نجاح).
- "steps": 5–8 خطوات عملية مرتبة زمنيًا (يفضل "الدقيقة X–Y: …").
- "examples": 2–4 أمثلة تطبيقية قصيرة.
- "assessment": أدوات تقويم/تذكرة خروج وكيفية الحكم (Rubric مختصر عند الحاجة).
- "diff_support": دعم المتعثرين.  "diff_core": المستوى الأساسي.  "diff_challenge": تحديات المتقدمين.
- "expected_impact": أثر متوقع على التعلم.
- "citations": على الأقل مرجعان [{"title":"…","benefit":"…"}].

بالإضافة إلى ذلك:
- "bonus_strategies": مصفوفة 3–5 عناصر من اقتراحات قصيرة، كل عنصر بشكل:
  { "name":"...", "why":"متى نستخدمها", "time":"...", "steps":["...", "..."] }
  يجب أن تكون **مناسبة تمامًا للفئة** المذكورة، ودون تكرار للأفكار.

إرشادات الأسلوب:
- جُمَل قصيرة واضحة، مصطلحات دقيقة، دون حشو أو تنميق.
- لا تُكرر عناوين الحقول داخل النص.
${sPart}
`;

  /* ===== مخطط الاستجابة (غير مُلزم لكن يعين النموذج) ===== */
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
      goals:          { type: "ARRAY", items: { type: "STRING" }, minItems: 3 },
      steps:          { type: "ARRAY", items: { type: "STRING" }, minItems: 5 },
      examples:       { type: "ARRAY", items: { type: "STRING" }, minItems: 2 },
      assessment:     { type: "STRING" },
      diff_support:   { type: "STRING" },
      diff_core:      { type: "STRING" },
      diff_challenge: { type: "STRING" },
      expected_impact:{ type: "STRING" },
      citations:      { type: "ARRAY", items: { type: "OBJECT", required:["title","benefit"],
        properties: { title:{type:"STRING"}, benefit:{type:"STRING"} } } },
      bonus_strategies: { type: "ARRAY", items: { type:"OBJECT",
        properties:{
          name:{type:"STRING"}, why:{type:"STRING"}, time:{type:"STRING"},
          steps:{ type:"ARRAY", items:{type:"STRING"} }
        }
      }}
    }
  };

  const MIN = { goals:3, steps:2, examples:2 };

  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
  const isEmptyStr = (s)=>!s || !String(s).trim();

  function isSoftComplete(d){
    if (!d || isEmptyStr(d.strategy_name)) return false;
    if (!Array.isArray(d.steps)   || d.steps.length   < MIN.steps)   return false;
    if (!Array.isArray(d.goals)   || d.goals.length   < MIN.goals)   return false;
    if (!Array.isArray(d.examples)|| d.examples.length< MIN.examples) return false;
    return true;
  }

  function isStrictComplete(d){
    if (!d) return false;
    const mustStrings = ["strategy_name","bloom","importance","materials","assessment",
      "diff_support","diff_core","diff_challenge","expected_impact"];
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
      if (!res.ok) { const err = new Error(`HTTP ${res.status}`); err.status=res.status; err.body=txt.slice(0,800); throw err; }

      let outer;
      try { outer = JSON.parse(txt); }
      catch { const err = new Error("Bad JSON (outer) from API"); err.status=502; err.body=txt.slice(0,800); throw err; }

      const raw = outer?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      try { return { ok:true, rawText: raw, data: JSON.parse(raw) }; }
      catch { return { ok:false, rawText: raw, data: null }; }
    } finally { clearTimeout(timer); }
  }

  function repairPrompt(prevRaw){
    return `${BASE_PROMPT}

الاستجابة السابقة غير صالحة/ناقصة. هذا نصّك:
<<<
${prevRaw}
<<<
أعيدي الآن **JSON واحدًا صالحًا** يطابق القالب أعلاه فقط.`;
  }

  /* ===== تنفيذ الموديل مع المحاولات ===== */
  let finalStrict = null, finalSoft = null, finalRaw = "", usedModel = "";

  for (const model of MODELS) {
    let promptText = BASE_PROMPT;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const resp = await callGeminiOnce(model, promptText);
        finalRaw = resp.rawText || finalRaw;
        if (resp.ok && resp.data) {
          const d = resp.data; usedModel = model;
          if (isStrictComplete(d)) { finalStrict = d; break; }
          if (isSoftComplete(d))   { finalSoft   = d; }
          promptText = repairPrompt(resp.rawText);
          await sleep(BACKOFF_MS * (attempt + 1));
          continue;
        } else {
          promptText = repairPrompt(resp.rawText);
          await sleep(BACKOFF_MS * (attempt + 1));
        }
      } catch (err) {
        const status = err.status || 0;
        const isTimeout = /timeout|AbortError/i.test(String(err?.message));
        const retriable = isTimeout || [429,500,502,503,504].includes(status);
        if (retriable && attempt < MAX_RETRIES) { await sleep(BACKOFF_MS * (attempt + 1)); continue; }
        break; // انتقل لموديل آخر
      }
    }
    if (finalStrict) break;
  }

  /* ===== دمج واقتراح bonus_strategies مضمونة (مرحلة-ملائمة) ===== */
  function ensureBonus(d) {
    const want = Math.min(Math.max(+extraCount || 4, 3), 5);
    const fromModel = Array.isArray(d?.bonus_strategies) ? d.bonus_strategies : [];
    const cleaned = dedupByName(fromModel).slice(0, want);

    const library = LIB.filter(fitFor(stage || "secondary")).map(x => ({
      name: x.name, why: x.when_to_use, time: x.time, steps: x.steps
    }));

    // اكمل من المكتبة بدون تكرار أسماء
    const names = new Set(cleaned.map(s => String(s.name||"").toLowerCase()));
    for (const s of library) {
      const k = String(s.name||"").toLowerCase();
      if (names.has(k)) continue;
      cleaned.push(s); names.add(k);
      if (cleaned.length >= want) break;
    }
    return cleaned;
  }

  const commonHeaders = { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" };

  if (finalStrict) {
    finalStrict.bonus_strategies = ensureBonus(finalStrict);
    finalStrict._meta = { model: usedModel, subject, stage, bloomType, lesson, variant };
    return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(finalStrict) };
  }

  if (finalSoft) {
    finalSoft.bonus_strategies = ensureBonus(finalSoft);
    finalSoft._meta = { model: usedModel, subject, stage, bloomType, lesson, variant };
    return { statusCode: 200, headers: commonHeaders, body: JSON.stringify({ debug:"incomplete", parsed: finalSoft, rawText: finalRaw || "" }) };
  }

  const fail = { debug:"incomplete", parsed:null, rawText: finalRaw || "", message:"Model returned incomplete JSON after retries" };
  return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(fail) };
};
