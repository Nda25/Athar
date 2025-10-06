// netlify/functions/gemini-ethraa.js
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let payload = {};
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: "Bad JSON body" }; }

  const { subject, stage, focus = "auto", lesson } = payload;

  const API_KEY     = process.env.GEMINI_API_KEY;
  const PRIMARY     = process.env.GEMINI_MODEL || "gemini-1.5-pro";
  const FALLBACKS   = (process.env.GEMINI_FALLBACKS || "gemini-1.5-flash,gemini-1.5-flash-8b,gemini-1.5-flash-latest")
                        .split(",").map(s=>s.trim()).filter(Boolean);
  const MODELS      = [PRIMARY, ...FALLBACKS];

  const TIMEOUT_MS  = +(process.env.TIMEOUT_MS || 23000);
  const MAX_RETRIES = +(process.env.RETRIES || 2);
  const BACKOFF_MS  = +(process.env.BACKOFF_MS || 700);

  if (!API_KEY)   return { statusCode: 500, body: "Missing GEMINI_API_KEY" };
  if (!subject)   return { statusCode: 400, body: "Missing subject" };

  const STAGE_HINT = {
    p1: "ابتدائي دنيا (6–9): لغة شديدة البساطة وأنشطة حسية قصيرة وآمنة.",
    p2: "ابتدائي عليا (10–12): أمثلة ملموسة وتمثيل بصري وخطوات قليلة.",
    m:  "متوسط (13–15): تطبيقات سريعة، تمهيد للمجرد، مصطلحات مبسطة.",
    h:  "ثانوي (16–18): دقة علمية مختصرة، تجارب/عروض قصيرة آمنة."
  };
  const stageNote = STAGE_HINT[stage] || "ملاءمة لغوية وعملية للعمر الدراسي.";

  const now = new Date();
  const since = `${now.getFullYear()-1}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;

  // ——— برومبت محكّم لكن بلا مبالغة ———
  const BASE_PROMPT = `
