// netlify/functions/gemini-ethraa.js
exports.handler = async (event) => {
  // نسمح فقط بـ POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // نقرأ جسم الطلب بأمان
  let payload = {};
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: "Bad JSON body" }; }

  const { subject, stage, focus = "auto", lesson } = payload;

  // إعدادات من متغيّرات البيئة (نفس أسلوب strategy.js)
  const API_KEY     = process.env.GEMINI_API_KEY;
  const PRIMARY     = process.env.GEMINI_MODEL || "gemini-1.5-pro";
  const FALLBACKS   = (process.env.GEMINI_FALLBACKS || "gemini-1.5-flash,gemini-1.5-flash-8b,gemini-1.5-flash-latest")
                        .split(",").map(s=>s.trim()).filter(Boolean);
  const MODELS      = [PRIMARY, ...FALLBACKS];

  const TIMEOUT_MS  = +(process.env.TIMEOUT_MS || 23000);
  const MAX_RETRIES = +(process.env.RETRIES || 2);
  const BACKOFF_MS  = +(process.env.BACKOFF_MS || 700);

  if (!API_KEY) return { statusCode: 500, body: "Missing GEMINI_API_KEY" };
  if (!subject)  return { statusCode: 400, body: "Missing subject" };

  // توصيف المرحلة (لتلطيف الأسلوب)
  const STAGE_HINT = {
    p1: "ابتدائي دنيا (6–9): لغة شديدة البساطة وأنشطة حسية قصيرة وآمنة.",
    p2: "ابتدائي عليا (10–12): أمثلة ملموسة وتمثيل بصري وخطوات قليلة.",
    m:  "متوسط (13–15): تطبيقات سريعة، تمهيد للمجرد، مصطلحات مبسطة.",
    h:  "ثانوي (16–18): دقة علمية مختصرة، تجارب/عروض قصيرة آمنة."
  };
  const stageNote = STAGE_HINT[stage] || "ملاءمة لغوية وعملية للعمر الدراسي.";

  // نافذة الزمن للمستجدات
  const now = new Date();
  const since = `${now.getFullYear()-1}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;

  // ========= برومبت أساسي مُحكّم — JSON فقط =========
  const BASE_PROMPT =
`أنتِ مُثرية دروس باللغة العربية.
أعيدي **كائن JSON واحد فقط** وفق الشكل:
{
 "cards":[
   {
     "title":"...",          // عنوان موجز ودقيق (مثال: "خرافة: الإلكترونات تدور كالكواكب")
     "brief":"...",          // شرح/تصحيح علمي صحيح مختصر أو لماذا المعلومة مهمّة تربويًا
     "idea":"...",           // خطوات تنفيذ مباشرة قابلة للتطبيق في 3–5 نقاط (تعليمات عملية فقط)
     "source":"https://...", // مصدر موثوق مختصر إن توفر (وإلا اتركيه فارغًا "")
     "evidence_date":"YYYY-MM-DD" // تاريخ حديث مستدل من المصدر إن وُجد (وإلا null)
   }
 ]
}

- المطلوب 3 إلى 6 بطاقات غير مكررة وذات محتوى **صحيح** وجاهز للتنفيذ.
- امنعي الأسئلة/التوجيهات المفتوحة (مثل: ناقشي، تخيّلي، فكّري، ماذا لو؟). اكتبِي في "idea" **أوامر تنفيذية** (اِعرضي/ثبّتي/شغّلي/الصقي/قصّي/اكتبي/قيسي/صوّري...).
- اجعلي التنفيذ قصيرًا وآمنًا (5–10 دقائق) وبأسلوب مناسب للمرحلة: ${stageNote}
- المادة: "${subject}".
${lesson ? `- إن أمكن، أربطي ضمنيًا بدرس "${lesson}" دون تكرار عنوانه حرفيًا.` : ""}
- إن تعذر وجود مصدر حديث اتركي "source":"" و "evidence_date": null.
- **لا** تكتبي أي نص خارج JSON.`.trim();

  // ========= قوالب بحسب التركيز =========
  const Q = {
    latest: (s)=>`أريد بطاقات عن **أحدث مستجدات** "${s}" منذ ${since}.
