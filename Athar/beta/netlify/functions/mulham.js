// netlify/functions/mulham.js
// مُلهم: توليد أنشطة (حركي/جماعي/فردي) + وصف مختصر + خطوات + تذكرة خروج + الأثر المتوقع
// يدعم: بدون أدوات (zero-prep) + تكييف منخفض التحفيز + فروق فردية + بدائل/تنويعات

const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    // اقرأ متغير البيئة بأمان
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: "Missing GEMINI_API_KEY" };
    }

    // فكّ الجسم (body) بأمان
    let payload = {};
    try {
      payload = JSON.parse(event.body || "{}");
    } catch (_) {
      return { statusCode: 400, body: "Bad JSON body" };
    }

    // مدخلات مع قيم افتراضية
    const {
      subject = "",
      topic = "",
      time = 20,                  // بالدقائق
      bloom = "understand",       // remember | understand | apply | analyze
      age = "p2",                 // p1 | p2 | m | h
      noTools = false,            // أنشطة صفر تجهيز
      adaptLow = false,           // تكييف: منخفض التحفيز
      adaptDiff = false,          // تكييف: فروق فردية
      variant = ""                // لتفريع “بدائل أكثر”
    } = payload;

    // نحدد تصنيف الأعمار
    const ageLabel = {
      p1: "ابتدائي دنيا",
      p2: "ابتدائي عليا",
      m:  "متوسط",
      h:  "ثانوي",
    }[age] || "ابتدائي عليا";

    // سنطلب JSON منظّم
    const schema = {
      type: "object",
      properties: {
        meta: {
          type: "object",
          properties: {
            subject: { type: "string" },
            topic:   { type: "string" },
            time:    { type: "number" },
            bloom:   { type: "string" },
            age:     { type: "string" },
            variant: { type: "string" }
          },
          required: ["subject","topic","time","bloom","age"]
        },
        categories: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },              // "أنشطة صفّية حركية"...
              activities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title:   { type: "string" },
                    summary: { type: "string" },      // وصف مختصر
                    steps:   { type: "array", items: { type: "string" } },
                    exit:    { type: "string" },      // تذكرة الخروج
                    impact:  { type: "string" },      // الأثر المتوقع
                    zeroPrep:{ type: "boolean" },     // هل تلبي "بدون أدوات"
                    notes:   { type: "string" }       // ملاحظات/تنويعات
                  },
                  required: ["title","summary","steps","exit","impact"]
                }
              }
            },
            required: ["name","activities"]
          }
        }
      },
      required: ["meta","categories"]
    };

    // بناء التعليمات للنموذج
    const constraints = [];
    if (noTools) constraints.push("يجب أن تكون كل الأنشطة Zero-prep (بدون قص/لصق/بطاقات/أدوات).");
    constraints.push(`الزمن المتاح إجماليًا ~ ${time} دقيقة؛ اجعل كل نشاط قابلاً للتنفيذ داخل هذا السقف.`);
    constraints.push(`بلوم/المستوى المستهدف: ${bloom}. المرحلة: ${ageLabel}.`);
    constraints.push("قَدّم أفكارًا مبتكرة وممتعة وثريّة تحفّز حب المادة، وليست أفكارًا مكررة.");
    constraints.push("لا تذكر أدوات أو أوراق إن كان خيار Zero-prep مفعّلاً.");
    constraints.push("أعطِ خطوات عملية دقيقة يمكن تنفيذها فورًا في الصف.");

    const adaptations = [];
    if (adaptLow)  adaptations.push("أضف تكيفًا لذوي التحفيز المنخفض: تقسيم المهمة إلى أجزاء قصيرة، مكافآت فورية دقيقة، أدوار بسيطة، حركات خفيفة.");
    if (adaptDiff) adaptations.push("أضف تكيف فروق فردية: مستويات صعوبة ثلاثية (سهل/متوسط/متقدم) أو اختيارات متعددة للمنتج النهائي.");

    const systemPrompt =
