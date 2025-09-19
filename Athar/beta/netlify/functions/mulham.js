// netlify/functions/mulham.js
// مُلهم: توليد أنشطة (حركي/جماعي/فردي) + وصف مختصر + خطوات + تذكرة خروج + الأثر المتوقع
// يدعم: بدون أدوات (zero-prep) + تكييف منخفض التحفيز + فروق فردية + بدائل

const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    // 1) مفاتيح البيئة
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is missing");
      return { statusCode: 500, body: "Missing GEMINI_API_KEY" };
    }

    // 2) جسم الطلب
    let payload = {};
    try { payload = JSON.parse(event.body || "{}"); }
    catch { return { statusCode: 400, body: "Bad JSON body" }; }

    const {
      subject = "",
      topic   = "",
      time    = 20,
      bloom   = "understand",
      age     = "p2",
      noTools = false,
      adaptLow  = false,
      adaptDiff = false,
      variant = ""
    } = payload;

    const AGE_LABEL = { p1:"ابتدائي دنيا", p2:"ابتدائي عليا", m:"متوسط", h:"ثانوي" };
    const ageLabel = AGE_LABEL[age] || "ابتدائي عليا";

    // 3) تبني البرومبت
    const constraints = [];
    if (noTools) constraints.push("يجب أن تكون كل الأنشطة Zero-prep (بدون قص/لصق/بطاقات/أدوات).");
    constraints.push(`الزمن المتاح إجماليًا ~ ${time} دقيقة؛ اجعل كل نشاط قابلاً للتنفيذ داخل هذا السقف.`);
    constraints.push(`بلوم/المستوى المستهدف: ${bloom}. المرحلة: ${ageLabel}.`);
    constraints.push("قدّم أفكارًا مبتكرة وممتعة وثريّة تحفّز حب المادة.");
    constraints.push("أعطِ خطوات عملية دقيقة يمكن تنفيذها فورًا في الصف.");

    const adaptations = [];
    if (adaptLow)  adaptations.push("تكيف منخفض التحفيز: مهام قصيرة جدًا، مكافآت دقيقة وفورية، أدوار بسيطة، وقفات حركة.");
    if (adaptDiff) adaptations.push("فروق فردية: ثلاث مستويات (سهل/متوسط/متقدم) أو اختيارات متعددة للمنتج النهائي.");

    const prompt = `
أنت مصمم تعلمي خبير في الأنشطة الصفّية القصيرة المبتكرة.
أنتج حزمة أنشطة ضمن ثلاث فئات:
1) أنشطة صفّية حركية، 2) أنشطة صفّية جماعية، 3) أنشطة صفّية فردية.
لكل فئة قدّم 2–3 أنشطة قوية.
المجال: "${subject}"، الموضوع: "${topic || subject}".

${constraints.map(s => "- " + s).join("\n")}
${adaptations.length ? "\nالتكييفات المطلوبة:\n" + adaptations.map(s=>"- "+s).join("\n") : ""}

أجب **فقط** بصيغة JSON مطابقة للمخطط التالي:
{
  "meta": { "subject": "...", "topic": "...", "time": 20, "bloom": "...", "age": "...", "variant": "..." },
  "categories": [
    { "name": "أنشطة صفّية حركية",
      "activities": [
        {
          "title": "...",
          "summary": "...",
          "steps": ["...", "..."],
          "exit": "...",
          "impact": "...",
          "zeroPrep": true,
          "notes": "..."
        }
      ]
    },
    { "name": "أنشطة صفّية جماعية", "activities": [...] },
    { "name": "أنشطة صفّية فردية", "activities": [...] }
  ]
}
بدون أي نص خارج JSON.
`.trim();

    // 4) تهيئة Gemini + (المهم) شكل الاستدعاء الصحيح
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const req = {
      contents: [
        { role: "user", parts: [{ text: prompt }] }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        candidateCount: 1,
        maxOutputTokens: 2048,
        temperature: 0.8,
        topK: 64,
        topP: 0.9
      }
    };

    // ⭐ هنا التغيير: نمرّر "كائن" فيه contents/generationConfig
    const result = await model.generateContent(req);

    // 5) نأخذ النص ونحوّله JSON
    const text =
      (typeof result?.response?.text === "function" ? result.response.text() : "") ||
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "";

    if (!text) {
      console.error("Empty response from model", result);
      return { statusCode: 502, body: "Empty response from model" };
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // إزالة ```json إن وُجدت
      const cleaned = text.replace(/```json|```/g, "").trim();
      try { data = JSON.parse(cleaned); }
      catch (e) {
        console.error("Model returned non-JSON:", cleaned.slice(0, 400));
        return { statusCode: 500, body: "Model returned non-JSON response" };
      }
    }

    if (!data || !Array.isArray(data.categories)) {
      console.error("Invalid JSON shape", data);
      return { statusCode: 500, body: "Invalid JSON shape" };
    }

    // 6) نضيف meta مفيدة للواجهة
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
    // نطبع الخطأ كامل عشان يظهر في Logs
    console.error("Mulham error:", err);
    const msg = (err && err.stack) ? err.stack : (err?.message || String(err));
    return { statusCode: 500, body: `Mulham function failed: ${msg}` };
  }
};
