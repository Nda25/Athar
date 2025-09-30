
const { CORS, preflight } = require("./_cors.js");
const { GoogleGenerativeAI } = require('@google/generative-ai');

exports.handler = async (event) => {
  const pre = preflight(event);
  if (pre) return pre;
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { ...CORS }, body: "Method Not Allowed" };
  }
  let payload = {};
  try { payload = JSON.parse(event.body || "{}" ); }
  catch { return { statusCode: 400, headers: { ...CORS }, body: "Bad JSON body" }; }
  const { stage, subject, bloomType, lesson, variant } = payload;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: { ...CORS }, body: "Missing GEMINI_API_KEY" };
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });

  // بناء البرومبت
  const typePart   = (bloomType && bloomType !== "الكل") ? `(تصنيف بلوم: \"${bloomType}\")` : "(تصنيف بلوم: اختاري مستويات ملائمة)";
  const lessonPart = lesson ? `ومناسبة لدرس \"${lesson}\"` : "";
  const VARIANT_NOTE = `\n- IMPORTANT: أعطِ استراتيجية مختلفة جذريًا عن أي مقترح سابق. غيّر آلية التنظيم (محطات/تعاقب أدوار/مناظرة/قلب الصف/مسرحة/لعب أدوار/مختبر مصغّر/محاكاة .).\n- strategy_name فريد 100%، لا يُكرر أسماء الدروس/المواد أو أي عبارة وردت في الطلب.\n- استخدم بذرة تنويع داخلية (novelty seed): ${[
    stage || "any-stage",
    subject || "any-subject",
    bloomType || "any-bloom",
    (lesson || "any-lesson"),
    (variant || Date.now())
  ].join(" | ")}\n- لا تعيدي أي صياغات سبق استخدامها ضمن نفس الفكرة؛ بدّلي الزاوية والمنتج النهائي ومخرجات التعلم وأساليب التقويم كليًا.`;
  const BASE_PROMPT = `أريد استراتيجية تدريس لمادة ${subject} ${typePart} ${lessonPart}.\n${VARIANT_NOTE}\n\nالقيود الإلزامية:\n- أعطِ خطوات \"قابلة للتنفيذ\" تبدأ بصيغة زمنية (مثال: \"الدقيقة 0–5: .\").\n- اجعل \"goals\" قابلة للقياس (أفعال سلوكية + معيار %/عدد/زمن).\n- اجعل \"assessment\" يشمل أدوات تقويم عملية + \"روبرك مختصر\" (3 مستويات مع مؤشرات).\n- اربط كل ذلك بمستويات بلوم الملائمة داخل \"bloom\" (يمكن مستوى أو مستويان).\n- \"diff_support/core/challenge\": أنشطة مختلفة حقيقية، لكل مستوى مخرج observable (منتج/أداء).\n- \"materials\": مواد محددة وواضحة (اكتبيها كسطر واحد مفصول بـ \"؛ \".).\n- \"examples\": أمثلة تطبيق واقعية مبتكرة وغير مباشرة، لا تُكرر محتوى الخطوات.\n- \"expected_impact\": صياغة أثر متوقّع مع مؤشرات نجاح (مثلاً: % إتقان، عدد مُنتجات، زمن إنجاز).\n\nأرسلي **فقط** JSON وفق المخطط التالي واملئي كل الحقول بنصوص غير فارغة:\n- goals: 3 إلى 6 عناصر (صياغة قابلة للقياس)\n- steps: 4 إلى 8 عناصر (ابدئي كل عنصر بـ \"الدقيقة X–Y\")\n- examples: 2 إلى 4 عناصر (جديدة عن الخطوات)\n- صِيغي بلغة عربية دقيقة ومختصرة ومناسبة للعمر؛ بدون أي نص خارجي خارج JSON.`;

  try {
    const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: BASE_PROMPT }] }] });
    const raw = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    let data;
    try { data = JSON.parse(raw); } catch { data = { error: "Bad model JSON" }; }
    return {
      statusCode: 200,
      headers: { ...CORS },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...CORS },
      body: JSON.stringify({ error: err.message || "Gemini error" })
    };
  }
}

