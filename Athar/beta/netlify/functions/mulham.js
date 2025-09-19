// netlify/functions/mulham.js
// يُولّد أنشطة صفية (حركي/جماعي/فردي) بمدخل فكرة + تذكرة خروج + أثر متوقع
// ويدعم: بدون أدوات، تكييف (تحفيز منخفض/فروق فردية)، وبدائل أكثر (variants)

const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const {
      subject = "",
      topic = "",
      time = 20,
      bloom = "understand",
      age = "p2",
      noTools = false,           // zero-prep
      adaptLow = false,          // تكييف: تحفيز منخفض
      adaptDiff = false,         // تكييف: فروق فردية
      variant = ""               // لتوليد تنويعات
    } = JSON.parse(event.body || "{}");

    const AGE_LABELS = { p1:"ابتدائي دُنيا", p2:"ابتدائي عُليا", m:"متوسط", h:"ثانوي" };
    const bloomLabel = {
      remember:"تذكّر", understand:"فهم", apply:"تطبيق", analyze:"تحليل", evaluate:"تقويم", create:"ابتكار"
    }[bloom] || bloom;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { statusCode: 500, body: "Missing GEMINI_API_KEY" };

    const genAI = new GoogleGenerativeAI(apiKey);
    const model  = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const constraints = [];
    if (noTools) {
      constraints.push(
        "بدون أدوات/بطاقات/قص ولصق/طباعة. استخدموا أشيـاء الصف المتاحة (أقلام/دفاتر/سبورة/جسد/حركة/مقاعد)."
      );
    } else {
      constraints.push(
        "مواد بسيطة متاحة صفياً (بطاقات ورقية، لصقات، سبورة، أقلام...)."
      );
    }
    if (adaptLow) constraints.push("أضف فقرة diff.lowMotivation بكل نشاط: كيف ترفعين الدافعية/الانخراط بخطوة/تعديل بسيط.");
    if (adaptDiff) constraints.push("أضف فقرة diff.differentiation بكل نشاط: تدرّج مهام/اختيارات/سلالم نجاح لضبط الفروق الفردية.");

    const prompt = `
أنت خبير تصميم تعلّم نشط. أنشئ ثلاث حزم أنشطة خلاّقة وممتعة لدرس مادة "${subject}" حول "${topic || subject}".
زمن الحصة المتاح: ${+time || 20} دقيقة. المرحلة: ${AGE_LABELS[age] || age}. مستوى بلوم: ${bloomLabel}.
التنويعة/البذرة: ${variant ? String(variant) : "default"}.

قيود التصميم:
- ${constraints.join("\n- ")}

أعد المخرجات في JSON صالح **فقط** بدون أي شرح خارج JSON.
بنية JSON المطلوبة **بدقة**:

{
  "meta": {
    "subject": "...",
    "topic": "...",
    "timeMins": ${+time || 20},
    "age": "${age}",
    "ageLabel": "${AGE_LABELS[age] || age}",
    "bloom": "${bloom}",
    "bloomLabel": "${bloomLabel}",
    "noTools": ${!!noTools},
    "adaptLow": ${!!adaptLow},
    "adaptDiff": ${!!adaptDiff},
    "variant": "${variant || "default"}"
  },
  "sets": {
    "movement": {
      "title": "نشاط صفّي حركي",
      "ideaHook": "مدخل الفكرة جذاب وسريع يربط الموضوع بخبرة قريبة",
      "desc": "وصف قصير جذاب",
      "duration": 10,
      "materials": ["مواد بسيطة..."],
      "steps": ["خطوة عملية", "خطوة عملية", "خطوة عملية"],
      "exitTicket": "سؤال/مهمة خروج قصيرة تقيس الهدف",
      "expectedImpact": "أثر متوقع سلوكي/معرفي قابل للملاحظة خلال الحصة",
      "diff": {
        "lowMotivation": "تكييف اختياري لرفع الدافعية",
        "differentiation": "تكييف اختياري للفروق الفردية"
      }
    },
    "group": {
      "title": "نشاط صفّي جماعي",
      "ideaHook": "...",
      "desc": "...",
      "duration": 10,
      "materials": ["..."],
      "steps": ["..."],
      "exitTicket": "...",
      "expectedImpact": "...",
      "diff": {
        "lowMotivation": "...",
        "differentiation": "..."
      }
    },
    "individual": {
      "title": "نشاط صفّي فردي",
      "ideaHook": "...",
      "desc": "...",
      "duration": 10,
      "materials": ["..."],
      "steps": ["..."],
      "exitTicket": "...",
      "expectedImpact": "...",
      "diff": {
        "lowMotivation": "...",
        "differentiation": "..."
      }
    }
  },
  "tips": ["نصيحة تعميم/تكييف 1","نصيحة 2"]
}

شروط مهمة:
- الأنشطة **ممتعة ومبتكرة وآمنة** وقابلة للتنفيذ فوريًا.
- قدّم **ideaHook** (مدخل فكرة) جذاب، **exitTicket** واضح، و**expectedImpact** قابل للملاحظة.
- الخطوات عملية (٣–٦) وتراعي زمن النشاط.
- إن كان noTools=true لا تستخدم تجهيزات مسبقة (Zero-prep).
- إن طُلبت تكييفات، املأ diff.lowMotivation و/أو diff.differentiation بنص موجز مفيد.
- لا تضع أي شيء خارج JSON.
`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    const raw = (result?.response?.text() || "").trim();
    const m = raw.match(/\{[\s\S]*\}$/);
    let data;
    try {
      data = JSON.parse(m ? m[0] : raw);
    } catch (e) {
      return { statusCode: 500, body: JSON.stringify({ error: "Bad JSON from model", raw }) };
    }

    const cleanSet = (s, fallbackTitle) => ({
      title: s?.title || fallbackTitle,
      ideaHook: s?.ideaHook || "",
      desc: s?.desc || "",
      duration: +s?.duration || Math.ceil((+time||20)/3),
      materials: Array.isArray(s?.materials) ? s.materials.filter(Boolean) : [],
      steps: Array.isArray(s?.steps) ? s.steps.filter(Boolean) : [],
      exitTicket: s?.exitTicket || "",
      expectedImpact: s?.expectedImpact || "",
      diff: {
        lowMotivation: s?.diff?.lowMotivation || "",
        differentiation: s?.diff?.differentiation || ""
      }
    });

    const body = JSON.stringify({
      meta: data?.meta || {},
      sets: {
        movement: cleanSet(data?.sets?.movement, "نشاط صفّي حركي"),
        group:    cleanSet(data?.sets?.group, "نشاط صفّي جماعي"),
        individual: cleanSet(data?.sets?.individual, "نشاط صفّي فردي"),
      },
      tips: Array.isArray(data?.tips) ? data.tips.filter(Boolean) : []
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      body
    };
  } catch (err) {
    console.error("mulham error:", err);
    return { statusCode: 500, body: String(err?.message || err) };
  }
};// netlify/functions/mulham.js
// يُولّد أنشطة صفية (حركي/جماعي/فردي) بمدخل فكرة + تذكرة خروج + أثر متوقع
// ويدعم: بدون أدوات، تكييف (تحفيز منخفض/فروق فردية)، وبدائل أكثر (variants)

