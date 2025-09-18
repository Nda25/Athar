// netlify/functions/murtakaz.js
import { GoogleGenerativeAI } from "@google/generative-ai";

export const handler = async (event) => {
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
    if (!apiKey) return { statusCode: 500, body: "Missing GEMINI_API_KEY" };

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const ageLabel = ({p1:"ابتدائي دُنيا", p2:"ابتدائي عُليا", m:"متوسط", h:"ثانوي"}[age] || age);
    const prompt = `
أنت مخطط دروس ذكي. أعطني مخرجات منظمة بصيغة JSON فقط بدون شرح.
اجعل كل عنصر محددًا ودقيقًا للموضوع المطلوب، ومناسبًا للفئة العمرية (${ageLabel}) وزمن الحصة (${duration} دقيقة)،
وارتكز على مستوى بلوم الأساسي "${bloomMain}" والداعم "${bloomSupport || "—"}".
إن كان الإدخال نصًا للتحليل، استخرج الموضوع المناسب ومواءمة الأهداف معه.

الحقول المطلوبة في JSON:
{
  "meta": {
    "topic": "عنوان مختصر للدرس",
    "age": "${age}",
    "ageLabel": "${ageLabel}",
    "mainBloomLabel": "${bloomMain}",
    "supportBloomLabel": "${bloomSupport || ""}"
  },
  "goals": ["${goalCount} أهداف واضحة مبنية على أفعال بلوم المناسبة للموضوع"],
  "success": "معيار نجاح واحد واضح وقابل للقياس مرتبط بالأهداف",
  "structure": ["قبل: ...", "أثناء: ...", "بعد: ..."],
  "activities": ["نشاط رئيسي وواحد داعم على الأقل، مخصصان للموضوع"],
  "assessment": ["س١ ...", "س٢ ...", "س٣ ..."],
  "diff": ["دعم: ...", "إثراء: ...", "مرونة العرض: ..."],
  "oneMin": "نص خطة الدقيقة الواحدة الملائم للموضوع"
}

المعطيات:
- المادة: ${subject || "—"}
- نمط الإدخال: ${mode}
- الموضوع (إن وُجد): ${topic || "—"}
- نص للتحليل (إن وُجد): ${sourceText ? sourceText.slice(0,1200) : "—"}
- ملاحظات خاصة: ${notes || "—"}
- تقدير مستوى الصف: ${level || "—"}
- تفعيل التعلم التكيفي: ${adapt ? "نعم" : "لا"}

التزم بكتابة JSON صالح فقط.
`;

    const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
    const text = result.response.text().trim();

    // حاول قراءة JSON حتى لو أضاف النموذج نصوصًا زائدة
    const jsonMatch = text.match(/\{[\s\S]*\}$/);
    const payload = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);

    // حماية: اضمن وجود مفاتيح أساسية
    const safe = (arr) => Array.isArray(arr) ? arr.filter(Boolean) : [];
    const body = JSON.stringify({
      meta: payload.meta || { topic: topic || "—", age, ageLabel, mainBloomLabel: bloomMain, supportBloomLabel: bloomSupport },
      goals: safe(payload.goals),
      success: payload.success || "",
      structure: safe(payload.structure),
      activities: safe(payload.activities),
      assessment: safe(payload.assessment),
      diff: safe(payload.diff),
      oneMin: payload.oneMin || ""
    });

    return { statusCode: 200, headers: { "Content-Type": "application/json; charset=utf-8" }, body };

  } catch (err) {
    console.error("murtakaz error:", err);
    return { statusCode: 500, body: String(err?.message || err) };
  }
};
