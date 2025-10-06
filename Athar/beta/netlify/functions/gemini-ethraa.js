// netlify/functions/gemini-ethraa.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

/* ========== أدوات مساعدة عامة ========== */

// إزالة التكرار وضبط العدد 3..6 مع توحيد الحقول حسب الـ focus
function clampAndNormalize(arr, focus, { min = 3, max = 6 } = {}) {
  if (!Array.isArray(arr)) return [];

  const normed = [];
  const seen = new Set();

  for (const raw of arr) {
    const card = normalizeCard(raw, focus);
    if (!card) continue;

    // مفتاح إزالة التكرار
    const keyBase =
      focus === 'myth'
        ? (card.myth || '') + '|' + (card.truth || '')
        : (card.title || '') + '|' + (card.fact || card.insight || card.summary || card.idea || '');
    const key = keyBase.toLowerCase().trim();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);

    normed.push(card);
    if (normed.length >= max) break;
  }

  return normed.length >= Math.min(min, max) ? normed : [];
}

// توحيد الحقول حسب نوع التركيز (محتوى أولًا، والنشاط اختياري)
function normalizeCard(it, focus) {
  if (!it || typeof it !== 'object') return null;

  const trim = (s) => (s == null ? '' : String(s).trim());

  // حقول عامة مشتركة
  const common = {
    title: trim(it.title || it.headline || it.label),
    brief: trim(it.brief || it.why || it.reason || it.context || it.summary),
    source: it.source ? trim(it.source) : undefined,
    evidence_date: it.evidence_date ? trim(it.evidence_date) : null,
  };

  if (focus === 'myth') {
    // نطلب خرافة محددة + الحقيقة + تفسير موجز. الفكرة الصفية (idea) اختيارية.
    const myth = trim(it.myth || it.claim || it.misconception || it.false_statement);
    const truth = trim(it.truth || it.fact || it.correction || it.scientific_explanation);
    const explanation = trim(it.explanation || it.explain || it.rationale || it.why);
    const idea = trim(it.idea || it.activity || '');

    if (!myth || !truth) return null;

    // عنوان تلقائي إن لم يوجد
    const title = common.title || `خرافة: ${myth.slice(0, 40)}…`;

    return {
      type: 'myth',
      title,
      myth,
      truth,
      explanation,
      idea: idea || undefined,
      ...common,
    };
  }

  if (focus === 'latest') {
    const insight = trim(it.insight || it.finding || it.news || it.fact || it.summary);
    if (!insight) return null;
    const idea = trim(it.idea || it.classroom || '');
    const title = common.title || 'مستجدّ حديث';
    return {
      type: 'latest',
      title,
      insight,
      idea: idea || undefined,
      ...common,
    };
  }

  if (focus === 'odd') {
    const fact = trim(it.fact || it.wow || it.surprise || it.truth);
    if (!fact) return null;
    const explanation = trim(it.explanation || it.why || '');
    const idea = trim(it.idea || it.demo || '');
    const title = common.title || 'حقيقة مدهشة';
    return {
      type: 'odd',
      title,
      fact,
      explanation: explanation || undefined,
      idea: idea || undefined,
      ...common,
    };
  }

  // ideas (أفكار إثرائية) — نحافظ على المحتوى الواضح + خطوات مختصرة
  const fact = trim(it.fact || it.content || '');
  const idea = trim(it.idea || it.activity || it.steps || '');
  if (!fact && !idea) return null;
  const title = common.title || 'فكرة إثرائية';
  return {
    type: 'idea',
    title,
    fact: fact || undefined,
    idea: idea || undefined,
    ...common,
  };
}

const stageLabel = (code) =>
  ({
    p1: 'ابتدائي دُنيا',
    p2: 'ابتدائي عُليا',
    m: 'متوسط',
    h: 'ثانوي',
  }[code] || code || 'المرحلة الدراسية');

function daysBetween(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.valueOf())) return Infinity;
    const now = new Date();
    return Math.floor((now - d) / (1000 * 60 * 60 * 24));
  } catch {
    return Infinity;
  }
}

function tagFreshness(card) {
  const days = card?.evidence_date ? daysBetween(card.evidence_date) : Infinity;
  card.freshness = days <= 180 ? 'new' : 'general'; // 6 أشهر
  return card;
}

/* ========== الـ Handler ========== */