const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const {
      subject = "",
      topic = "",
      time = 20,
      bloom = "understand",
      age = "p2",
      noTools = false,           // zero-prep
      adaptLow = false,          // تكييف: تحفيز منخفض
      adaptDiff = false,         // تكييف: فروق فردية
      variant = ""               // لتوليد تنويعات
    } = JSON.parse(event.body || "{}");

    const AGE_LABELS = { p1:"ابتدائي دُنيا", p2:"ابتدائي عُليا", m:"متوسط", h:"ثانوي" };
    const bloomLabel = {
      remember:"تذكّر", understand:"فهم", apply:"تطبيق", analyze:"تحليل", evaluate:"تقويم", create:"ابتكار"
    }[bloom] || bloom;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { statusCode: 500, body: "Missing GEMINI_API_KEY" };

    const genAI = new GoogleGenerativeAI(apiKey);
    const model  = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const constraints = [];
    if (noTools) {
      constraints.push(
        "بدون أدوات/بطاقات/قص ولصق/طباعة. استخدموا أشيـاء الصف المتاحة (أقلام/دفاتر/سبورة/جسد/حركة/مقاعد)."
      );
    } else {
      constraints.push(
        "مواد بسيطة متاحة صفياً (بطاقات ورقية، لصقات، سبورة، أقلام...)."
      );
    }
    if (adaptLow) constraints.push("أضف فقرة diff.lowMotivation بكل نشاط: كيف ترفعين الدافعية/الانخراط بخطوة/تعديل بسيط.");
    if (adaptDiff) constraints.push("أضف فقرة diff.differentiation بكل نشاط: تدرّج مهام/اختيارات/سلالم نجاح لضبط الفروق الفردية.");

    const prompt = `
أنت خبير تصميم تعلّم نشط. أنشئ ثلاث حزم أنشطة خلاّقة وممتعة لدرس مادة "${subject}" حول "${topic || subject}".
زمن الحصة المتاح: ${+time || 20} دقيقة. المرحلة: ${AGE_LABELS[age] || age}. مستوى بلوم: ${bloomLabel}.
التنويعة/البذرة: ${variant ? String(variant) : "default"}.

قيود التصميم:
- ${constraints.join("\n- ")}

أعد المخرجات في JSON صالح **فقط** بدون أي شرح خارج JSON.
بنية JSON المطلوبة **بدقة**:

{
  "meta": {
    "subject": "...",
    "topic": "...",
    "timeMins": ${+time || 20},
    "age": "${age}",
    "ageLabel": "${AGE_LABELS[age] || age}",
    "bloom": "${bloom}",
    "bloomLabel": "${bloomLabel}",
    "noTools": ${!!noTools},
    "adaptLow": ${!!adaptLow},
    "adaptDiff": ${!!adaptDiff},
    "variant": "${variant || "default"}"
  },
  "sets": {
    "movement": {
      "title": "نشاط صفّي حركي",
      "ideaHook": "مدخل الفكرة جذاب وسريع يربط الموضوع بخبرة قريبة",
      "desc": "وصف قصير جذاب",
      "duration": 10,
      "materials": ["مواد بسيطة..."],
      "steps": ["خطوة عملية", "خطوة عملية", "خطوة عملية"],
      "exitTicket": "سؤال/مهمة خروج قصيرة تقيس الهدف",
      "expectedImpact": "أثر متوقع سلوكي/معرفي قابل للملاحظة خلال الحصة",
      "diff": {
        "lowMotivation": "تكييف اختياري لرفع الدافعية",
        "differentiation": "تكييف اختياري للفروق الفردية"
      }
    },
    "group": {
      "title": "نشاط صفّي جماعي",
      "ideaHook": "...",
      "desc": "...",
      "duration": 10,
      "materials": ["..."],
      "steps": ["..."],
      "exitTicket": "...",
      "expectedImpact": "...",
      "diff": {
        "lowMotivation": "...",
        "differentiation": "..."
      }
    },
    "individual": {
      "title": "نشاط صفّي فردي",
      "ideaHook": "...",
      "desc": "...",
      "duration": 10,
      "materials": ["..."],
      "steps": ["..."],
      "exitTicket": "...",
      "expectedImpact": "...",
      "diff": {
        "lowMotivation": "...",
        "differentiation": "..."
      }
    }
  },
  "tips": ["نصيحة تعميم/تكييف 1","نصيحة 2"]
}

شروط مهمة:
- الأنشطة **ممتعة ومبتكرة وآمنة** وقابلة للتنفيذ فوريًا.
- قدّم **ideaHook** (مدخل فكرة) جذاب، **exitTicket** واضح، و**expectedImpact** قابل للملاحظة.
- الخطوات عملية (٣–٦) وتراعي زمن النشاط.
- إن كان noTools=true لا تستخدم تجهيزات مسبقة (Zero-prep).
- إن طُلبت تكييفات، املأ diff.lowMotivation و/أو diff.differentiation بنص موجز مفيد.
- لا تضع أي شيء خارج JSON.
`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    const raw = (result?.response?.text() || "").trim();
    const m = raw.match(/\{[\s\S]*\}$/);
    let data;
    try {
      data = JSON.parse(m ? m[0] : raw);
    } catch (e) {
      return { statusCode: 500, body: JSON.stringify({ error: "Bad JSON from model", raw }) };
    }

    const cleanSet = (s, fallbackTitle) => ({
      title: s?.title || fallbackTitle,
      ideaHook: s?.ideaHook || "",
      desc: s?.desc || "",
      duration: +s?.duration || Math.ceil((+time||20)/3),
      materials: Array.isArray(s?.materials) ? s.materials.filter(Boolean) : [],
      steps: Array.isArray(s?.steps) ? s.steps.filter(Boolean) : [],
      exitTicket: s?.exitTicket || "",
      expectedImpact: s?.expectedImpact || "",
      diff: {
        lowMotivation: s?.diff?.lowMotivation || "",
        differentiation: s?.diff?.differentiation || ""
      }
    });

    const body = JSON.stringify({
      meta: data?.meta || {},
      sets: {
        movement: cleanSet(data?.sets?.movement, "نشاط صفّي حركي"),
        group:    cleanSet(data?.sets?.group, "نشاط صفّي جماعي"),
        individual: cleanSet(data?.sets?.individual, "نشاط صفّي فردي"),
      },
      tips: Array.isArray(data?.tips) ? data.tips.filter(Boolean) : []
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      body
    };
  } catch (err) {
    console.error("mulham error:", err);
    return { statusCode: 500, body: String(err?.message || err) };
  }
};
