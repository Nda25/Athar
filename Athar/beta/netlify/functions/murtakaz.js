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
      goalCount, notes, level, adapt
    } = JSON.parse(event.body || "{}");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: "Missing GEMINI_API_KEY" };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const AGE_LABELS = { p1: "ابتدائي دُنيا", p2: "ابتدائي عُليا", m: "متوسط", h: "ثانوي" };
    const ageLabel = AGE_LABELS[age] || age || "—";

    const prompt = `
أنت مخطط دروس ذكي. أعِد النتائج بصيغة JSON صالحة فقط (بدون أي شرح خارج JSON).
راعي الفئة العمرية (${ageLabel}) وزمن الحصة (${duration || 45} دقيقة)
ومستوى بلوم الأساسي "${bloomMain}" والداعم "${bloomSupport || "—"}".
عند إدخال نص للتحليل: استخرج موضوعًا مناسبًا ووافق الأهداف معه.

أعِد حقول JSON التالية:
{
  "meta": {
    "topic": "عنوان مختصر",
    "age": "${age || ""}",
    "ageLabel": "${ageLabel}",
    "mainBloomLabel": "${bloomMain || ""}",
    "supportBloomLabel": "${bloomSupport || ""}"
  },
  "goals": [ ${Array.from({length: Math.max(1, +goalCount || 2)}).map(()=>`"__"`).join(", ")} ],
  "success": "__",
  "structure": ["قبل: __", "أثناء: __", "بعد: __"],
  "activities": ["نشاط رئيسي مخصص للموضوع", "نشاط داعم مخصص"],
  "assessment": ["س١: __", "س٢: __", "س٣: __"],
  "diff": ["دعم: __", "إثراء: __", "مرونة العرض: __"],
  "oneMin": "نص الدقيقة الواحدة الملائم"
}

المعطيات:
- المادة: ${subject || "—"}
- النمط: ${mode}
- الموضوع (إن وجد): ${topic || "—"}
- النص للتحليل (إن وجد): ${(sourceText || "—").slice(0,1200)}
- ملاحظات: ${notes || "—"}
- مستوى الصف: ${level || "—"}
- تعلم تكيفي: ${adapt ? "نعم" : "لا"}

أخرِج JSON فقط.
`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    const raw = (result.response.text() || "").trim();
    console.log("RAW from Gemini:", raw); // يظهر في Netlify logs

    // جرّب التقاط JSON حتى لو فيه كلام زائد
    let payload;
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      payload = JSON.parse(m ? m[0] : raw);
    } catch (e) {
      console.error("JSON parse failed:", e);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "Gemini output is not valid JSON", raw })
      };
    }

    const safeArr = (a) => Array.isArray(a) ? a.filter(Boolean) : [];
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
