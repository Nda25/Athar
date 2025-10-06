// netlify/functions/gemini-ethraa.js
// ================================================================
// بطاقات إثراء بمحتوى "جاهز ومحدد" (وليس أسئلة للطالبات)
// + حماية Auth0 (requireUser)  + تسجيل استخدام عبر log-tool-usage
// ================================================================

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { requireUser } = require("./_auth.js");

// ---------------- أدوات مساعدة ----------------
const clampCards = (arr, min = 3, max = 6) => {
  if (!Array.isArray(arr)) return [];
  const uniq = [], seen = new Set();
  for (const it of arr) {
    const title = String(it?.title || "").trim();
    const idea  = String(it?.idea  || "").trim();
    if (!title || !idea) continue;
    const key = (title + "|" + idea).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push({
      title,
      brief: String(it?.brief || "").trim(),
      idea,
      source: it?.source ? String(it.source).trim() : "",
      evidence_date: it?.evidence_date || null,
      freshness: it?.freshness || null
    });
    if (uniq.length >= max) break;
  }
  return uniq.length >= min ? uniq : [];
};

const stageLabel = code => ({
  p1: "ابتدائي دُنيا",
  p2: "ابتدائي عُليا",
  m:  "متوسط",
  h:  "ثانوي",
}[code] || code || "ثانوي");

