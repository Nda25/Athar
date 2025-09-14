// netlify/functions/ethraa.js
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async (req) => {
  try {
    const body = await req.json();
    const subject = (body.subject || "").trim();
    const stage   = (body.stage || "p2").trim(); // p1/p2/m/h
    if (!subject) {
      return new Response(JSON.stringify({ ok:false, error:"subject_required" }), { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `
أنت خبير مناهج. أعطني بطاقات "إثراء" حديثة لمعلم مادة: "${subject}"
وللمرحلة: "${({p1:"ابتدائي دنيا", p2:"ابتدائي عليا", m:"متوسط", h:"ثانوي"}[stage] || stage)}".
أعِد JSON فقط (مصفوفة) من 6 عناصر، كل عنصر:
{ "title": "...", "brief": "...", "idea": "...", "sources":[{"title":"...","why":"...","url":"..."}] }
- اجعل الأفكار قصيرة وعملية ومناسبة للعمر.
- إن لم تتوفر مصادر مناسبة، أعد "sources": [].
`;

    const result = await model.generateContent(prompt);
    const text   = result.response.text();

    let items = [];
    try { items = JSON.parse(text); }
    catch {
      const cleaned = text.replace(/```json|```/g, "").trim();
      items = JSON.parse(cleaned);
    }

    items = (Array.isArray(items)?items:[]).slice(0,6).map(x=>({
      title:   x.title   || "فكرة إثرائية",
      brief:   x.brief   || "",
      idea:    x.idea    || "",
      sources: Array.isArray(x.sources) ? x.sources.slice(0,3) : []
    }));

    return Response.json({ ok:true, items });
  } catch (err) {
    return new Response(JSON.stringify({ ok:false, error: err.message }), { status: 500 });
  }
};
