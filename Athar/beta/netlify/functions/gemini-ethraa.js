const { CORS, preflight } = require("./_cors.js");
// netlify/functions/gemini-ethraa.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ضبطي النطاق 3..6 وبنفس الوقت أزيلي التكرار
const clampCards = (arr, min = 3, max = 6) => {
  if (!Array.isArray(arr)) return [];
  const uniq = [];
  const seen = new Set();
  for (const it of arr) {
    const t = (it?.title || '').trim();
    const i = (it?.idea || '').trim();
    if (!t || !i) continue;
    const key = (t + '|' + i).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push({
      title: t,
      brief: String(it?.brief || '').trim(),
      idea: i,
      source: it?.source ? String(it.source).trim() : undefined,
      evidence_date: it?.evidence_date || null, // YYYY-MM-DD أو null
      freshness: it?.freshness || null          // "new"|"general"|null
    });
    if (uniq.length >= max) break;
  }
  return uniq.length ? uniq : [];
};

const stageLabel = (code) => ({
  p1: 'ابتدائي دُنيا',
  p2: 'ابتدائي عُليا',
  m:  'متوسط',
  h:  'ثانوي'
}[code] || code);

// فرق أيام
function daysBetween(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.valueOf())) return Infinity;
    const now = new Date();
    return Math.floor((now - d) / (1000 * 60 * 60 * 24));
  } catch { return Infinity; }
}

// يصنّف البطاقة قديمة/جديدة
function tagFreshness(card) {
  const days = card?.evidence_date ? daysBetween(card.evidence_date) : Infinity;
  const fresh = days <= 180 ? 'new' : 'general'; // 6 أشهر
  card.freshness = fresh;
  return card;
}

exports.handler = async (event) => {
  const pre = preflight(event);
  if (pre) return pre;
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { subject, stage, focus = 'auto', lesson } = JSON.parse(event.body || '{}');
    if (!subject) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'missing_subject' }) };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'missing_api_key' }) };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // نستخدم pro لصرامة أعلى في الالتزام
const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.0-pro' });

    // نطاق الزمن
    const now = new Date();
    const y = now.getFullYear();
    const since = `${y - 1}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // تعليمات نظام — JSON فقط + حقول زمنية
    const baseSystem = `
أنت مساعد إثرائي عربي للمعلمين. أعد بطاقات مُلهمة **بصيغة JSON فقط**:
{
 "cards":[
   {
     "title":"...",           // موجز وجذاب وغير مكرر
     "brief":"...",           // لماذا هذه الفكرة مهمة/مشوقة تربويًا
     "idea":"...",            // خطوات تطبيق صفية قصيرة وواضحة وقابلة للتنفيذ
     "source":"https://...",  // مصدر موثوق (اختياري)
     "evidence_date":"YYYY-MM-DD" // تاريخ حديث مستدل من المصدر/الحدث إن توفّر، وإلا null
   }
 ]
}
- من 3 إلى 6 بطاقات.
- اجعل الأفكار **ابتكارية غير مكررة**، قابلة للتطبيق وقصيرة (5–10 دقائق).
- راعِ المرحلة "${stageLabel(stage)}" في الأسلوب واللغة.
- إن لم تتوفر مصادر حديثة، أبقِ "source" فارغًا و"evidence_date": null.
- لا تكتب أي نص خارج JSON.
`.trim();

    // قوالب الاستعلامات (تبديل حسب التركيز)
    const qLatest = (s, st) => `
أريد 3–6 بطاقات عن **أحدث المستجدات** والبحوث/الأخبار المبسطة في "${s}" (منذ ${since})،
وبأسلوب يناسب "${stageLabel(st)}".
اربط كل بطاقة بفكرة صفية قصيرة قابلة للتنفيذ. ضَع "evidence_date" إن أمكن.
${lesson ? `اربط إن أمكن بدرس "${lesson}" دون تكرار صريح.` : ''}
`.trim();

    const qMyth = (s, st) => `
أريد 3–6 خرافات/تصورات خاطئة شائعة في "${s}" مع **تصحيح علمي مبسّط** يناسب "${stageLabel(st)}".
اجعل "idea" نشاطًا قصيرًا يكشف الخرافة ويُصحّحها. ضَع "source" موثوقًا إن أمكن.
${lesson ? `يفضّل الربط الضمني بدرس "${lesson}" دون تكرار العنوان.` : ''}
`.trim();

    const qOdd = (s, st) => `
أريد 3–6 حقائق **مدهشة وموثوقة** في "${s}" مناسبة لـ "${stageLabel(st)}"،
مع "idea" عرض/تجربة صفية آمنة سريعة. إن وُجد مصدر حديث أضِف "source" و"evidence_date".
`.trim();

    const qIdeas = (s, st) => `
