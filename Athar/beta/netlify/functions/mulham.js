// netlify/functions/mulham.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: "Missing GEMINI_API_KEY" };
    }

    let payload = {};
    try { payload = JSON.parse(event.body || "{}"); }
    catch { return { statusCode: 400, body: "Bad JSON body" }; }

    const {
      subject = "",
      topic = "",
      time = 20,
      bloom = "understand",
      age = "p2",
      noTools = false,
      adaptLow = false,
      adaptDiff = false,
      variant = ""
    } = payload;

    const ageLabel = { p1:"ابتدائي دنيا", p2:"ابتدائي عليا", m:"متوسط", h:"ثانوي" }[age] || "ابتدائي عليا";

    const constraints = [];
    if (noTools) constraints.push("يجب أن تكون كل الأنشطة Zero-prep (بدون قص/لصق/بطاقات/أدوات).");
    constraints.push(`الزمن المتاح إجماليًا ~ ${time} دقيقة؛ اجعل كل نشاط قابلاً للتنفيذ داخل هذا السقف.`);
    constraints.push(`بلوم/المستوى المستهدف: ${bloom}. المرحلة: ${ageLabel}.`);
    constraints.push("أفكار مبتكرة ممتعة تُحفّز حب المادة. أعطِ خطوات عملية قابلة للتنفيذ فورًا في الصف.");

    const adaptations = [];
    if (adaptLow)  adaptations.push("تكيف لذوي التحفيز المنخفض: تقطيع المهمة + مكافآت فورية + أدوار بسيطة + حركات خفيفة.");
    if (adaptDiff) adaptations.push("تكيف فروق فردية: مستويات صعوبة ثلاثية أو خيارات متعددة للمنتج النهائي.");

    const systemPrompt = `
أنت مصمم تعلمي خبير في الأنشطة الصفّية القصيرة المبتكرة. 
أنتج حزمة أنشطة ضمن ثلاث فئات:
1) أنشطة صفّية حركية، 2) أنشطة صفّية جماعية، 3) أنشطة صفّية فردية.
لكل فئة قدّم 2–3 أنشطة قوية.
المجال: "${subject}"، الموضوع: "${topic || subject}".
${constraints.map(s=>"- "+s).join("\n")}
${adaptations.length ? "\nالتكييفات المطلوبة:\n" + adaptations.map(s=>"- "+s).join("\n") : ""}

أعِد الإجابة **على هيئة JSON فقط** بالشكل:
{
  "meta": { "subject": "...", "topic": "...", "time": 20, "bloom": "...", "age": "${age}", "variant": "${variant}" },
  "categories": [
    { "name": "أنشطة صفّية حركية", "activities": [
      { "title":"...", "summary":"...", "steps":["...","..."], "exit":"...", "impact":"...", "zeroPrep":true, "notes":"..." }
    ]},
    { "name": "أنشطة صفّية جماعية", "activities": [ ... ]},
    { "name": "أنشطة صفّية فردية", "activities": [ ... ]}
  ]
}
بدون أي نص خارج JSON.
`.trim();

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    // (SDK) الصيغة المفضلة لتمرير المحتوى
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: systemPrompt }] }]
    });

    const rawText = result?.response?.text();
    if (!rawText) {
      return { statusCode: 502, body: "Empty response from model" };
    }

    let data;
    try { data = JSON.parse(rawText); }
    catch {
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      data = JSON.parse(cleaned); // لو فشل بيرمي catch الخارجي
    }

    if (!data || !Array.isArray(data.categories)) {
      return { statusCode: 500, body: "Invalid JSON shape" };
    }

    // تأكيد meta (حتى لو رجعها الموديل)
    data.meta = {
      subject: subject || "",
      topic: topic || subject || "",
      time, bloom, age, variant
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(data)
    };
  }
  catch (err) {
    // إرجاع تفاصيل للمساعدة على التصحيح (يمكن إزالتها لاحقًا)
    const msg = (err && (err.stack || err.message)) ? String(err.stack || err.message) : String(err);
    console.error("Mulham error:", msg);
    return { statusCode: 500, body: `Mulham function failed: ${msg}` };
  }
};// netlify/functions/mulham.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: "Missing GEMINI_API_KEY" };
    }

    let payload = {};
    try { payload = JSON.parse(event.body || "{}"); }
    catch { return { statusCode: 400, body: "Bad JSON body" }; }

    const {
      subject = "",
      topic = "",
      time = 20,
      bloom = "understand",
      age = "p2",
      noTools = false,
      adaptLow = false,
      adaptDiff = false,
      variant = ""
    } = payload;

    const ageLabel = { p1:"ابتدائي دنيا", p2:"ابتدائي عليا", m:"متوسط", h:"ثانوي" }[age] || "ابتدائي عليا";

    const constraints = [];
    if (noTools) constraints.push("يجب أن تكون كل الأنشطة Zero-prep (بدون قص/لصق/بطاقات/أدوات).");
    constraints.push(`الزمن المتاح إجماليًا ~ ${time} دقيقة؛ اجعل كل نشاط قابلاً للتنفيذ داخل هذا السقف.`);
    constraints.push(`بلوم/المستوى المستهدف: ${bloom}. المرحلة: ${ageLabel}.`);
    constraints.push("أفكار مبتكرة ممتعة تُحفّز حب المادة. أعطِ خطوات عملية قابلة للتنفيذ فورًا في الصف.");

    const adaptations = [];
    if (adaptLow)  adaptations.push("تكيف لذوي التحفيز المنخفض: تقطيع المهمة + مكافآت فورية + أدوار بسيطة + حركات خفيفة.");
    if (adaptDiff) adaptations.push("تكيف فروق فردية: مستويات صعوبة ثلاثية أو خيارات متعددة للمنتج النهائي.");

    const systemPrompt = `
أنت مصمم تعلمي خبير في الأنشطة الصفّية القصيرة المبتكرة. 
أنتج حزمة أنشطة ضمن ثلاث فئات:
1) أنشطة صفّية حركية، 2) أنشطة صفّية جماعية، 3) أنشطة صفّية فردية.
لكل فئة قدّم 2–3 أنشطة قوية.
المجال: "${subject}"، الموضوع: "${topic || subject}".
${constraints.map(s=>"- "+s).join("\n")}
${adaptations.length ? "\nالتكييفات المطلوبة:\n" + adaptations.map(s=>"- "+s).join("\n") : ""}

أعِد الإجابة **على هيئة JSON فقط** بالشكل:
{
  "meta": { "subject": "...", "topic": "...", "time": 20, "bloom": "...", "age": "${age}", "variant": "${variant}" },
  "categories": [
    { "name": "أنشطة صفّية حركية", "activities": [
      { "title":"...", "summary":"...", "steps":["...","..."], "exit":"...", "impact":"...", "zeroPrep":true, "notes":"..." }
    ]},
    { "name": "أنشطة صفّية جماعية", "activities": [ ... ]},
    { "name": "أنشطة صفّية فردية", "activities": [ ... ]}
  ]
}
بدون أي نص خارج JSON.
`.trim();

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    // (SDK) الصيغة المفضلة لتمرير المحتوى
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: systemPrompt }] }]
    });

    const rawText = result?.response?.text();
    if (!rawText) {
      return { statusCode: 502, body: "Empty response from model" };
    }

    let data;
    try { data = JSON.parse(rawText); }
    catch {
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      data = JSON.parse(cleaned); // لو فشل بيرمي catch الخارجي
    }

    if (!data || !Array.isArray(data.categories)) {
      return { statusCode: 500, body: "Invalid JSON shape" };
    }

    // تأكيد meta (حتى لو رجعها الموديل)
    data.meta = {
      subject: subject || "",
      topic: topic || subject || "",
      time, bloom, age, variant
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(data)
    };
  }
  catch (err) {
    // إرجاع تفاصيل للمساعدة على التصحيح (يمكن إزالتها لاحقًا)
    const msg = (err && (err.stack || err.message)) ? String(err.stack || err.message) : String(err);
    console.error("Mulham error:", msg);
    return { statusCode: 500, body: `Mulham function failed: ${msg}` };
  }
};
