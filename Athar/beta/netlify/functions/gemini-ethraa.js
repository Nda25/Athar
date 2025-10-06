// netlify/functions/gemini-ethraa.js
// ================================================================
// توليد "بطاقات إثراء" بمحتوى صحيح وجاهز للتطبيق، مع حماية + تتبّع
// ================================================================

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { requireUser } = require("./_auth.js");           // حماية
const { supaLogToolUsage } = require("./_log.js");       // تتبّع الاستخدام

// -------- أدوات مساعدة --------
const clampCards = (arr, min = 3, max = 6) => {
  if (!Array.isArray(arr)) return [];
  const uniq = [];
  const seen = new Set();
  for (const it of arr) {
    const t = String(it?.title || "").trim();
    const i = String(it?.idea || "").trim();
    if (!t || !i) continue;
    const key = (t + "|" + i).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push({
      title: t,                                   // عنوان موجز/قابل للطباعة
      brief: String(it?.brief || "").trim(),      // لماذا/قيمة تربوية مختصرة
      idea: i,                                    // خطوات تنفيذ مباشرة (ليس أسئلة مفتوحة)
      source: it?.source ? String(it.source).trim() : undefined,        // مصدر موثوق (اختياري)
      evidence_date: it?.evidence_date || null,   // YYYY-MM-DD أو null
      freshness: it?.freshness || null            // يُملأ لاحقًا
    });
    if (uniq.length >= max) break;
  }
  return uniq.length >= min ? uniq : [];
};

const stageLabel = (code) =>
  ({
    p1: "ابتدائي دُنيا",
    p2: "ابتدائي عُليا",
    m: "متوسط",
    h: "ثانوي",
  }[code] || code || "ثانوي");

function daysBetween(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.valueOf())) return Infinity;
    const now = new Date();
    return Math.floor((now - d) / (1000 * 60 * 60 * 24));
  } catch {
    return Infinity;
  }
}

function tagFreshness(card) {
  const days = card?.evidence_date ? daysBetween(card.evidence_date) : Infinity;
  card.freshness = days <= 180 ? "new" : "general"; // خلال 6 أشهر = حديث
  return card;
}

