// netlify/functions/mulham.js
// مُلهم: توليد أنشطة (حركي/جماعي/فردي) + وصف مختصر + خطوات + تذكرة خروج + الأثر المتوقع
// يدعم: بدون أدوات (zero-prep) + تكييف منخفض التحفيز + فروق فردية + بدائل (variant)

const { GoogleGenerativeAI } = require("@google/generative-ai");

// Hash بسيط لإنتاج فهرس ثابت بناءً على المدخلات (لتنويع الاختيار من الأنشطة)
function hashInt(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return Math.abs(h >>> 0);
}

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

    const AGE_LABEL = { p1:"ابتدائي دُنيا", p2:"ابتدائي عُليا", m:"متوسط", h:"ثانوي" };
    const ageLabel = AGE_LABEL[age] || "ابتدائي عُليا";

    // 3) برومبت صارم مع تكييف المرحلة
    const constraints = [];
    if (noTools) constraints.push("يجب أن تكون كل الأنشطة Zero-prep (بدون قص/لصق/بطاقات/أدوات).");
    constraints.push(`الزمن المتاح إجماليًا ~ ${time} دقيقة؛ اجعل كل نشاط قابلاً للتنفيذ داخل هذا السقف.`);
    constraints.push(`مستوى بلوم المستهدف: ${bloom}. المرحلة الدراسية: ${ageLabel}.`);
    constraints.push("استخدم لغة ومفردات وأمثلة **مناسبة تمامًا** للمرحلة، وتجنّب التعقيد غير المناسب.");
    constraints.push("كل نشاط يجب أن يتضمن خطوات عملية دقيقة قابلة للتنفيذ فورًا داخل الصف.");
    constraints.push("أعد اقتراحات متنوعة وليست متشابهة حرفيًا بين الفئات.");

    const adaptations = [];
    if (adaptLow)  adaptations.push("تكيف منخفض التحفيز: مهام قصيرة جدًا، مكافآت فورية، أدوار بسيطة، فواصل حركة.");
    if (adaptDiff) adaptations.push("فروق فردية: ثلاث مستويات (سهل/متوسط/متقدم) أو بدائل للمنتج النهائي.");

    // نجعل البذرة جزءًا من البرومبت لتشجيع التنويع
    const seedNote = `بذرة التنويع: ${variant || "base"}`;

    const prompt = `
أنت مصمم تعلمي خبير في الأنشطة الصفّية القصيرة المبتكرة.
أنتج حزمة أنشطة ضمن ثلاث فئات:
1) أنشطة صفّية حركية، 2) أنشطة صفّية جماعية، 3) أنشطة صفّية فردية.
لكل فئة قدّم **٢ إلى ٣** أنشطة قوية ومختلفة.
المجال: "${subject}"، الموضوع: "${topic || subject}".

${constraints.map(s => "- " + s).join("\n")}
${adaptations.length ? "\nالتكييفات المطلوبة:\n" + adaptations.map(s=>"- "+s).join("\n") : ""}

${seedNote}

أجب **فقط** بصيغة JSON مطابقة تمامًا للمخطط التالي:
{
  "meta": { "subject": "...", "topic": "...", "time": 20, "bloom": "...", "age": "...", "variant": "..." },
  "categories": [
    { "name": "أنشطة صفّية حركية",
      "activities": [
        {
          "title": "...",
          "summary": "...",
          "duration": 8,
          "materials": ["..."],
          "steps": ["...", "..."],
          "exit": "...",
          "impact": "...",
          "zeroPrep": true,
          "lowMotivation": "...",
          "differentiation": "...",
          "notes": "..."
        }
      ]
    },
    { "name": "أنشطة صفّية جماعية", "activities": [...] },
    { "name": "أنشطة صفّية فردية", "activities": [...] }
  ],
  "tips": ["...", "..."]
}
بدون أي نص خارج JSON.
`.trim();

    // 4) Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const req = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        candidateCount: 1,
        maxOutputTokens: 2048,
        temperature: 0.85,
        topK: 64,
        topP: 0.9
      }
    };

    const result = await model.generateContent(req);

    // 5) JSON parsing
    const text =
      (typeof result?.response?.text === "function" ? result.response.text() : "") ||
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "";

    if (!text) {
      console.error("Empty response from model", result);
      return { statusCode: 502, body: "Empty response from model" };
    }

    let data;
    try { data = JSON.parse(text); }
    catch {
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

    // ===== اختيار نشاط مختلف لكل فئة بناء على hash من المعطيات =====
    function normalizeActivity(a = {}) {
      // تقدير مدة افتراضية إن لم يرجعها الموديل
      const dur = typeof a.duration === "number" && a.duration > 0 ? a.duration : Math.max(5, Math.min(20, Math.round(time / 2)));
      return {
        ideaHook:        a.ideaHook || a.title || "",
        desc:            a.summary  || a.description || "",
        duration:        dur,
        materials:       Array.isArray(a.materials) ? a.materials : [],
        steps:           Array.isArray(a.steps) ? a.steps : [],
        exitTicket:      a.exit  || a.exitTicket || "",
        expectedImpact:  a.impact || a.expectedImpact || "",
        diff: {
          lowMotivation:   a.lowMotivation || a.diff_low || "",
          differentiation: a.differentiation || a.diff_levels || ""
        }
      };
    }

    const seedStr = `${variant}|${topic}|${age}|${bloom}|${time}`;
    const idxSeed = hashInt(seedStr);

    function pickActivity(cat) {
      const acts = Array.isArray(cat?.activities) ? cat.activities : [];
      if (acts.length === 0) return {};
      const idx = idxSeed % acts.length;
      return normalizeActivity(acts[idx]);
    }

    const sets = { movement:{}, group:{}, individual:{} };

    for (const cat of (data.categories || [])) {
      const name = (cat.name || "").toLowerCase();
      if (name.includes("حرك")) {
        sets.movement = pickActivity(cat);
      } else if (name.includes("جمع")) {
        sets.group = pickActivity(cat);
      } else if (name.includes("فرد")) {
        sets.individual = pickActivity(cat);
      }
    }

    // احتياطي بالتتابع إذا لم تُعرف الأسماء
    const cats = data.categories || [];
    if (!sets.movement.ideaHook && cats[0]) sets.movement  = pickActivity(cats[0]);
    if (!sets.group.ideaHook     && cats[1]) sets.group     = pickActivity(cats[1]);
    if (!sets.individual.ideaHook&& cats[2]) sets.individual= pickActivity(cats[2]);

    const tips = Array.isArray(data.tips) ? data.tips : [];

    const meta = {
      subject: subject || "",
      topic:   topic || subject || "",
      time, bloom, age, variant: variant || "",
      adaptLow, adaptDiff
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ meta, sets, tips })
    };

  } catch (err) {
    console.error("Mulham error:", err);
    const msg = (err && err.stack) ? err.stack : (err?.message || String(err));
    return { statusCode: 500, body: `Mulham function failed: ${msg}` };
  }
};
