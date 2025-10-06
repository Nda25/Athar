// netlify/functions/gemini-ethraa.js
exports.handler = async (event) => {
  // ——— السماح بـ POST فقط ———
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // ——— قراءة جسم الطلب ———
  let payload = {};
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: "Bad JSON body" }; }

  const { subject, stage = "h", focus = "auto", lesson } = payload || {};

  // ——— متغيرات البيئة ———
  const API_KEY     = process.env.GEMINI_API_KEY;
  const PRIMARY     = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const FALLBACKS   = (process.env.GEMINI_FALLBACKS || "gemini-1.5-flash-8b,gemini-1.5-flash-latest,gemini-1.5-pro")
                        .split(",").map(s=>s.trim()).filter(Boolean);
  const MODELS      = [PRIMARY, ...FALLBACKS];

  const TIMEOUT_MS  = +(process.env.TIMEOUT_MS || 23000);
  const MAX_RETRIES = +(process.env.RETRIES || 2);
  const BACKOFF_MS  = +(process.env.BACKOFF_MS || 700);

  if (!API_KEY) return { statusCode: 500, body: "Missing GEMINI_API_KEY" };
  if (!subject) return { statusCode: 400, body: "Missing subject" };

  // ——— تلميح المرحلة ———
  const STAGE_HINT = {
    p1: "ابتدائي دنيا: لغة شديدة البساطة وأنشطة حسية قصيرة (5–7 دقائق).",
    p2: "ابتدائي عليا: أمثلة ملموسة وتمثيلات بصرية مختصرة (6–8 دقائق).",
    m:  "متوسط: خطوات مباشرة ومصطلحات مبسطة وتمهيد للمجرد (7–9 دقائق).",
    h:  "ثانوي: دقة علمية مختصرة وتطبيقات واقعية (8–10 دقائق)."
  };
  const stageLabel = (code) => ({ p1:"ابتدائي دنيا", p2:"ابتدائي عليا", m:"متوسط", h:"ثانوي" }[code] || code || "ثانوي");

  // ——— نافذة زمنية للمستجدات ———
  const now = new Date();
  const since = `${now.getFullYear()-1}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;

  // ——— مخطط الاستجابة (يوجّه النموذج) ———
  const responseSchema = {
    type: "OBJECT",
    required: ["cards"],
    properties: {
      cards: {
        type: "ARRAY",
        minItems: 3,
        maxItems: 6,
        items: {
          type: "OBJECT",
          required: ["title","brief","idea"],
          properties: {
            title:         { type: "STRING" }, // مثال: "خرافة: الإلكترونات تدور كالكواكب"
            brief:         { type: "STRING" }, // تصحيح/تفسير مختصر صحيح أو قيمة تربوية
            idea:          { type: "STRING" }, // خطوات تنفيذ مباشرة (أوامر عملية)
            source:        { type: "STRING" }, // اختياري (URL/مرجع تعليمي موجز)
            evidence_date: { type: "STRING" }  // اختياري (YYYY-MM-DD) أو فارغ
          }
        }
      }
    }
  };

  // ——— برومبت أساس صارم بإخراج JSON فقط ———
  const BASE_SYSTEM =
`أنتِ مساعدة إثرائية عربية للمعلمين. أعيدي **كائن JSON واحد فقط** بهذه البنية:
{
 "cards":[
   {"title":"...", "brief":"...", "idea":"...", "source":"", "evidence_date":""}
 ]
}
- أعيدي 3–6 بطاقات غير مكررة.
- اجعلي "idea" خطوات تنفيذية مباشرة (أوامر عملية موجزة 1–5 خطوات)، وتجنبي الأسئلة المفتوحة أو "ناقشي/تخيلي".
- راعي المرحلة: ${STAGE_HINT[stage] || "ثانوي: دقة مختصرة وتطبيق واقعي."}
- إن تعذر وجود مصدر حديث اكتبي "source": "" و "evidence_date": "" (فارغين).
- لا تكتبي أي نص خارج JSON.`.trim();

  // ——— قوالب الطلب حسب التركيز ———
  const Q_LATEST = `
بطاقات عن **أحدث المستجدات** المبسطة في "${subject}" منذ ${since}.
لكل بطاقة:
- "title": حقيقة/نتيجة محددة بصيغة موجزة.
- "brief": لماذا هذه المعلومة صحيحة ومهمة تربويًا.
- "idea": عرض/تجربة/نشاط قصير **جاهز للتنفيذ** (بدون حوارات مفتوحة).
${lesson ? `- اربطي إن أمكن بدرس "${lesson}".` : ""}`.trim();

  const Q_MYTH = `
بطاقات **خرافات شائعة وتصحيحها العلمي** في "${subject}" (${stageLabel(stage)}).
- "title": ابدئي بـ "خرافة:" ثم نص الخرافة.
- "brief": التصحيح العلمي الدقيق المختصر (مرجع مختزل إن لزم).
- "idea": خطوات عملية قصيرة تُظهر التصحيح (تجربة آمنة/محاكاة/عرض قصير) بدون أسئلة مفتوحة.`.trim();

  const Q_ODD = `
بطاقات **حقائق مدهشة صحيحة** في "${subject}" تناسب ${stageLabel(stage)}.
- "title": حقيقة واحدة دقيقة.
- "brief": تفسير مبسط صحيح.
- "idea": تنفيذ عملي قصير مباشر يبرهن الحقيقة.`.trim();

  const Q_IDEAS = `