`أنت مصمم تعلمي خبير في الأنشطة الصفّية القصيرة المبتكرة. 
أنتج حزمة أنشطة ضمن ثلاث فئات: 
1) أنشطة صفّية حركية، 2) أنشطة صفّية جماعية، 3) أنشطة صفّية فردية.
لكل فئة قدّم 2–3 أنشطة قوية. 
المجال: "${subject}"، الموضوع: "${topic || subject}".
${constraints.map(s => "- " + s).join("\n")}
${adaptations.length ? "\nالتكييفات المطلوبة:\n" + adaptations.map(s=>"- "+s).join("\n") : ""}

أعد الإجابة على هيئة JSON فقط مطابق تمامًا للمخطط المطلوب (schema). لا تضِف أي نص خارج JSON.`;

    // تهيئة Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      // نطلب مخرجات JSON
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    // الطلب
    const result = await model.generateContent(systemPrompt);

    // التقط النص
    const text = result?.response?.text?.() || result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!text) {
      return { statusCode: 502, body: "Empty response from model" };
    }

    // حاول نحلّل JSON بصرامة
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      // أحيانًا النموذج يضيف كود بلوك ```json … نحاول ننظفه
      const cleaned = text.replace(/```json|```/g, "").trim();
      try {
        data = JSON.parse(cleaned);
      } catch (e2) {
        return {
          statusCode: 500,
          body: "Model returned non-JSON response"
        };
      }
    }

    // تحقق بسيط من الحقول
    if (!data || !Array.isArray(data.categories)) {
      return { statusCode: 500, body: "Invalid JSON shape" };
    }

    // أضف ميتا
    data.meta = {
      subject: subject || "",
      topic: topic || subject || "",
      time,
      bloom,
      age,
      variant: variant || ""
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(data)
    };

  } catch (err) {
    // سجل الخطأ في اللوج
    console.error("Mulham error:", err);
    return { statusCode: 500, body: "Mulham function failed" };
  }
};// netlify/functions/mulham.js
// مُلهم: توليد أنشطة (حركي/جماعي/فردي) + وصف مختصر + خطوات + تذكرة خروج + الأثر المتوقع
// يدعم: بدون أدوات (zero-prep) + تكييف منخفض التحفيز + فروق فردية + بدائل/تنويعات

