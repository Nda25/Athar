// netlify/functions/mulham.js
// مُلهم: توليد أنشطة (حركي/جماعي/فردي) + وصف مختصر + خطوات + تذكرة خروج + الأثر المتوقع
// يدعم: بدون أدوات (zero-prep) + تكييف منخفض التحفيز + فروق فردية + بدائل

const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event) => {
  try {
    // نسمح فقط بـ POST
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
      bloom   = "understand",   // remember | understand | apply | analyze | create
      age     = "p2",           // p1 | p2 | m | h
      noTools = false,          // أنشطة صفر تجهيز
      adaptLow  = false,        // تكييف: منخفض التحفيز
      adaptDiff = false,        // تكييف: فروق فردية
      variant = ""              // لتوليد بدائل
    } = payload;

    const AGE_LABEL = { p1:"ابتدائي دنيا", p2:"ابتدائي عليا", m:"متوسط", h:"ثانوي" };
    const ageLabel = AGE_LABEL[age] || "ابتدائي عليا";

    // 3) نص التعليمات للنموذج
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
    {
      "name": "أنشطة صفّية حركية",
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
  ],
  "tips": ["اختياري: نصائح قصيرة ..."]
}
بدون أي نص خارج JSON.
`.trim();

    // 4) استدعاء Gemini بالشكل الصحيح (contents + generationConfig)
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const req = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        candidateCount: 1,
        maxOutputTokens: 2048,
        temperature: 0.8,
        topK: 64,
        topP: 0.9
      }
    };

    const result = await model.generateContent(req);

    // 5) نلتقط النص ونحوّله إلى JSON
    const text =
      (typeof result?.response?.text === "function" ? result.response.text() : "") ||
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!text) {
      console.error("Empty response from model", result);
      return { statusCode: 502, body: "Empty response from model" };
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
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

    // ================== التحويل إلى الشكل الذي تتوقعه الواجهة ==================

    // نحاول تحويل categories -> sets (حركي/جماعي/فردي)
    function normalizeActivity(a) {
      return {
        ideaHook:        a?.ideaHook || a?.title || "",
        desc:            a?.summary  || a?.description || "",
        duration:        a?.duration || undefined,      // إن وُجد
        materials:       a?.materials || [],            // إن وُجد
        steps:           a?.steps || [],
        exitTicket:      a?.exit  || a?.exitTicket || "",
        expectedImpact:  a?.impact || a?.expectedImpact || "",
        diff: {
          lowMotivation:   a?.lowMotivation || a?.diff_low || "",
          differentiation: a?.differentiation || a?.diff_levels || ""
        }
      };
    }

    const sets = { movement:{}, group:{}, individual:{} };

    // نمسك أول نشاط في كل فئة (الواجهة تعرض نشاطًا واحدًا لكل فئة)
    for (const cat of (data.categories || [])) {
      const name = (cat.name || "").toLowerCase();
      const first = (cat.activities || [])[0] || {};
      const norm  = normalizeActivity(first);

      if (name.includes("حرك")) {          // أنشطة صفّية حركية
        sets.movement = norm;
      } else if (name.includes("جمع")) {   // أنشطة صفّية جماعية
        sets.group = norm;
      } else if (name.includes("فرد")) {   // أنشطة صفّية فردية
        sets.individual = norm;
      }
    }

    // احتياط: إن ما تعرّفت الأسماء نُسقطها بالترتيب
    const cats = data.categories || [];
    if (!sets.movement.ideaHook && cats[0]) sets.movement   = normalizeActivity((cats[0].activities||[])[0]||{});
    if (!sets.group.ideaHook     && cats[1]) sets.group      = normalizeActivity((cats[1].activities||[])[0]||{});
    if (!sets.individual.ideaHook&& cats[2]) sets.individual = normalizeActivity((cats[2].activities||[])[0]||{});

    // meta بالشكل الذي تستخدمه الواجهة
    const meta = {
      subject: subject || "",
      topic:   topic || subject || "",
      time,
      bloom,
      age,
      variant: variant || "",
      // معلومات إضافية مفيدة للعرض (اختياري)
      ageLabel: ageLabel,
      bloomLabel: bloom
    };

    // tips إن وُجدت
    const tips = Array.isArray(data.tips) ? data.tips : [];

    // نُعيد الشكل الذي تتوقعه الواجهة
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ meta, sets, tips })
    };

    // ==========================================================================

  } catch (err) {
    console.error("Mulham error:", err);
    const msg = (err && err.stack) ? err.stack : (err?.message || String(err));
    return { statusCode: 500, body: `Mulham function failed: ${msg}` };
  }
};// netlify/functions/mulham.js
// مُلهم: توليد أنشطة (حركي/جماعي/فردي) + وصف مختصر + خطوات + تذكرة خروج + الأثر المتوقع
// يدعم: بدون أدوات (zero-prep) + تكييف منخفض التحفيز + فروق فردية + بدائل

const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event) => {
  try {
    // نسمح فقط بـ POST
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
      bloom   = "understand",   // remember | understand | apply | analyze | create
      age     = "p2",           // p1 | p2 | m | h
      noTools = false,          // أنشطة صفر تجهيز
      adaptLow  = false,        // تكييف: منخفض التحفيز
      adaptDiff = false,        // تكييف: فروق فردية
      variant = ""              // لتوليد بدائل
    } = payload;

    const AGE_LABEL = { p1:"ابتدائي دنيا", p2:"ابتدائي عليا", m:"متوسط", h:"ثانوي" };
    const ageLabel = AGE_LABEL[age] || "ابتدائي عليا";

    // 3) نص التعليمات للنموذج
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
    {
      "name": "أنشطة صفّية حركية",
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
  ],
  "tips": ["اختياري: نصائح قصيرة ..."]
}
بدون أي نص خارج JSON.
`.trim();

    // 4) استدعاء Gemini بالشكل الصحيح (contents + generationConfig)
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const req = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        candidateCount: 1,
        maxOutputTokens: 2048,
        temperature: 0.8,
        topK: 64,
        topP: 0.9
      }
    };

    const result = await model.generateContent(req);

    // 5) نلتقط النص ونحوّله إلى JSON
    const text =
      (typeof result?.response?.text === "function" ? result.response.text() : "") ||
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!text) {
      console.error("Empty response from model", result);
      return { statusCode: 502, body: "Empty response from model" };
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
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

    // ================== التحويل إلى الشكل الذي تتوقعه الواجهة ==================

    // نحاول تحويل categories -> sets (حركي/جماعي/فردي)
    function normalizeActivity(a) {
      return {
        ideaHook:        a?.ideaHook || a?.title || "",
        desc:            a?.summary  || a?.description || "",
        duration:        a?.duration || undefined,      // إن وُجد
        materials:       a?.materials || [],            // إن وُجد
        steps:           a?.steps || [],
        exitTicket:      a?.exit  || a?.exitTicket || "",
        expectedImpact:  a?.impact || a?.expectedImpact || "",
        diff: {
          lowMotivation:   a?.lowMotivation || a?.diff_low || "",
          differentiation: a?.differentiation || a?.diff_levels || ""
        }
      };
    }

    const sets = { movement:{}, group:{}, individual:{} };

    // نمسك أول نشاط في كل فئة (الواجهة تعرض نشاطًا واحدًا لكل فئة)
    for (const cat of (data.categories || [])) {
      const name = (cat.name || "").toLowerCase();
      const first = (cat.activities || [])[0] || {};
      const norm  = normalizeActivity(first);

      if (name.includes("حرك")) {          // أنشطة صفّية حركية
        sets.movement = norm;
      } else if (name.includes("جمع")) {   // أنشطة صفّية جماعية
        sets.group = norm;
      } else if (name.includes("فرد")) {   // أنشطة صفّية فردية
        sets.individual = norm;
      }
    }

    // احتياط: إن ما تعرّفت الأسماء نُسقطها بالترتيب
    const cats = data.categories || [];
    if (!sets.movement.ideaHook && cats[0]) sets.movement   = normalizeActivity((cats[0].activities||[])[0]||{});
    if (!sets.group.ideaHook     && cats[1]) sets.group      = normalizeActivity((cats[1].activities||[])[0]||{});
    if (!sets.individual.ideaHook&& cats[2]) sets.individual = normalizeActivity((cats[2].activities||[])[0]||{});

    // meta بالشكل الذي تستخدمه الواجهة
    const meta = {
      subject: subject || "",
      topic:   topic || subject || "",
      time,
      bloom,
      age,
      variant: variant || "",
      // معلومات إضافية مفيدة للعرض (اختياري)
      ageLabel: ageLabel,
      bloomLabel: bloom
    };

    // tips إن وُجدت
    const tips = Array.isArray(data.tips) ? data.tips : [];

    // نُعيد الشكل الذي تتوقعه الواجهة
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ meta, sets, tips })
    };

    // ==========================================================================

  } catch (err) {
    console.error("Mulham error:", err);
    const msg = (err && err.stack) ? err.stack : (err?.message || String(err));
    return { statusCode: 500, body: `Mulham function failed: ${msg}` };
  }
};
