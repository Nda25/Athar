// netlify/functions/gemini-ethraa.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event) => {
  // CORS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
      },
    };
  }

  try {
    const { subject, stage } = JSON.parse(event.body || "{}");
    if (!subject || !stage) {
      return { statusCode: 400, body: JSON.stringify({ ok:false, error:"subject & stage required" }) };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ ok:false, error:"No GEMINI_API_KEY" }) };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
أنت خبير محتوى تعليمي. أعطني بالضبط JSON فقط بلا أي نص زائد.
الموضوع: "${subject}"، المرحلة: "${stage}".

أرجِع حقولًا عربية قصيرة وواضحة.
الشكل النهائي المطلوب:

{
  "cards": [
    { "title": "عنوان", "brief": "لماذا؟ (سطر واحد)", "idea": "اقتراح قابل للتنفيذ (سطران)" },
    { "title": "...",   "brief": "...",                "idea": "..." },
    { "title": "...",   "brief": "...",                "idea": "..." },
    { "title": "...",   "brief": "...",                "idea": "..." },
    { "title": "...",   "brief": "...",                "idea": "..." },
    { "title": "...",   "brief": "...",                "idea": "..." }
  ]
}

تعليمات مهمة:
- أرجِع JSON صالح فقط.
- بدون علامات **ماركداون** (لا نجوم ولا ## ولا "عنوان:").
- اجعل كل قيمة نصًا قصيرًا (<= 140 حرفًا).
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text() || "";

    // التقط أول كائن JSON صالح
    const jsonString = (()=>{
      const m = text.match(/\{[\s\S]*\}/);
      return m ? m[0] : "{}";
    })();

    let parsed = {};
    try { parsed = JSON.parse(jsonString); } catch (_) { parsed = {}; }

    // تنظيف + ضمان الحقول
    const cards = (parsed.cards || []).map(c => ({
      title: sanitize(c.title),
      brief: sanitize(c.brief),
      idea:  sanitize(c.idea),
    })).filter(x => x.title || x.brief || x.idea);

    if (!cards.length) {
      //Fallback صغير
      const s = subject;
      return ok([{title:`لماذا ${s} مهم اليوم؟`,brief:`مثال حياتي معاصر يقرّب المفهوم.`,idea:`افتتاح بصورة/موقف وسؤال موجّه.`}]);
    }

    return ok(cards);
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ ok:false, error:"server_error" }) };
  }
};

function ok(cards){
  return {
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ ok: true, cards })
  };
}
function sanitize(s){
  return String(s || "")
    .replace(/\*\*?|__|##+|\*|^- /gm, "")
    .replace(/\s*[:：]\s*$/,"")
    .trim();
}