const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    // اقرأ متغير البيئة بأمان
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: "Missing GEMINI_API_KEY" };
    }

    // فكّ الجسم (body) بأمان
    let payload = {};
    try {
      payload = JSON.parse(event.body || "{}");
    } catch (_) {
      return { statusCode: 400, body: "Bad JSON body" };
    }

    // مدخلات مع قيم افتراضية
    const {
      subject = "",
      topic = "",
      time = 20,                  // بالدقائق
      bloom = "understand",       // remember | understand | apply | analyze
      age = "p2",                 // p1 | p2 | m | h
      noTools = false,            // أنشطة صفر تجهيز
      adaptLow = false,           // تكييف: منخفض التحفيز
      adaptDiff = false,          // تكييف: فروق فردية
      variant = ""                // لتفريع “بدائل أكثر”
    } = payload;

    // نحدد تصنيف الأعمار
    const ageLabel = {
      p1: "ابتدائي دنيا",
      p2: "ابتدائي عليا",
      m:  "متوسط",
      h:  "ثانوي",
    }[age] || "ابتدائي عليا";

    // سنطلب JSON منظّم
    const schema = {
      type: "object",
      properties: {
        meta: {
          type: "object",
          properties: {
            subject: { type: "string" },
            topic:   { type: "string" },
            time:    { type: "number" },
            bloom:   { type: "string" },
            age:     { type: "string" },
            variant: { type: "string" }
          },
          required: ["subject","topic","time","bloom","age"]
        },
        categories: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },              // "أنشطة صفّية حركية"...
              activities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title:   { type: "string" },
                    summary: { type: "string" },      // وصف مختصر
                    steps:   { type: "array", items: { type: "string" } },
                    exit:    { type: "string" },      // تذكرة الخروج
                    impact:  { type: "string" },      // الأثر المتوقع
                    zeroPrep:{ type: "boolean" },     // هل تلبي "بدون أدوات"
                    notes:   { type: "string" }       // ملاحظات/تنويعات
                  },
                  required: ["title","summary","steps","exit","impact"]
                }
              }
            },
            required: ["name","activities"]
          }
        }
      },
      required: ["meta","categories"]
    };

    // بناء التعليمات للنموذج
    const constraints = [];
    if (noTools) constraints.push("يجب أن تكون كل الأنشطة Zero-prep (بدون قص/لصق/بطاقات/أدوات).");
    constraints.push(`الزمن المتاح إجماليًا ~ ${time} دقيقة؛ اجعل كل نشاط قابلاً للتنفيذ داخل هذا السقف.`);
    constraints.push(`بلوم/المستوى المستهدف: ${bloom}. المرحلة: ${ageLabel}.`);
    constraints.push("قَدّم أفكارًا مبتكرة وممتعة وثريّة تحفّز حب المادة، وليست أفكارًا مكررة.");
    constraints.push("لا تذكر أدوات أو أوراق إن كان خيار Zero-prep مفعّلاً.");
    constraints.push("أعطِ خطوات عملية دقيقة يمكن تنفيذها فورًا في الصف.");

    const adaptations = [];
    if (adaptLow)  adaptations.push("أضف تكيفًا لذوي التحفيز المنخفض: تقسيم المهمة إلى أجزاء قصيرة، مكافآت فورية دقيقة، أدوار بسيطة، حركات خفيفة.");
    if (adaptDiff) adaptations.push("أضف تكيف فروق فردية: مستويات صعوبة ثلاثية (سهل/متوسط/متقدم) أو اختيارات متعددة للمنتج النهائي.");

    const systemPrompt =
`أنت مصمم تعلمي خبير في الأنشطة الصفّية القصيرة المبتكرة. 
أنتج حزمة أنشطة ضمن ثلاث فئات: 
1) أنشطة صفّية حركية، 2) أنشطة صفّية جماعية، 3) أنشطة صفّية فردية.
لكل فئة قدّم 2–3 أنشطة قوية. 
المجال: "${subject}"، الموضوع: "${topic || subject}".
${constraints.map(s => "- " + s).join("\n")}
${adaptations.length ? "\nالتكييفات المطلوبة:\n" + adaptations.map(s=>"- "+s).join("\n") : ""}

أعد الإجابة على هيئة JSON فقط مطابق تمامًا للمخطط المطلوب (schema). لا تضِف أي نص خارج JSON.`;

    // تهيئة Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      // نطلب مخرجات JSON
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    // الطلب
    const result = await model.generateContent(systemPrompt);

    // التقط النص
    const text = result?.response?.text?.() || result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!text) {
      return { statusCode: 502, body: "Empty response from model" };
    }

    // حاول نحلّل JSON بصرامة
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      // أحيانًا النموذج يضيف كود بلوك ```json … نحاول ننظفه
      const cleaned = text.replace(/```json|```/g, "").trim();
      try {
        data = JSON.parse(cleaned);
      } catch (e2) {
        return {
          statusCode: 500,
          body: "Model returned non-JSON response"
        };
      }
    }

    // تحقق بسيط من الحقول
    if (!data || !Array.isArray(data.categories)) {
      return { statusCode: 500, body: "Invalid JSON shape" };
    }

    // أضف ميتا
    data.meta = {
      subject: subject || "",
      topic: topic || subject || "",
      time,
      bloom,
      age,
      variant: variant || ""
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(data)
    };

  } catch (err) {
    // سجل الخطأ في اللوج
    console.error("Mulham error:", err);
    return { statusCode: 500, body: "Mulham function failed" };
  }
};