const daysBetween = (iso) => {
  try {
    const d = new Date(iso);
    if (isNaN(d.valueOf())) return Infinity;
    return Math.floor((Date.now() - d.getTime()) / (1000*60*60*24));
  } catch { return Infinity; }
};
const tagFreshness = (card) => {
  const days = card?.evidence_date ? daysBetween(card.evidence_date) : Infinity;
  card.freshness = days <= 180 ? "new" : "general";
  return card;
};
const stripCodeFence = (txt) =>
  String(txt||"").replace(/^\s*```json/i,"").replace(/^\s*```/i,"").replace(/```$/i,"").trim();

// ---------------- المعالج الرئيسي (بحماية) ----------------
exports.handler = requireUser(async (event, user) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // المدخلات
  let body = {};
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: JSON.stringify({ ok:false, error:"bad_json" }) }; }

  const { subject, stage = "h", focus = "auto", lesson } = body;
  if (!subject) {
    return { statusCode: 400, body: JSON.stringify({ ok:false, error:"missing_subject" }) };
  }

  // إعداد Gemini
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error:"missing_api_key" }) };
  }
  const models = [
    process.env.GEMINI_MODEL || "gemini-1.5-pro",
    "gemini-1.5-flash",
  ];
  const genAI = new GoogleGenerativeAI(apiKey);

  // نافذة مستجدات للسنة الماضية
  const now = new Date();
  const since = `${now.getFullYear()-1}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;

  // ـــــ تعليمات نظام صارمة (JSON فقط + خطوات تنفيذية) ـــــ
  const baseSystem = `
أنت مساعد إثرائي للمعلمين بالعربية.
أعيدي **فقط JSON واحدًا** بالشكل:
{
 "cards":[
   {
     "title":"...",          // معلومة/تصحيح حقيقي موجز (مثال: "خرافة: الإلكترونات تدور كالكواكب")
     "brief":"...",          // تفسير/تصحيح صحيح مختصر
     "idea":"...",           // خطوات تنفيذ عملية مباشرة (أوامر قابلة للتنفيذ)، بدون "ناقشي/تخيلي/اسألي"
     "source":"https://...", // مصدر موثوق إن توفر، وإلا اتركيه فارغًا ""
     "evidence_date":"YYYY-MM-DD" // تاريخ حديث من المصدر إن توفر، وإلا null
   }
 ]
}
- أعيدي 3–6 بطاقات غير مكررة.
- تجنبي أي أسئلة مفتوحة داخل "idea"؛ اذكري إجراءات تنفيذية قصيرة (1–5 خطوات) يمكن أداءها خلال 5–10 دقائق.
- راعي المرحلة "${stageLabel(stage)}".
- ممنوع أي نص خارج JSON.
`.trim();

  // قوالب طلب تضمن "محتوى محدد جاهز"
  const qLatest = (s) => `
بطاقات عن **أحدث مستجدات** "${s}" منذ ${since}.
لكل بطاقة اجعلي "title" حقيقة/نتيجة موثوقة، و"idea" عرض/تجربة/نشاط قصير بخطوات محددة تمامًا (بدون أسئلة).
${lesson ? `اربطِي ضمنيًا بدرس "${lesson}" إن أمكن.` : ""}
`.trim();

  const qMyth = (s, st) => `
بطاقات **خرافات شائعة + التصحيح العلمي** في "${s}" (${stageLabel(st)}).
- "title": يبدأ بـ "خرافة:" ثم نص الخرافة المنتشرة.
- "brief": التصحيح العلمي المختصر الدقيق.
- "idea": تنفيذ عملي قصير يبرهن التصحيح (تجربة آمنة/عرض مرئي/محاكاة محددة) **بدون أسئلة مفتوحة**.
- "source": مرجع موثوق إن توفر.
`.trim();

  const qOdd = (s, st) => `
بطاقات **حقائق مدهشة دقيقة** في "${s}" تناسب "${stageLabel(st)}":
- "title": حقيقة واحدة دقيقة.
- "brief": تفسير صحيح مبسّط.
- "idea": خطوات تنفيذ قصيرة تُظهر الحقيقة مباشرة.
`.trim();

  const qIdeas = (s, st) => `
بطاقات **أفكار إثرائية جاهزة** لـ"${s}" تناسب "${stageLabel(st)}":
- "idea": مواد مطلوبة + 3–5 خطوات تنفيذ مباشرة + نتيجة متوقعة يمكن ملاحظتها سريعًا.
`.trim();

  const pipelines = {
    latest: [qLatest, qMyth, qOdd, qIdeas],
    myth:   [qMyth, qLatest, qOdd, qIdeas],
    odd:    [qOdd, qLatest, qMyth, qIdeas],
    ideas:  [qIdeas, qLatest, qMyth, qOdd],
    auto:   [qMyth, qLatest, qOdd, qIdeas], // نبدأ بالخرافات حسب طلبك
  };
  const tries = pipelines[focus] || pipelines.auto;

  // التوليد مع تعدد النماذج والقوالب
  let cards = [];
  outer: for (const m of models) {
    const model = genAI.getGenerativeModel({ model: m });
    for (const q of tries) {
      try {
        const prompt = `${baseSystem}\n\n${q(subject, stage)}`;
        const res = await model.generateContent(prompt);
        const txt = stripCodeFence((await res.response).text());
        const parsed = JSON.parse(txt);
        const out = clampCards(parsed.cards || []);
        if (out.length) {
          cards = out.map(tagFreshness);
          break outer;
        }
      } catch (e) {
        console.error("ethraa-step-error:", m, e?.message || e);
      }
    }
  }

  // fallback مضمون إن فشل كل شيء
  if (!cards.length) {
    cards = clampCards([
      {
        title: `خرافة: الإلكترونات "تدور" حول النواة كالكواكب`,
        brief: "النموذج الحديث يصف سُحُب احتمالية (مدارات موجية) وليس مسارات دائرية.",
        idea: "1) اعرض صورة مقارنة: نموذج بوهر vs سحابة إلكترونية. 2) شغّل GIF لمحاكاة السحابة. 3) وزّع بطاقة مقارنة جاهزة يملأها الطلاب (مدار كلاسيكي/مداري موجي).",
        source: "",
        evidence_date: null
      },
      {
        title: "حقيقة: سرعة الضوء في الفراغ ثابتة ≈ 3×10⁸ م/ث",
        brief: "أساس النسبية الخاصة ويقود لتمدد الزمن.",
        idea: "1) اعرض قيمة c. 2) فيديو 60 ثانية لقياس مسافة/زمن بالليزر. 3) ورقة صغيرة لحساب زمن وصول الضوء لمسافة 1 كم.",
        source: "",
        evidence_date: null
      },
      {
        title: "فكرة عملية: مطياف جيبي للهاتف",
        brief: "مطياف ورقي بسيط يبين تفريق الضوء.",
        idea: "مواد: شبكة حيود + ورق أسود + شريط. خطوات: 1) قص نافذة 1×3 سم. 2) لصق الشبكة. 3) توجيهه لمصباح أبيض آمن. 4) تصوير الطيف.",
        source: "",
        evidence_date: null
      }
    ]).map(tagFreshness);
  }

  // بدائل قريبة من المجال إذا كانت النتائج قديمة كلها
  const staleCount = cards.filter(c => (c.freshness||"general")==="general").length;
  let nearby = [];
  if (cards.length && staleCount === cards.length) {
    try {
      for (const m of models) {
        const model = genAI.getGenerativeModel({ model: m });
        const promptN = `${baseSystem}

أعطِ 3–6 بطاقات بديلة **قريبة من مجال** "${subject}" تركز على توجهات حديثة (آخر 12 شهرًا)
بخطوات تنفيذية مباشرة، وأدخل "evidence_date" إن توفر.
${lesson ? `مواءمة ضمنية مع "${lesson}".` : ""}`;
        const r = await model.generateContent(promptN);
        const txt = stripCodeFence((await r.response).text());
        const parsed = JSON.parse(txt);
        const out = clampCards(parsed.cards || []);
        if (out.length) { nearby = out.map(tagFreshness); break; }
      }
    } catch (e) {
      console.error("ethraa-nearby-error:", e?.message || e);
    }
  }

  const sig = (d) => {
    const s = (d.title||"") + "|" + (d.idea||"");
    let h=0; for (let i=0;i<s.length;i++){ h=((h<<5)-h)+s.charCodeAt(i); h|=0; }
    return String(h);
  };

  const payload = {
    ok: true,
    cards,
    nearby: nearby.length ? nearby : undefined,
    _meta: {
      subject, stage, focus: focus || "auto", lesson: lesson || null,
      all_stale: !!(cards.length && staleCount === cards.length),
      count: cards.length,
      dedup_sigs: cards.map(sig)
    }
  };

  // تسجيل استخدام الأداة (بدون كسر الطلب لو فشل)
  try {
    const userEmail =
      user?.user?.email ||
      user?.payload?.email ||
      null;

    if (userEmail) {
      await fetch(`${process.env.PUBLIC_BASE_URL || ""}/.netlify/functions/log-tool-usage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool_name: "ethraa",
          user_email: userEmail,
          meta: payload._meta
        })
      }).catch(()=>{});
    }
  } catch (e) {
    console.error("ethraa-log-error:", e?.message || e);
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload)
  };
});