const stripCodeFence = (txt) =>
  String(txt || "")
    .replace(/^\s*```json/i, "")
    .replace(/^\s*```/i, "")
    .replace(/```$/i, "")
    .trim();

// ------------------- المعرّف الرئيسي (بحماية) -------------------
exports.handler = requireUser(async (event, user) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // قراءة المدخلات
  let body = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: "bad_json" }) };
  }
  const { subject, stage = "h", focus = "auto", lesson } = body || {};
  if (!subject) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: "missing_subject" }) };
  }

  // إعداد Gemini
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: "missing_api_key" }) };
  }

  // نُعدّ أكثر من موديل كـ fallback (المسميات الصحيحة المستقرة)
  const modelNames = [
    process.env.GEMINI_MODEL || "gemini-1.5-pro",
    "gemini-1.5-flash",
  ];

  const genAI = new GoogleGenerativeAI(apiKey);

  // نافذة الزمن للمستجدات
  const now = new Date();
  const y = now.getFullYear();
  const since = `${y - 1}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;

  // --- تعليمات نظام: JSON فقط + منع الأسئلة المفتوحة ---
  const baseSystem = `
أنت مساعد إثرائي للمعلمين باللغة العربية.
أعيدي **فقط JSON واحدًا** بهذا الشكل:
{
 "cards":[
   {
     "title":"...",          // موجز ودقيق (مثلاً: "خرافة: الإلكترونات تدور كالكواكب")
     "brief":"...",          // شرح صحيح مختصر أو قيمة تربوية
     "idea":"...",           // خطوات تنفيذ مباشرة قابلة للتطبيق (أوامر عملية)، بدون أسئلة مفتوحة أو "ناقش/تخيل"
     "source":"https://...", // مصدر موثوق عند الاقتضاء (خبر/ورقة/مقال تعليمي)، وإلا اتركيه خاليًا
     "evidence_date":"YYYY-MM-DD" // تاريخ حديث مستدل من المصدر إن توافر، وإلا null
   }
 ]
}
- أعيدي 3 إلى 6 بطاقات غير مكررة.
- تجنبي عبارات من نوع: "فكر/ناقشي/اطلبي من الطالبات أن..." واجعلي "idea" **إجراءات تنفيذية مباشرة** (1–5 خطوات).
- راعي المرحلة "${stageLabel(stage)}" في الأسلوب.
- إن تعذر المصدر الحديث، اجعلي "source":"" و "evidence_date": null.
- **لا** تكتبي أي نص خارج JSON.
`.trim();

  // قوالب محتوى تضمن "محتوى صحيح" وليس أسئلة:
  const qLatest = (s, st) => `
بطاقات عن **أحدث مستجدات** "${s}" منذ ${since}.
لكل بطاقة:
- "title": صيغي العنوان بمعلومة/ناتج بحثي حقيقي موجز.
- "brief": لماذا يهم تربويًا.
- "idea": خطوات تنفيذ مباشرة (عرض قصير/تجربة آمنة/ورقة سريعة) تُظهر المعلومة، بدون أسئلة مفتوحة.
${lesson ? `إن أمكن، اربطي ضمنيًا بدرس "${lesson}".` : ""}
`.trim();

  const qMyth = (s, st) => `
بطاقات **خرافات شائعة وتصحيحها العلمي** في "${s}" (${stageLabel(st)}).
لكل بطاقة:
- "title": يبدأ بـ "خرافة:" ثم نص الخرافة الشائع.
- "brief": التصحيح العلمي الصحيح المختصر المدعوم بتفسير مبسط.
- "idea": خطوات تنفيذ عملية قصيرة لعرض الدليل أو المثال المصحّح (تجربة/محاكاة/عرض مرئي) **بدون أسئلة مفتوحة**.
- "source": إن أمكن مصدر يذكر التصحيح أو مرجع تعليمي موثوق.
`.trim();

  const qOdd = (s, st) => `
بطاقات **حقائق مدهشة وموثوقة** في "${s}" تناسب "${stageLabel(st)}".
- "title": حقيقة دقيقة واحدة.
- "brief": تفسير مبسط صحيح.
- "idea": تنفيذ عملي قصير مباشر يبرهن الحقيقة (تجربة آمنة أو عرض قصير).
`.trim();

  const qIdeas = (s, st) => `
بطاقات **أفكار إثرائية عملية جاهزة** لمادة "${s}" تناسب "${stageLabel(st)}".
- اجعلي "idea" إجراءات تنفيذية خطوة بخطوة (مواد، تحضير، تنفيذ) بدون أي أسئلة مفتوحة.
- المخرجات قابلة للملاحظة في الصف خلال 5–10 دقائق.
`.trim();

  const pipelines = {
    latest: [qLatest, qMyth, qOdd, qIdeas],
    myth: [qMyth, qLatest, qOdd, qIdeas],
    odd: [qOdd, qLatest, qMyth, qIdeas],
    ideas: [qIdeas, qLatest, qMyth, qOdd],
    auto: [qMyth, qLatest, qOdd, qIdeas], // نبدأ بالخرافات لأنها مطلبك الأهم
  };
  const tries = pipelines[focus] || pipelines.auto;

  // --- التوليد بمحاولات عبر أكثر من "قالب" وأكثر من "موديل" ---
  let cards = [];
  outer: for (const modelName of modelNames) {
    const model = genAI.getGenerativeModel({ model: modelName });

    for (const q of tries) {
      try {
        const prompt = `${baseSystem}\n\n${q(subject, stage)}`.trim();
        const result = await model.generateContent(prompt);
        const text = stripCodeFence((await result.response).text());
        const parsed = JSON.parse(text);
        const out = clampCards(parsed.cards || []);
        if (out.length) {
          cards = out.map(tagFreshness);
          break outer;
        }
      } catch (err) {
        console.error("ethraa-step-error:", modelName, err?.message || err);
      }
    }
  }

  // --- fallback مضمون لو فشل الجيل تمامًا ---
  if (!cards.length) {
    cards = clampCards(
      [
        {
          title: `خرافة: الإلكترونات "تدور" حول النواة كالكواكب`,
          brief:
            "الوصف المداري الحديث هو سُحُب احتمالية (مدارات موجية)، وليس مسارات دائرية كلاسيكية.",
          idea:
            "خطوات تنفيذ: 1) اعرض رسمَي بوهر مقابل السحابة الإلكترونية. 2) شغّل محاكاة سحابة إلكترونية (GIF ثابت مسبقًا). 3) أختم ببطاقة مقارنة جاهزة توضح الفارق (مدار كلاسيكي مقابل دالة موجية).",
          source: "",
          evidence_date: null,
        },
        {
          title: "حقيقة: سرعة الضوء في الفراغ ثابتة ≈ 3×10⁸ م/ث",
          brief:
            "ثباتها أساس النسبية الخاصة ويؤدي لظواهر تمدد الزمن وانكماش الطول.",
          idea:
            "خطوات تنفيذ: 1) اعرض قيمة c على لوحة. 2) فيديو 60 ثانية يوضح القياس الليزري للمسافة/الزمن. 3) ورقة مصغّرة فيها تمرين حسابي جاهز لاستنتاج زمن وصول الضوء لمسافة معلومة.",
          source: "",
          evidence_date: null,
        },
        {
          title: "فكرة عملية: مطياف جيبي للهاتف",
          brief:
            "مطياف ورقي بسيط يبرهن تفريق الضوء وإظهار خطوط طيفية ملونة.",
          idea:
            "خطوات تنفيذ: 1) وزّع شبكة حيود ورق أسود وشريط لاصق. 2) قص نافذة وركّب الشبكة. 3) وجّه نحو مصباح أبيض آمن، سيرى الطلاب الطيف فورًا. 4) التقط صورة توثيقية.",
          source: "",
          evidence_date: null,
        },
      ],
      3,
      6
    ).map(tagFreshness);
  }

  // --- بدائل "قريبة من المجال" إذا كل النتائج قديمة ---
  const staleCount = cards.filter((c) => (c.freshness || "general") === "general")
    .length;
  let nearby = [];
  if (cards.length && staleCount === cards.length) {
    try {
      for (const modelName of modelNames) {
        const model = genAI.getGenerativeModel({ model: modelName });
        const promptNearby = `${baseSystem}

أعطِ 3–6 بطاقات بديلة **قريبة من مجال** "${subject}" تركّز على توجهات حديثة (آخر 12 شهرًا)
مثل: تطبيقات ناشئة/تقنيات تعليمية عملية، بصيغة خطوات تنفيذية مباشرة، ومع "evidence_date" إن أمكن.
${lesson ? `واستئناسًا بدرس "${lesson}".` : ""}`.trim();

        const resN = await model.generateContent(promptNearby);
        const textN = stripCodeFence((await resN.response).text());
        const parsedN = JSON.parse(textN);
        const outN = clampCards(parsedN.cards || []);
        if (outN.length) {
          nearby = outN.map(tagFreshness);
          break;
        }
      }
    } catch (e) {
      console.error("ethraa-nearby-error:", e?.message || e);
    }
  }

  // --- بصمات (اختياري للواجهة) ---
  const sig = (d) => {
    const s = (d.title || "") + "|" + (d.idea || "");
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i);
      h |= 0;
    }
    return String(h);
  };

  const payload = {
    ok: true,
    cards,
    nearby: nearby.length ? nearby : undefined,
    _meta: {
      subject,
      stage,
      focus: focus || "auto",
      lesson: lesson || null,
      all_stale: !!(cards.length && staleCount === cards.length),
      count: cards.length,
      dedup_sigs: cards.map(sig),
    },
  };

  // --- تتبّع الاستخدام في Supabase ---
  try {
    await supaLogToolUsage(user, "ethraa", {
      subject,
      stage,
      focus: focus || "auto",
      lesson: lesson || null,
      count: payload._meta.count,
      all_stale: payload._meta.all_stale,
    });
  } catch (e) {
    // لا نُفشل الطلب بسبب اللوج
    console.error("ethraa-log-error:", e?.message || e);
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  };
});