أريد 3–6 أفكار إثرائية عملية لمادة "${s}" تناسب "${stageLabel(st)}"
(نشاط، مشروع صغير، تجربة آمنة) بخطوات واضحة ومخرجات قابلة للملاحظة.
`.trim();

    // خطوط المحاولة
    const pipelines = {
      latest: [qLatest, qMyth, qOdd, qIdeas],
      myth:   [qMyth, qLatest, qOdd, qIdeas],
      odd:    [qOdd, qLatest, qMyth, qIdeas],
      ideas:  [qIdeas, qLatest, qMyth, qOdd],
      auto:   [qLatest, qMyth, qOdd, qIdeas]
    };
    const tries = pipelines[focus] || pipelines.auto;

    // توليد أساسي
    let cards = [];
    for (const q of tries) {
      try {
        const prompt = `${baseSystem}\n\n${q(subject, stage)}`.trim();
        const result = await model.generateContent(prompt);
        const text = (await result.response).text().trim();
        const cleaned = text.replace(/^```json/gi, '')
                            .replace(/^```/gi, '')
                            .replace(/```$/,'')
                            .trim();
        const parsed = JSON.parse(cleaned);
        const out = clampCards(parsed.cards || []);
        if (out.length) {
          cards = out.map(tagFreshness);
          break;
        }
      } catch (err) {
        console.error('ethraa-step-error:', err?.message || err);
      }
    }

    // fallback لما يفشل كليًا
    if (!cards.length) {
      cards = clampCards([
        {
          title: `بحث مصغّر سريع حول "${subject}"`,
          brief: "حتى عند غياب أخبار ساخنة، نحفّز الفضول بالبحث المصغّر المنظم.",
          idea: `قسّمي الطلبة لفرق صغيرة. كل فريق يجمع 3 حقائق موثوقة حديثة عن "${subject}" (آخر 12 شهرًا) ويذكر المصدر، ثم يقدمها في 60 ثانية.`,
          source: undefined,
          evidence_date: null
        },
        {
          title: "حقيقتان وخرافة",
          brief: "لعبة سريعة تكشف المفاهيم الخاطئة وتُصححها.",
          idea: "اكتبي 3 عبارات: 2 صحيحة و1 خاطئة متداولة في المادة. اطلبوا من الطلبة تخمين الخرافة ولماذا، ثم قدّمي التصحيح.",
          source: undefined,
          evidence_date: null
        },
        {
          title: "بطاقة دهشة",
          brief: "معلومة مدهشة تقود لسؤال مفتوح قصير.",
          idea: "ابدئي الحصة بمعلومة غريبة آمنة وموثوقة مرتبطة بالدرس، واطلبي من طالبين ربطها بالمفهوم الأساسي بالدرس في دقيقة.",
          source: undefined,
          evidence_date: null
        }
      ]).map(tagFreshness);
    }

    // لو أغلب البطاقات قديمة (>= 6 أشهر) جهّزي بدائل "قريبة من المجال"
    const staleCount = cards.filter(c => (c.freshness || 'general') === 'general').length;
    let nearby = [];
    if (cards.length && staleCount === cards.length) {
      try {
        const promptNearby = `${baseSystem}

أعطني 3–6 بطاقات **بديلة قريبة من مجال** "${subject}" ولكن تركّز على توجهات حديثة خلال 12 شهرًا
(تقنيات، استراتيجيات حيوية، تطبيقات ناشئة) وبأسلوب "${stageLabel(stage)}".
أكّد على الابتكار والتطبيق الصفّي السريع. ضَع "evidence_date" حديثًا إن أمكن.
${lesson ? `يفضّل مواءمة ضمنية مع "${lesson}".` : ''}`.trim();

        const result = await model.generateContent(promptNearby);
        const text = (await result.response).text().trim();
        const cleaned = text.replace(/^```json/gi, '')
                            .replace(/^```/gi, '')
                            .replace(/```$/,'')
                            .trim();
        const parsed = JSON.parse(cleaned);
        nearby = clampCards(parsed.cards || []).map(tagFreshness);
      } catch (e) {
        console.error('ethraa-nearby-error:', e?.message || e);
      }
    }

    // بصمة عدم التكرار (للاستخدام الاختياري في الواجهة إن رغبت)
    const sig = (d) => {
      const s = (d.title || '') + '|' + (d.idea || '');
      let h=0; for (let i=0;i<s.length;i++){ h=((h<<5)-h)+s.charCodeAt(i); h|=0; }
      return String(h);
    };

    const payload = {
      ok: true,
      cards,
      // تظهر فقط عند قِدم النتائج الأساسية
      nearby: nearby.length ? nearby : undefined,
      _meta: {
        subject, stage, focus: focus || 'auto', lesson: lesson || null,
        all_stale: !!(cards.length && staleCount === cards.length),
        count: cards.length,
        dedup_sigs: cards.map(sig)
      }
    };

    return {
      statusCode: 200,
      headers: { ...CORS },
      body: JSON.stringify(payload)
    };
  } catch (e) {
    console.error('ethraa-fatal:', e?.message || e);
    return { statusCode: 500, headers: { ...CORS }, body: JSON.stringify({ ok: false, error: 'server_error' }) };
  }
};