لكل بطاقة: عنوان دقيق، موجز تربوي، وخطوات تنفيذ عملية قصيرة تُظهر الفكرة (عرض/تجربة آمنة/ورقة سريعة).`,
    myth:   (s)=>`أريد بطاقات **خرافات شائعة وتصحيحها** في "${s}".
العنوان يبدأ بـ "خرافة: …". "brief" يقدم التصحيح العلمي الصحيح بإيجاز. "idea" يبيّن خطوات عملية تُظهر الدليل أو المثال المصحّح (لا أسئلة مفتوحة).`,
    odd:    (s)=>`أريد بطاقات **حقائق مدهشة وموثوقة** في "${s}" مع تفسير صحيح مختصر وخطوات تنفيذ قصيرة تُبرهن الحقيقة (تجربة آمنة/عرض سريع).`,
    ideas:  (s)=>`أريد بطاقات **أفكار إثرائية عملية جاهزة** لمادة "${s}" بخطوات مواد→تحضير→تنفيذ واضحة، ومخرجات قابلة للملاحظة خلال 5–10 دقائق.`
  };
  const PIPELINES = {
    latest: [Q.latest, Q.myth, Q.odd, Q.ideas],
    myth:   [Q.myth,   Q.latest, Q.odd, Q.ideas],
    odd:    [Q.odd,    Q.latest, Q.myth, Q.ideas],
    ideas:  [Q.ideas,  Q.latest, Q.myth, Q.odd],
    auto:   [Q.myth,   Q.latest, Q.odd,  Q.ideas] // نُفضّل الخرافات أولاً بطلبك
  };
  const templates = PIPELINES[focus] || PIPELINES.auto;

  // ========= مخطط الاستجابة (توجيه) =========
  const responseSchema = {
    type: "OBJECT",
    required: ["cards"],
    properties: {
      cards: {
        type: "ARRAY",
        minItems: 3, maxItems: 6,
        items: {
          type: "OBJECT",
          required: ["title","brief","idea","source","evidence_date"],
          properties: {
            title:         { type: "STRING" },
            brief:         { type: "STRING" },
            idea:          { type: "STRING" },
            source:        { type: "STRING" },
            evidence_date: { type: ["STRING","NULL"] }
          }
        }
      }
    }
  };

  // ========= أدوات مساعدة =========
  const sleep = (ms) => new Promise(r=>setTimeout(r,ms));
  const badIdeaRe = /(ناقشي|ناقش|تخي|تخيّلي|فكري|فكر|ماذا لو|تحاور|انعكاس|تبادل الآراء|افتحي نقاش|ask|discuss|brainstorm)/i;
  const isEmpty = (s)=>!s||!String(s).trim();

  function clampCards(arr){
    if(!Array.isArray(arr)) return [];
    const seen = new Set(), out=[];
    for(const c of arr){
      const t=String(c?.title||"").trim();
      const b=String(c?.brief||"").trim();
      const i=String(c?.idea||"").trim();
      if(!t||!b||!i) continue;
      if (badIdeaRe.test(i)) continue; // نحذف البطاقات التي تحتوي أسئلة/نقاشات مفتوحة
      const key=(t+"|"+i).toLowerCase();
      if(seen.has(key)) continue;
      seen.add(key);
      out.push({
        title:t,
        brief:b,
        idea:i,
        source:String(c?.source||"").trim(),
        evidence_date:c?.evidence_date??null
      });
      if(out.length>=6) break;
    }
    return out;
  }

  function softComplete(d){
    if(!d||!Array.isArray(d.cards)) return false;
    const c = clampCards(d.cards);
    return c.length>=3;
  }

  function strictComplete(d){
    if(!d||!Array.isArray(d.cards)) return false;
    const c = clampCards(d.cards);
    if(c.length<3) return false;
    // كل بطاقة: فكرة تنفيذية بدون عبارات مفتوحة
    return c.every(x=>!badIdeaRe.test(x.idea) && !isEmpty(x.title) && !isEmpty(x.brief) && !isEmpty(x.idea));
  }

  function stripFence(txt){
    return String(txt||"")
      .replace(/^\s*```json/i,"").replace(/^\s*```/i,"").replace(/```$/,"").trim();
  }

  // نادِي Gemini مرة واحدة (مع timeout) – نفس أسلوب strategy.js
  async function callGeminiOnce(model, promptText){
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(new Error("timeout")), TIMEOUT_MS);
    try{
      const res = await fetch(url,{
        method:"POST",
        headers:{ "content-type":"application/json" },
        body: JSON.stringify({
          contents:[{ role:"user", parts:[{ text: promptText }] }],
          generationConfig:{
            responseMimeType:"application/json",
            responseSchema,
            candidateCount:1,
            maxOutputTokens: 1536,
            temperature: 0.45
          }
        }),
        signal: controller.signal
      });

      const txt = await res.text();
      if(!res.ok){
        const err = new Error(`HTTP ${res.status}`); err.status=res.status; err.body=txt.slice(0,800);
        throw err;
      }
      let outer;
      try{ outer = JSON.parse(txt); }
      catch{ return { ok:false, rawText: txt, data:null }; }

      const raw = outer?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      let data;
      try{ data = JSON.parse(stripFence(raw)); }
      catch{ return { ok:false, rawText: raw, data:null }; }

      return { ok:true, rawText: raw, data };
    } finally {
      clearTimeout(timer);
    }
  }

  // إصلاح ذاتي
  function repairPrompt(prevRaw){
    return `${BASE_PROMPT}

الاستجابة السابقة غير صالحة/ناقصة. هذا ما أرسلتيه:
<<<
${stripFence(prevRaw)}
<<<

أعيدي الإرسال الآن كـ **JSON واحد مكتمل وصالح** يحتوي 3–6 بطاقات بمحتوى صحيح وخطوات تنفيذية مباشرة فقط.`;
  }

  // ========= حلقة التنفيذ عبر الموديلات + القوالب =========
  let finalStrict=null, finalSoft=null, finalRaw="", usedModel="";

  for(const model of MODELS){
    for(const tmpl of templates){
      let promptText = `${BASE_PROMPT}\n\n${tmpl(subject)}`.trim();
      for(let attempt=0; attempt<=MAX_RETRIES; attempt++){
        try{
          const resp = await callGeminiOnce(model, promptText);
          if(resp.ok && resp.data){
            finalRaw = resp.rawText; usedModel=model;
            if(strictComplete(resp.data)){ finalStrict = resp.data; break; }
            if(softComplete(resp.data)){ finalSoft = resp.data; }
            // إعادة إصلاح
            promptText = repairPrompt(resp.rawText);
            await sleep(BACKOFF_MS * (attempt+1));
            continue;
          }else{
            finalRaw = resp.rawText;
            promptText = repairPrompt(resp.rawText);
            await sleep(BACKOFF_MS * (attempt+1));
            continue;
          }
        }catch(err){
          const status = err.status || 0;
          const isTimeout = /timeout|AbortError/i.test(String(err?.message));
          const retriable = isTimeout || [429,500,502,503,504].includes(status);
          if(retriable && attempt < MAX_RETRIES){
            await sleep(BACKOFF_MS * (attempt+1));
            continue;
          }
          break; // انتقل للقالب التالي أو الموديل التالي
        }
      }
      if(finalStrict) break;
    }
    if(finalStrict) break;
  }

  // ========= الاستجابات =========
  const headers = { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" };

  // مكتمل صارم
  if(finalStrict){
    // تنظيف البطاقات + إلحاق الميتا
    const cards = clampCards(finalStrict.cards);
    const bodyOut = { ok:true, cards, _meta:{ model: usedModel, subject, stage: stage||"", focus, lesson: lesson||"", count: cards.length } };
    return { statusCode: 200, headers, body: JSON.stringify(bodyOut) };
  }

  // جزئي صالح للعرض
  if(finalSoft){
    const cards = clampCards(finalSoft.cards);
    const debugPayload = {
      debug: "incomplete",
      parsed: { ok:true, cards, _meta:{ model: usedModel, subject, stage: stage||"", focus, lesson: lesson||"", count: cards.length } },
      rawText: finalRaw || ""
    };
    return { statusCode: 200, headers, body: JSON.stringify(debugPayload) };
  }

  // فشل
  const failMsg = "Model returned incomplete JSON after retries";
  const debugFail = { debug:"incomplete", parsed:null, rawText: finalRaw || "", message: failMsg };
  return { statusCode: 200, headers, body: JSON.stringify(debugFail) };
};
