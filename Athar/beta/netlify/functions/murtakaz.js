// netlify/functions/murtakaz.js  (CommonJS)
const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const {
      mode, subject, topic, sourceText,
      age, duration, bloomMain, bloomSupport,
      goalCount, notes, level, adapt,
      variant // اختياري لفرض التنويع الجذري
    } = JSON.parse(event.body || "{}");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: "Missing GEMINI_API_KEY" };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const AGE_LABELS = { p1: "ابتدائي دُنيا", p2: "ابتدائي عُليا", m: "متوسط", h: "ثانوي" };
    const ageLabel = AGE_LABELS[age] || age || "—";
    const dhow = (v) => (v==null || v===undefined ? "—" : String(v));

    // تشديد الدقة والملاءمة وعدم التكرار والقياس… داخل نفس القوالب دون تغيير الحقول
    const strictJSON = `
أنت مخطط دروس ذكي لمدارس السعودية (مناهج 2025+) بالعربية الفصحى.
- لا تكتب أي نص خارج JSON.
- أعطِ تفاصيل قابلة للتطبيق والقياس، تراعي ${ageLabel} وزمن الحصة (${dhow(duration)||45} دقيقة) وبيئة الصف السعودية.
- اجعل الأنشطة عملية وملائمة لواقع المدرسة، وتدعم مهارات القرن 21 ورؤية 2030 (تعاون، تواصل، تفكير ناقد، ابتكار، مواطنة رقمية…).
- مواءمة بلوم: انسج الأهداف والأنشطة والتقويم بأفعال ومهام تتطابق مع "${dhow(bloomMain)}" (+ "${dhow(bloomSupport)}" إن وُجد).
- امنع التكرار: لو مُمرّر متغير "variant" فاعتمد زاوية وتنظيمًا مختلفين 100% (عنوان مختلف، تسلسل مختلف، منتج نهائي مختلف).
- اجعل كل سؤال تقويم واضح الصياغة ومرتبطًا مباشرة بالموضوع، مع تذكرة خروج أو أداة تقييم سريعة.
- اجعل "structure" خطوات قبل/أثناء/بعد مفصّلة بمؤشرات زمنية تقريبية ضمن زمن الحصة.
- اجعل "goals" ذكية (قابلة للقياس) ومُصاغة بأفعال بلوم الصحيحة للمستوى.
- اجعل "activities" متعددة الزوايا: تمهيد محسوس/نشاط رئيسي تعاوني/تمرين فردي/منتج نهائي قصير.
- اجعل "diff" ثلاثة عناصر: (دعم)، (إثراء)، (مرونة العرض).
- "success": صياغة معيار نجاح قصيرة قابلة للملاحظة.
- اللغة: بسيطة/رصينة بحسب المرحلة، أمثلة محلية قريبة من واقع الطلبة.
- JSON فقط.
`.trim();

    const goalN = Math.max(1, +goalCount || 2);

    function buildPrompt(reinforceNovelty = false) {
      const novelty = variant || Date.now();
      const noveltyNote = reinforceNovelty ? `
[تنويع صارم] اعكس تمامًا أي هيكلة/عنوان محتملة: بدّل المدخلات/التعاون/المنتج النهائي/طريقة التقييم. لا تُعيد أي صياغة سابقة.`.trim() : `
لو وُجد variant=${novelty}: استجب بعنوان مختلف وهيكلة مختلفة ونشاط/منتج نهائي مختلف جذريًا.`.trim();

      return `
${strictJSON}

أعِد JSON بالحقل/القيم التالية فقط:
{
  "meta": {
    "topic": "عنوان مختصر مبتكر ومحدد",
    "age": "${dhow(age)}",
    "ageLabel": "${ageLabel}",
    "mainBloomLabel": "${dhow(bloomMain)}",
    "supportBloomLabel": "${dhow(bloomSupport)}"
  },
  "goals": [ ${Array.from({length: goalN}).map(()=>`"__"`).join(", ")} ],
  "success": "__",
  "structure": ["قبل (تهيئة ${Math.min(10, Math.max(3, Math.round((duration||45)*0.2)))}د): __", "أثناء (${Math.max(15, Math.round((duration||45)*0.55))}د): __", "بعد (${Math.max(5, Math.round((duration||45)*0.25))}د): __"],
  "activities": ["تمهيد محسوس ملائم للعمر", "نشاط رئيسي تعاوني موجّه بوضوح", "تمرين تطبيق فردي قصير", "منتج تقويمي نهائي أو عرض وجيز"],
  "assessment": ["س١ (واضح ومباشر مرتبط بالموضوع): __", "س٢ (أعلى قليلاً في بلوم): __", "س٣ (تذكرة خروج قابلة للقياس): __"],
  "diff": ["دعم: __", "إثراء: __", "مرونة العرض: __"],
  "oneMin": "نص الدقيقة الواحدة الملائم"
}

المعطيات:
- المادة: ${dhow(subject)}
- النمط: ${dhow(mode)}  (topic/text)
- الموضوع (إن وُجد): ${dhow(topic)}
- النص للتحليل (إن وُجد): ${(sourceText || "—").slice(0, 1200)}
- ملاحظات المعلم: ${dhow(notes)}
- مستوى الصف: ${dhow(level)}
- تعلم تكيفي: ${adapt ? "نعم" : "لا"}
- Bloom (أساسي/داعم): ${dhow(bloomMain)} / ${dhow(bloomSupport)}
- زمن الحصة (د): ${dhow(duration||45)}
- الفئة العمرية: ${ageLabel}
- variant: ${novelty}

${noveltyNote}
- إن كان النمط "text": استخرج Topic مناسبًا من النص ووافق الأهداف معه.
- استخدم أمثلة واقعية من بيئة المدرسة السعودية.
- صياغة عربية سليمة خالية من الحشو.
- أخرج JSON فقط لا غير.
`.trim();
    }

    async function callOnce(promptText) {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: promptText }] }]
      });
      const raw = (result.response.text() || "").trim();

      // التقاط JSON حتى لو التفّ داخل أسوار
      let payload;
      try {
        const m = raw.match(/\{[\s\S]*\}/);
        payload = JSON.parse(m ? m[0] : raw);
      } catch (e) {
        const err = new Error("Bad JSON from model");
        err.body = raw.slice(0, 400);
        throw err;
      }
      return payload;
    }

    // محاولة أولى
    let payload;
    try {
      payload = await callOnce(buildPrompt(false));
    } catch {
      // إعادة محاولة بأسلوب أكثر صرامة للتنويع والدقة
      payload = await callOnce(buildPrompt(true));
    }

    const safeArr = (a) => Array.isArray(a) ? a.filter(Boolean) : [];

    // حراسة الحد الأدنى (بدون تغيير الحقول)
    const body = JSON.stringify({
      meta: payload.meta || {
        topic: topic || "—",
        age: age || "",
        ageLabel,
        mainBloomLabel: bloomMain || "",
        supportBloomLabel: bloomSupport || ""
      },
      goals: safeArr(payload.goals),
      success: payload.success || "",
      structure: safeArr(payload.structure),
      activities: safeArr(payload.activities),
      assessment: safeArr(payload.assessment),
      diff: safeArr(payload.diff),
      oneMin: payload.oneMin || ""
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body
    };

  } catch (err) {
    console.error("murtakaz error:", err);
    return { statusCode: 500, body: `Server error: ${err.message || String(err)}` };
  }
};