بطاقات **أفكار إثرائية عملية جاهزة** لمادة "${subject}" تناسب ${stageLabel(stage)}.
- "idea": مواد، تحضير، تنفيذ (خطوات قصيرة قابلة للتطبيق خلال 5–10 دقائق).`.trim();

  const PIPELINES = {
    latest: [Q_LATEST, Q_MYTH, Q_ODD, Q_IDEAS],
    myth:   [Q_MYTH,   Q_LATEST, Q_ODD, Q_IDEAS],
    odd:    [Q_ODD,    Q_LATEST, Q_MYTH, Q_IDEAS],
    ideas:  [Q_IDEAS,  Q_LATEST, Q_MYTH, Q_ODD],
    auto:   [Q_MYTH,   Q_LATEST, Q_ODD, Q_IDEAS] // نبدأ بالخرافات بطلبك
  };
  const TRIES = PIPELINES[focus] || PIPELINES.auto;

  // ——— أدوات مساعدة ———
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const stripFences = (s="") =>
    String(s).replace(/^\s*```json/i,"").replace(/^\s*```/i,"").replace(/```$/,"").trim();

  // بطاقات مقبولة (3..6) مع إزالة التكرار
  function clampCards(arr) {
    if (!Array.isArray(arr)) return [];
    const out = [];
    const seen = new Set();
    for (const it of arr) {
      const title = String(it?.title || "").trim();
      const idea  = String(it?.idea  || "").trim();
      const brief = String(it?.brief || "").trim();
      if (!title || !idea || !brief) continue;
      const key = (title + "|" + idea).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        title,
        brief,
        idea,
        source: String(it?.source || "").trim(),
        evidence_date: String(it?.evidence_date || "").trim()
      });
      if (out.length >= 6) break;
    }
    return out.length >= 3 ? out : [];
  }

  // فحص "مقبول" و"جزئي"
  const isStrict = (d) => Array.isArray(d?.cards) && d.cards.length >= 3;
  const isSoft   = (d) => Array.isArray(d?.cards) && d.cards.length >= 1;

  // ——— استدعاء Gemini مرة واحدة مع schema ———
  async function callGeminiOnce(model, promptText){
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("timeout")), TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${BASE_SYSTEM}\n\n${promptText}` }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema,
            candidateCount: 1,
            maxOutputTokens: 1400,
            temperature: 0.55
          }
        }),
        signal: controller.signal
      });

      const txt = await res.text();
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`);
        err.status = res.status; err.body = txt.slice(0,800);
        throw err;
      }

      let outer;
      try { outer = JSON.parse(txt); }
      catch {
        return { ok:false, rawText: txt, data:null };
      }

      const raw = stripFences(outer?.candidates?.[0]?.content?.parts?.[0]?.text ?? "");
      let data;
      try { data = JSON.parse(raw); } catch { return { ok:false, rawText: raw, data:null }; }

      // تقليم + إزالة التكرار
      const cleaned = clampCards(data.cards || []);
      return cleaned.length
        ? { ok:true, rawText: raw, data: { cards: cleaned } }
        : { ok:false, rawText: raw, data: { cards: [] } };

    } finally { clearTimeout(timer); }
  }

  // ——— إصلاح ذاتي ———
  const repairPrompt = (prevRaw) => `
الرد السابق كان ناقصًا/غير صالح. هذا هو نصّك:
<<<
${prevRaw}
<<<
أعيدي الآن **نفس البنية** (JSON واحد) وبطاقات صالحة (3–6 على الأقل) بلا أي نص خارج JSON.`.trim();

  // ——— الحلقة: موديلات × محاولات × قوالب ———
  let finalStrict = null;   // {cards:[]}
  let finalSoft   = null;   // {cards:[]}
  let finalRaw    = "";
  let usedModel   = "";

  for (const model of MODELS) {
    for (const q of TRIES) {
      let prompt = q;
      for (let attempt=0; attempt<=MAX_RETRIES; attempt++){
        try{
          const resp = await callGeminiOnce(model, prompt);
          finalRaw = resp.rawText || finalRaw;

          if (resp.ok && isStrict(resp.data)) { finalStrict = resp.data; usedModel = model; break; }
          if (resp.data && isSoft(resp.data)) { finalSoft   = resp.data; usedModel = model; }

          // إصلاح
          prompt = repairPrompt(resp.rawText || "");
          await sleep(BACKOFF_MS * (attempt+1));
        }catch(err){
          const status = err.status || 0;
          const isTimeout = /timeout|AbortError/i.test(String(err?.message));
          const retriable = isTimeout || [429,500,502,503,504].includes(status);
          if (retriable && attempt < MAX_RETRIES){ await sleep(BACKOFF_MS*(attempt+1)); continue; }
          break; // جرّب قالب/موديل آخر
        }
      }
      if (finalStrict) break;
    }
    if (finalStrict) break;
  }

  // ——— رؤوس مشتركة ———
  const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

  // ——— جاهز تمامًا ———
  if (finalStrict) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok:true, cards: finalStrict.cards, _meta:{ model: usedModel, subject, stage, focus, lesson: lesson||"" } })
    };
  }

  // ——— ناتج جزئي ———
  if (finalSoft) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        debug: "incomplete",
        parsed: { cards: finalSoft.cards, _meta:{ model: usedModel, subject, stage, focus, lesson: lesson||"" } },
        rawText: finalRaw || ""
      })
    };
  }

  // ——— فشل ———
  const failMsg = "Model returned incomplete JSON after retries";
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ debug: "incomplete", parsed: null, rawText: finalRaw || "", message: failMsg })
  };
};
