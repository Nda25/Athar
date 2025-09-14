// netlify/functions/gemini-ethraa.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event) => {
  // CORS بسيط
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST,OPTIONS"
      }
    };
  }

  try {
    const { subject, stage } = JSON.parse(event.body || "{}");
    if (!subject || !stage) {
      return { statusCode: 400, body: JSON.stringify({ ok:false, msg:"subject & stage required" }) };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ ok:false, msg:"Missing GEMINI_API_KEY" }) };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
أنت مساعد للمعلم. أعطني 6 بطاقات إثراء مختصرة وعمليّة حول المادة: "${subject}" وللمرحلة: "${stage}".
كل بطاقة تحتوي:
- عنوان جذّاب (قصير)
- لماذا هذه الفكرة مهمّة؟
- اقتراح نشاط عملي/تطبيقي (خطوتين إلى أربع خطوات)
- وسم/تصنيفين مناسبين

التزم باللغة العربية، واجعل البطاقات قابلة للاستخدام مباشرة في الفصل. لا تضع روابط.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // تقسيم النص لبطاقات بسيطة (اعتمادًا على سطور فارغة)
    const rawCards = text.split(/\n{2,}/).filter(Boolean).slice(0, 6);

    const cards = rawCards.map((block) => {
      // محاولة استخراج الحقول
      const title = (block.match(/^(?:[-*•]\s*)?(.+?)$/m) || [,"بطاقة"])[1].trim();
      const why   = (block.match(/لماذا[^:\n]*[:：]\s*(.+)/) || [,"—"])[1].trim();
      const idea  = (block.match(/اقتراح[^:\n]*[:：]\s*(.+)/) || [,"—"])[1].trim();
      return { title, brief: why, idea };
    });

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok:true, cards })
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ ok:false, msg: "Server error" }) };
  }
};
