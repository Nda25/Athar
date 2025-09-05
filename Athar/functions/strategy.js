exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // نحاول نقرأ JSON بأمان
  let payload = {};
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: "Bad JSON body" }; }

  const { subject, bloomType, lesson } = payload;

  // مفتاح Gemini من متغيّرات البيئة في Netlify
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return { statusCode: 500, body: "Missing GEMINI_API_KEY" };
  }

  const MODEL = "gemini-2.5-flash-preview-05-20";

  const typePart   = (bloomType && bloomType !== "الكل") ? `(تصنيف بلوم: "${bloomType}")` : "";
  const lessonPart = lesson ? `ومناسبة لدرس "${lesson}"` : "";

  const prompt =
`أنا معلمة ثانوي. أريد استراتيجية تدريس لمادة ${subject} ${typePart} ${lessonPart}.
اكتبي بطاقة استراتيجية عملية بصيغة JSON بالمفاتيح الآتية:
strategy_name (نص)، bloom (نص)، importance (نص واحد)، materials (نص واحد)،
goals (مصفوفة نصوص 3–6 عناصر)، steps (مصفوفة خطوات مرقمة 4–8)،
examples (مصفوفة 2–4)، assessment (نص قصير)،
diff_support (نص)، diff_core (نص)، diff_challenge (نص)،
expected_impact (نص قصير يصف الأثر المتوقع من تطبيق الاستراتيجية على الطلاب)،
citations (مصفوفة كائنات {title, benefit} حيث title هو اسم المصدر و benefit هو شرح موجز لفائدة المصدر للمعلمة).
اللغة: عربية فصحى واضحة، مختصرة ولكن دقيقة، بدون مقدمات إنشائية.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          strategy_name: { type: "STRING" },
          bloom:         { type: "STRING" },
          importance:    { type: "STRING" },
          materials:     { type: "STRING" },
          goals:         { type: "ARRAY", items: { type: "STRING" } },
          steps:         { type: "ARRAY", items: { type: "STRING" } },
          examples:      { type: "ARRAY", items: { type: "STRING" } },
          assessment:    { type: "STRING" },
          diff_support:  { type: "STRING" },
          diff_core:     { type: "STRING" },
          diff_challenge:{ type: "STRING" },
          expected_impact:{type:"STRING"},
          citations:     { type: "ARRAY", items: { type: "OBJECT", properties: {
            title:   { type: "STRING" },
            benefit: { type: "STRING" }
          }}}
        }
      }
    }
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const txt = await res.text(); // ممكن يرجع HTML خطأ
      return { statusCode: res.status, body: txt };
    }

    const json = await res.json();

    // نستخرج النص الخام ثم نحوله JSON
    const raw =
      json?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    let data;
    try { data = JSON.parse(raw); }
    catch { return { statusCode: 502, body: "Bad model JSON: " + raw.slice(0, 300) }; }

    if (!data?.strategy_name) {
      return { statusCode: 502, body: "Incomplete response from model" };
    }

    data._meta = { subject, bloomType: bloomType || "", lesson: lesson || "" };

    return {
      statusCode: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return { statusCode: 500, body: String(err?.message || err) };
  }
};