exports.handler = async (event) => {
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
    const models = ['gemini-1.5-pro', 'gemini-1.5-flash-8b', 'gemini-1.5-flash'];
    let model = genAI.getGenerativeModel({ model: models[0] });

    // نطاق “الأخبار الحديثة”
    const now = new Date();
    const y = now.getFullYear();
    const since = `${y - 1}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;

    /* ========== تعليمات نظام بحسب الـ focus ========== */

    // قاسم مشترك: JSON فقط — بدون أي نص خارج JSON
    const jsonHeader = (shape) =>
      `
أنت مساعد إثرائي عربي للمعلمين. أرسلي **JSON فقط** بالشكل التالي:
${shape}
- بين 3 و6 عناصر. لا تكتبي أي نص أو شرح خارج JSON.
- استخدمي لغة عربية مبسطة تناسب "${stageLabel(stage)}".
- إن توفر مصدر موثوق أضيفي "source" و"evidence_date" بصيغة YYYY-MM-DD، وإلا اجعليهما فارغين.
`.trim();

    const shapeMyth = `{
 "cards":[
   {
     "title":"",                 // موجز وجذاب
     "myth":"",                  // نص الخرافة بصيغة جملة كاملة
     "truth":"",                 // التصحيح العلمي الدقيق
     "explanation":"",           // سبب الخطأ/الخلفية العلمية (3–4 أسطر كحد أقصى)
     "idea":"",                  // (اختياري) نشاط صفّي قصير 5–10 دقائق لتثبيت التصحيح
     "source":"",                // اختياري
     "evidence_date":""          // YYYY-MM-DD أو فارغ
   }
 ]
}`;

    const shapeLatest = `{
 "cards":[
   {
     "title":"",                 // عنوان موجز
     "insight":"",               // الخلاصة/الخبر/النتيجة الحديثة بلغة مبسطة
     "idea":"",                  // (اختياري) تطبيق صفّي قصير
     "source":"",
     "evidence_date":""
   }
 ]
}`;

    const shapeOdd = `{
 "cards":[
   {
     "title":"",                 // عنوان جذاب
     "fact":"",                  // الحقيقة المدهشة بصيغة علمية صحيحة
     "explanation":"",           // (اختياري) لماذا هي صحيحة/مدهشة
     "idea":"",                  // (اختياري) عرض/تجربة آمنة قصيرة
     "source":"",
     "evidence_date":""
   }
 ]
}`;

    const shapeIdeas = `{
 "cards":[
   {
     "title":"",                 // عنوان واضح للنشاط/المشروع الصغير
     "fact":"",                  // (اختياري) محتوى معرفي موجز يمهّد للنشاط
     "idea":"",                  // خطوات واضحة قابلة للتنفيذ
     "source":"",
     "evidence_date":""
   }
 ]
}`;

    // نصوص الـ prompt لكل تركيز – تُنتِج “محتوى” أولًا وليس “فكّروا…”
    const qMyth = `
${jsonHeader(shapeMyth)}
المطلوب: **خرافات شائعة محددة** في "${subject}" مع **التصحيح العلمي الواضح** و**تفسير موجز**.
يُفضّل الاستشهاد بمصدر موثوق إن أمكن. امنعي العبارات العامة من نوع "اطلبي من الطالبات التفكير…".
${lesson ? `اربطي عند الإمكان بموضوع الدرس "${lesson}" دون تكرار العنوان نصًا.` : ''}
`.trim();

    const qLatest = `
${jsonHeader(shapeLatest)}
المطلوب: **مستجدات/نتائج حديثة** في "${subject}" (منذ ${since}) بلغة تناسب "${stageLabel(
      stage
    )}"، مع فكرة صفية قصيرة (اختياري).
${lesson ? `إن أمكن، صِلِيها ضمنيًا بـ "${lesson}".` : ''}
`.trim();

    const qOdd = `
${jsonHeader(shapeOdd)}
المطلوب: **حقائق مدهشة صحيحة** في "${subject}" بلغة تناسب "${stageLabel(
      stage
    )}"، مع تفسير موجز (اختياري) ونشاط صفّي بسيط (اختياري).
`.trim();

    const qIdeas = `
