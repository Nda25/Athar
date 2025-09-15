// netlify/functions/gemini-ethraa.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

const clamp = (arr, min=3, max=6) => {
  if (!Array.isArray(arr)) return [];
  const uniq = [];
  const seen = new Set();
  for (const it of arr) {
    const key = (it.title||'') + '|' + (it.idea||'');
    if (!seen.has(key) && it.title && it.idea) {
      seen.add(key);
      uniq.push({
        title: String(it.title).trim(),
        brief: String(it.brief||'').trim(),
        idea:  String(it.idea||'').trim(),
        source: it.source ? String(it.source).trim() : undefined
      });
    }
    if (uniq.length >= max) break;
  }
  // لو أقل من الحد الأدنى، رجّعي الموجود كما هو
  return uniq.length >= min ? uniq : uniq;
};

// تبسيط أسماء المراحل (تظهر فقط لموازنة الأسلوب)
const stageLabel = (code) => ({
  p1:'ابتدائي دُنيا', p2:'ابتدائي عُليا', m:'متوسط', h:'ثانوي'
}[code] || code);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { subject, stage, focus='auto' } = JSON.parse(event.body||'{}');
    if (!subject) {
      return { statusCode: 400, body: JSON.stringify({ ok:false, error:'missing_subject' }) };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ ok:false, error:'missing_api_key' }) };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    // نص عام للـ prompt يضمن JSON فقط
    const baseSystem = `
أنت مساعد إثرائي للمعلمين بالعربية. أعد بطاقات مُلهمة مختصرة بصيغة JSON فقط:
{
 "cards":[
   {"title":"...", "brief":"...", "idea":"...", "source":"https://... (اختياري)"},
   ...
 ]
}
- الحد الأدنى 3 بطاقات والحد الأعلى 6.
- "title" موجز وجذاب.
- "brief" لماذا هذه الفكرة مهمة/مشوقة.
- "idea" تطبيق عملي داخل الحصة/مهمة قصيرة.
- إن وجدت مصدراً موثوقاً (خبر/بحث) أضفه في "source".
- لا تكتب أي نص خارج JSON.
`.trim();

    // السنة والفترة
    const now = new Date();
    const y = now.getFullYear();
    const since = `${y-1}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

    // قوالب الاستعلامات
    const qLatest = (s, st) => `
أعطني بطاقات عن أحدث المستجدات والبحوث/الأخبار المبسطة في "${s}" خلال آخر 12 شهرًا (منذ ${since})،
مناسبة لمستوى "${stageLabel(st)}"، وباللغة العربية، مع روابط مصادر موثوقة إن أمكن.
`.trim();

    const qMyth = (s, st) => `
أشهر 3-6 خرافات/تصورات خاطئة في "${s}" مع التصحيح العلمي المبسط (لمستوى "${stageLabel(st)}")،
واجعل "idea" نشاطًا قصيرًا يكشف الفكرة الخاطئة ويُصححها.
`.trim();

    const qOdd = (s, st) => `
3-6 حقائق غريبة ومدهشة وموثوقة في "${s}" مناسبة لـ "${stageLabel(st)}"،
واجعل "idea" طريقة عرض/تجربة صفية صغيرة (بدون أدوات خطرة).
`.trim();

    const qIdeas = (s, st) => `
3-6 أفكار إثرائية عملية لمادة "${s}" تناسب "${stageLabel(st)}" (نشاط، مشروع صغير، تجربة آمنة)،
مع "brief" قيمة تربوية مختصرة و"idea" خطوات التنفيذ.
`.trim();

    // قائمة المحاولات حسب التركيز المطلوب
    const pipelines = {
      latest: [qLatest, qMyth, qOdd, qIdeas],
      myth:   [qMyth, qLatest, qOdd, qIdeas],
      odd:    [qOdd, qLatest, qMyth, qIdeas],
      ideas:  [qIdeas, qLatest, qMyth, qOdd],
      auto:   [qLatest, qMyth, qOdd, qIdeas]
    };

    const tries = pipelines[focus] || pipelines.auto;

    let cards = [];
    for (const q of tries) {
      // نرسل instruction واضح
      const prompt = `${baseSystem}\n\n${q(subject, stage)}`.trim();

      try {
        const result = await model.generateContent(prompt);
        const text = (await result.response).text().trim();

        // حاول قراءة JSON مباشرة — لو فيه "```" نظّفه
        const cleaned = text
          .replace(/^```json/gi,'')
          .replace(/^```/gi,'')
          .replace(/```$/,'')
          .trim();

        const parsed = JSON.parse(cleaned);
        const out = clamp(parsed.cards || []);
        if (out.length) {
          cards = out;
          break;
        }
      } catch (err) {
        // جرّب التالي
        console.error('ethraa-step-error:', err?.message || err);
      }
    }

    if (!cards.length) {
      cards = clamp([
        {
          title: `بحث مصغّر سريع حول "${subject}"`,
          brief: "حتى عند غياب أخبار ساخنة، نحفّز الفضول بالبحث المصغّر المنظّم.",
          idea: `قسّمي الطلبة لفرق صغيرة. كل فريق يجمع 3 حقائق موثوقة حديثة عن "${subject}" (آخر 12 شهرًا) ويذكر المصدر، ثم يقدمها في 60 ثانية.`,
          source: undefined
        },
        {
          title: "حقيقتان وخرافة",
          brief: "لعبة سريعة تكشف المفاهيم الخاطئة وتُصححها.",
          idea: "اكتبي 3 عبارات: 2 صحيحة و1 خاطئة متداولة في المادة. اطلبوا من الطلبة تخمين الخرافة ولماذا، ثم قدّمي التصحيح."
        },
        {
          title: "بطاقة دهشة",
          brief: "معلومة مدهشة تقود لسؤال مفتوح قصير.",
          idea: "ابدئي الحصة بمعلومة غريبة آمنة وموثوقة مرتبطة بالدرس، واطلبي من طالبين ربطها بالمفهوم الأساسي بالدرس في دقيقة."
        }
      ], 3, 6);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ ok: true, cards })
    };
  } catch (e) {
    console.error('ethraa-fatal:', e?.message || e);
    return { statusCode: 500, body: JSON.stringify({ ok:false, error:'server_error' }) };
  }
};