أنتِ مُثرية دروس باللغة العربية.
أعيدي **كائن JSON واحد فقط** بهذا الشكل:
{
 "cards":[
   { "title":"...", "brief":"...", "idea":"...", "source":"", "evidence_date": null }
 ]
}
- أعيدي 3 إلى 6 بطاقات **بمحتوى صحيح** وجاهز للتنفيذ (خطوات عملية مباشرة 3–6 نقاط).
- تجنّبي صيَغ الأسئلة المفتوحة المطوّلة؛ اكتبِي تعليمات تنفيذية قصيرة (اعرضي/ثبّتي/شغّلي/قصّي/الصقي/اكتبي/قيسي…).
- المرحلة: ${stageNote} — المادة: "${subject}".
${lesson ? `- إن أمكن، اربطي ضمنيًا بدرس "${lesson}".` : ""}
- إذا لم يتوفر مصدر حديث اتركي "source":"" و"evidence_date": null.
- **لا** تكتبي أي نص خارج JSON.
`.trim();

  // قوالب تركيز
  const Q = {
    latest: (s)=>`بطاقات عن **أحدث مستجدات** "${s}" منذ ${since} مع تنفيذ صفّي قصير يبرهن الفكرة.`,
    myth:   (s)=>`بطاقات **خرافات شائعة وتصحيحها** في "${s}". العنوان يبدأ بـ "خرافة: …". الفكرة تنفيذ عملي قصير يوضح الدليل أو المثال المصحّح.`,
    odd:    (s)=>`بطاقات **حقائق مدهشة وموثوقة** في "${s}" مع تفسير مختصر وتنفيذ آمن سريع يبرهن الحقيقة.`,
    ideas:  (s)=>`بطاقات **أفكار إثرائية عملية وجاهزة** لمادة "${s}" (مواد → تحضير → تنفيذ) خلال 5–10 دقائق.`
  };
  const PIPELINES = {
    latest: [Q.latest, Q.myth, Q.odd, Q.ideas],
    myth:   [Q.myth,   Q.latest, Q.odd, Q.ideas],
    odd:    [Q.odd,    Q.latest, Q.myth, Q.ideas],
    ideas:  [Q.ideas,  Q.latest, Q.myth, Q.odd],
    auto:   [Q.myth,   Q.latest, Q.odd,  Q.ideas]
  };
  const templates = PIPELINES[focus] || PIPELINES.auto;

  // ——— مخطط استجابة أخفّ (نجعل source/evidence_date اختيارية فعليًا) ———
  const responseSchema = {
    type: "OBJECT",
    required: ["cards"],
    properties: {
      cards: {
        type: "ARRAY",
        minItems: 3, maxItems: 6,
        items: {
          type: "OBJECT",
          required: ["title","brief","idea"],              // ← أخف
          properties: {
            title:         { type:"STRING" },
            brief:         { type:"STRING" },
            idea:          { type:"STRING" },
            source:        { type:"STRING" },
            evidence_date: { type:["STRING","NULL"] }
          }
        }
      }
    }
  };

  // أدوات
  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
  const badIdeaRe = /(ناقشي|ناقش|تخي|تخيّلي|brainstorm|حوار مطوّل)/i; // ← أخف من قبل
  const stripFence = (t)=>String(t||"").replace(/^\s*```json/i,"").replace(/^\s*```/i,"").replace(/```$/,"").trim();
  const isEmpty = (s)=>!s||!String(s).trim();

  function normalizeCards(arr){
    if(!Array.isArray(arr)) return [];
    const seen = new Set(), out=[];
    for(const c of arr){
      const t=String(c?.title||"").trim();
      const b=String(c?.brief||"").trim();
      const i=String(c?.idea||"").trim();
      if(!t||!b||!i) continue;
      if(badIdeaRe.test(i)) continue;                  // نحذف فقط الأسوأ
      const key=(t+"|"+i).toLowerCase();
      if(seen.has(key)) continue;
      seen.add(key);
      out.push({
        title:t, brief:b, idea:i,
        source:String(c?.source||"").trim(),
        evidence_date: c?.evidence_date ?? null
      });
      if(out.length>=6) break;
    }
    return out;
  }

  function softComplete(d){
    if(!d||!Array.isArray(d.cards)) return false;
    return normalizeCards(d.cards).length >= 3;
  }
  function strictComplete(d){
    const c = normalizeCards(d?.cards||[]);
    if(c.length < 3) return false;
    return c.every(x => !isEmpty(x.title)&&!isEmpty(x.brief)&&!isEmpty(x.idea));
  }

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
            maxOutputTokens: 1400,
            temperature: 0.5
          }
        }),
        signal: controller.signal
      });
      const txt = await res.text();
      if(!res.ok){ const e=new Error(`HTTP ${res.status}`); e.status=res.status; e.body=txt.slice(0,800); throw e; }
      let outer; try{ outer=JSON.parse(txt); } catch{ return { ok:false, rawText:txt, data:null }; }
      const raw = outer?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      let data;  try{ data=JSON.parse(stripFence(raw)); } catch{ return { ok:false, rawText:raw, data:null }; }
      return { ok:true, rawText:raw, data };
    } finally { clearTimeout(timer); }
  }

  function repairPrompt(prevRaw){
    return `${BASE_PROMPT}

الاستجابة السابقة غير صالحة/ناقصة. هذا ما أرسلتيه:
<<<
${stripFence(prevRaw)}
<<<

أعيدي الإرسال كـ **JSON واحد مكتمل** (3–6 بطاقات) بخطوات تنفيذية قصيرة واضحة فقط.`;
  }

  // التنفيذ عبر قوالب × موديلات × محاولات
  let finalStrict=null, finalSoft=null, finalRaw="", usedModel="";
  for(const model of MODELS){
    for(const tmpl of templates){
      let promptText = `${BASE_PROMPT}\n\n${tmpl(subject)}`.trim();
      for(let attempt=0; attempt<=MAX_RETRIES; attempt++){
        try{
          const resp = await callGeminiOnce(model, promptText);
          if(resp.ok && resp.data){
            finalRaw = resp.rawText; usedModel=model;
            if(strictComplete(resp.data)){ finalStrict=resp.data; break; }
            if(softComplete(resp.data)){ finalSoft=resp.data; }
            promptText = repairPrompt(resp.rawText);
            await sleep(BACKOFF_MS * (attempt+1)); continue;
          } else {
            finalRaw = resp.rawText;
            promptText = repairPrompt(resp.rawText);
            await sleep(BACKOFF_MS * (attempt+1)); continue;
          }
        }catch(err){
          const status = err.status||0;
          const isTimeout = /timeout|AbortError/i.test(String(err?.message));
          const retriable = isTimeout || [429,500,502,503,504].includes(status);
          if(retriable && attempt < MAX_RETRIES){ await sleep(BACKOFF_MS*(attempt+1)); continue; }
          break;
        }
      }
      if(finalStrict) break;
    }
    if(finalStrict) break;
  }

  const headers = { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" };

  if(finalStrict){
    const cards = normalizeCards(finalStrict.cards);
    return { statusCode:200, headers, body: JSON.stringify({ ok:true, cards, _meta:{ model:usedModel, subject, stage:stage||"", focus, lesson:lesson||"", count:cards.length } }) };
  }
  if(finalSoft){
    const cards = normalizeCards(finalSoft.cards);
    const parsed = { ok:true, cards, _meta:{ model:usedModel, subject, stage:stage||"", focus, lesson:lesson||"", count:cards.length } };
    return { statusCode:200, headers, body: JSON.stringify({ debug:"incomplete", parsed, rawText: finalRaw||"" }) };
  }
  const failMsg = "Model returned incomplete JSON after retries";
  return { statusCode:200, headers, body: JSON.stringify({ debug:"incomplete", parsed:null, rawText: finalRaw||"", message: failMsg }) };
};