${jsonHeader(shapeIdeas)}
المطلوب: **أفكار إثرائية قابلة للتنفيذ** لمادة "${subject}" (نشاط/مشروع صغير/تجربة آمنة) بخطوات واضحة.
`.trim();

    const pipelines = {
      myth: [qMyth],
      latest: [qLatest, qOdd, qIdeas],
      odd: [qOdd, qIdeas],
      ideas: [qIdeas],
      auto: [qLatest, qMyth, qOdd, qIdeas],
    };
    const tries = pipelines[focus] || pipelines.auto;

    /* ========== التوليد بمحاولات ونماذج بديلة عند التعثر ========== */

    let cards = [];
    for (const prompt of tries) {
      let lastErr;
      for (const m of models) {
        try {
          model = genAI.getGenerativeModel({ model: m });
          const result = await model.generateContent(prompt);
          const text = (await result.response).text().trim();
          const cleaned = text
            .replace(/^```json/i, '')
            .replace(/^```/, '')
            .replace(/```$/, '')
            .trim();
          const parsed = JSON.parse(cleaned);
          const out = clampAndNormalize(parsed.cards || [], focus);
          if (out.length) {
            cards = out.map(tagFreshness);
            break;
          }
        } catch (err) {
          lastErr = err;
          // جرّب الموديل التالي
        }
      }
      if (cards.length) break;
      if (lastErr) console.error('ethraa-gen-error:', lastErr?.message || lastErr);
    }

    // Fallback مضمون (محتوى صريح) إن فشل كل شيء
    if (!cards.length && focus === 'myth') {
      cards = clampAndNormalize(
        [
          {
            title: 'خرافة: الإلكترون جسيم صلب صغير يدور حول النواة',
            myth: 'الإلكترون جسيم كروي صلب يدور حول النواة مثل الكوكب.',
            truth:
              'وصف الإلكترون كـ "جسيم صلب يدور" غير دقيق؛ الإلكترون يُوصف بدالة موجية واحتمالات تواجد داخل السحابة الإلكترونية وفق ميكانيكا الكم.',
            explanation:
              'نماذج الكواكب قديمة. النموذج الكمومي يصف حالات طاقة واحتمالات لا مسارات كلاسيكية. القياسات تؤكد الطبيعة الموجية-الجسيمية.',
            idea:
              'اعرضي خريطة سُحُب احتمالية (Orbitals) وصوري تجربة الشِقّين لتأكيد السلوك الموجي.',
            source:
              'https://chem.libretexts.org/Bookshelves/Physical_and_Theoretical_Chemistry_Textbook_Maps/Quantum_Mechanics',
            evidence_date: '2023-09-01',
          },
          {
            title: 'خرافة: الوزن يساوي الكتلة',
            myth: 'وزن الجسم يساوي كتلته دائمًا.',
            truth:
              'الكتلة ثابتة لا تعتمد على المكان، أما الوزن فهو قوة الجاذبية المؤثرة ويختلف باختلاف شدة المجال.',
            explanation:
              'الوزن = الكتلة × عجلة الجاذبية. على القمر وزن الجسم أقل مع بقاء كتلته ثابتة.',
            source: '',
            evidence_date: '',
          },
        ],
        'myth'
      ).map(tagFreshness);
    } else if (!cards.length) {
      cards = clampAndNormalize(
        [
          {
            title: `معلومة دقيقة في ${subject}`,
            fact:
              'السرعة المتجهة تختلف عن السرعة القياسية: الأولى تشمل المقدار والاتجاه، والثانية مقدار فقط.',
            idea: 'نشاط 60 ثانية: بطاقات حالات حركة؛ يحدد الطلاب هل تتغير السرعة المتجهة ولماذا.',
          },
          {
            title: 'حقيقة مدهشة',
            fact: 'الضوء لا يتباطأ داخل الزجاج “ثم يسرع” خارجه؛ الزمن الفعّال يتأخر بسبب تفاعلات مجهرية.',
            explanation: 'المعامل ينشأ من تأخر الطور/الامتصاص وإعادة الإشعاع، ليس “تباطؤ جسيمي” مباشر.',
          },
          {
            title: 'أفكار سريعة',
            idea: 'بطاقات دقيقة-واحدة: يشرح الطالب المفهوم بكلمة ورسمة وسهم علاقة.',
          },
        ],
        'ideas'
      ).map(tagFreshness);
    }

    const payload = {
      ok: true,
      cards,
      _meta: {
        subject,
        stage,
        focus: focus || 'auto',
        lesson: lesson || null,
        count: cards.length,
        all_stale: cards.every((c) => (c.freshness || 'general') === 'general'),
      },
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    };
  } catch (e) {
    console.error('ethraa-fatal:', e?.message || e);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'server_error' }) };
  }
};
