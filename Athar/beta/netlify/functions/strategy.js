// netlify/functions/gemini-ethraa.js
// ================================================================
// توليد "بطاقات الإثراء" بمحتوى صحيح وجاهز للتطبيق (بدون أسئلة مفتوحة)
// - CORS مبسّط
// - حماية Auth0 عبر _auth.js
// - تتبع استعمال (اختياري) عبر _log.js إن وُجد
// - متوافق مع Node 18 و @google/generative-ai
// ================================================================

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { requireUser } = require('./_auth.js');

// التتبع اختياري: إن وُجد ملف _log.js نستخدمه، وإلا نتجاهل بهدوء
let supaLogToolUsage = null;
try { ({ supaLogToolUsage } = require('./_log.js')); } catch { /* noop */ }

// -------- CORS مبسّط --------
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

// -------- أدوات مساعدة --------
const clampCards = (arr, min = 3, max = 6) => {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const it of arr) {
    const t = String(it?.title || '').trim();
    const i = String(it?.idea || '').trim();
    if (!t || !i) continue;
    const key = (t + '|' + i).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      title: t,
      brief: String(it?.brief || '').trim(),
      idea: i,
      source: it?.source ? String(it.source).trim() : '',
      evidence_date: it?.evidence_date || null,
      freshness: it?.freshness || null
    });
    if (out.length >= max) break;
  }
  return out.length >= min ? out : [];
};

const stageLabel = (code) => ({
  p1: 'ابتدائي دُنيا',
  p2: 'ابتدائي عُليا',
  m:  'متوسط',
  h:  'ثانوي'
}[code] || code || 'ثانوي');

function daysBetween(iso){
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.valueOf())) return Infinity;
    return Math.floor((Date.now() - d.getTime())/(1000*60*60*24));
  } catch { return Infinity; }
}
function tagFreshness(card){
  const days = card?.evidence_date ? daysBetween(card.evidence_date) : Infinity;
  card.freshness = days <= 180 ? 'new' : 'general';
  return card;
}

const stripCodeFence = (txt) =>
  String(txt||'')
    .replace(/^\s*```json/i,'')
    .replace(/^\s*```/i,'')
    .replace(/```$/i,'')
    .trim();

// ================================================================
exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: 'Method Not Allowed' };
  }

  // حماية: يلزم توكن صالح
  const auth = await requireUser(event);
  if (!auth?.ok) {
    return { statusCode: auth?.status || 401, headers: CORS_HEADERS, body: JSON.stringify({ ok:false, error: auth?.error || 'unauthorized' }) };
  }

  // مدخلات
  let body = {};
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ ok:false, error:'bad_json' }) }; }

  const subject = String(body.subject || '').trim();
  const stage   = String(body.stage || 'h').trim();
  const focus   = String(body.focus || 'auto').trim();   // latest | myth | odd | ideas | auto
  const lesson  = body.lesson ? String(body.lesson).trim() : '';

  if (!subject) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ ok:false, error:'missing_subject' }) };
  }

  // إعداد Gemini
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ ok:false, error:'missing_api_key' }) };
  }
  const modelNames = [
    process.env.GEMINI_MODEL || 'gemini-1.5-pro',
    'gemini-1.5-flash'
  ];
  const genAI = new GoogleGenerativeAI(apiKey);

  // نافذة الزمن للأخبار
  const now = new Date();
  const since = `${now.getFullYear()-1}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  // ——— تعليمات نظام: JSON فقط + خطوات تنفيذية مباشرة ———
  const baseSystem = `
أنتِ مساعد إثرائي عربي للمعلمين.
أعيدي **فقط JSON واحدًا** بهذا البناء:
{
 "cards":[
   {
     "title":"...",           // حقيقة أو خرافة مصححة أو فكرة عملية — بصياغة دقيقة موجزة
     "brief":"...",           // تفسير صحيح مختصر/قيمة تربوية
     "idea":"...",            // خطوات تنفيذية مباشرة (1–5 خطوات واضحة) بدون أسئلة مفتوحة أو "فكري/ناقشي"
     "source":"https://...",  // مصدر موثوق إن توفر، وإلا اتركيه ""
     "evidence_date":"YYYY-MM-DD" // تاريخ حديث إن وُجد، وإلا null
   }
 ]
}
- أعيدي 3–6 بطاقات غير مكررة.
- اجعلي "idea" إجراءات عملية قابلة للتطبيق خلال 5–10 دقائق (عرض قصير/تجربة آمنة/ورقة مصغّرة).
- راعي المرحلة "${stageLabel(stage)}" في اللغة والأمثلة.
- **لا** تضيفي أي نص خارج JSON.
`.trim();

  // ——— قوالب تركيز تضمن "محتوى صحيح" ———
  const qLatest = (s, st) => `
بطاقات عن **أحدث مستجدات** "${s}" منذ ${since}.
لكل بطاقة:
- "title": معلومة/نتيجة حقيقية حديثة بصياغة موجزة.
- "brief": لماذا تهم تربويًا.
- "idea": خطوات تنفيذية مباشرة تُظهر المعلومة (بدون أسئلة مفتوحة).
${lesson ? `اربطي ضمنيًا بدرس "${lesson}" إن أمكن.` : ''}
`.trim();

  const qMyth = (s, st) => `
بطاقات **خرافات شائعة وتصحيحها العلمي** في "${s}" (${stageLabel(st)}).
- "title": يبدأ بـ "خرافة:" متبوعًا بالنص الشائع.
- "brief": التصحيح العلمي المختصر الواضح.
- "idea": تنفيذ قصير يبرهن التصحيح (تجربة/عرض/محاكاة) — **خطوات مباشرة** فقط.
- "source": مرجع موثوق إن تيسر.
`.trim();

  const qOdd = (s, st) => `
بطاقات **حقائق مدهشة وموثوقة** في "${s}" تناسب "${stageLabel(st)}".
- "title": حقيقة دقيقة واحدة.
- "brief": تفسير صحيح مبسّط.
- "idea": برهنة عملية قصيرة مباشرة وآمنة.
`.trim();

  const qIdeas = (s, st) => `
بطاقات **أفكار إثرائية عملية جاهزة** لمادة "${s}" تناسب "${stageLabel(st)}".
- "idea": خطوات تنفيذية واضحة (مواد، تحضير، تنفيذ) — بدون أسئلة مفتوحة.
- مخرجات قابلة للملاحظة خلال 5–10 دقائق.
`.trim();

  const pipelines = {
    latest: [qLatest, qMyth, qOdd, qIdeas],
    myth:   [qMyth, qLatest, qOdd, qIdeas],
    odd:    [qOdd, qLatest, qMyth, qIdeas],
    ideas:  [qIdeas, qLatest, qMyth, qOdd],
    auto:   [qMyth, qLatest, qOdd, qIdeas] // لأنك تفضلين "الخرافات" أولًا
  };
  const tries = pipelines[focus] || pipelines.auto;

  // ——— التوليد بمحاولات عبر أكثر من قالب وأكثر من موديل ———
  let cards = [];
  outer: for (const modelName of modelNames) {
    const model = genAI.getGenerativeModel({ model: modelName });
    for (const q of tries) {
      try {
        const prompt = `${baseSystem}\n\n${q(subject, stage)}`.trim();
        const result = await model.generateContent(prompt);
        const text = stripCodeFence((await result.response).text());
        const parsed = JSON.parse(text);
        const out = clampCards(parsed.cards || []);
        if (out.length) {
          cards = out.map(tagFreshness);
          break outer;
        }
      } catch (e) {
        console.error('ethraa-step-error:', modelName, e?.message || e);
      }
    }
  }

  // ——— fallback مضمون لو فشل كل شيء ———
  if (!cards.length) {
    cards = clampCards([
      {
        title: 'خرافة: الإلكترونات تدور حول النواة كالكواكب',
        brief: 'النموذج الحديث يصف سُحب احتمالية (مدارات موجية) لا مسارات دائرية كلاسيكية.',
        idea: '1) اعرض مقارنة: نموذج بوهر مقابل سحابة إلكترونية. 2) شغّل GIF لمحاكاة الكثافة الإلكترونية. 3) وزّع بطاقة مقارنة مطبوعة تلخص الفارق.',
        source: '',
        evidence_date: null
      },
      {
        title: 'حقيقة: سرعة الضوء في الفراغ ثابتة ≈ ‎3×10^8‎ م/ث',
        brief: 'ثباتها أساس النسبية الخاصة ويقود لتمدد الزمن وانكماش الطول.',
        idea: '1) اعرض القيمة c. 2) فيديو 60 ثانية لقياس مسافة/زمن ليزر. 3) تمرين حسابي قصير لاستنتاج زمن الوصول لمسافة معلومة.',
        source: '',
        evidence_date: null
      },
      {
        title: 'فكرة عملية: مطياف للهاتف من شبكة حيود',
        brief: 'نشاط آمن يبرهن تفريق الضوء ويُظهر الطيف فورًا.',
        idea: '1) وزّع شبكة حيود وكرتون أسود وشريط لاصق. 2) قص نافذة وثبّت الشبكة. 3) وجّه نحو مصباح أبيض آمن والتقطوا صورة للطيف.',
        source: '',
        evidence_date: null
      }
    ]).map(tagFreshness);
  }

  // بدائل قريبة من المجال إن كانت كل النتائج قديمة
  const allStale = cards.length && cards.every(c => (c.freshness || 'general') === 'general');
  let nearby = [];
  if (allStale) {
    for (const modelName of modelNames) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const promptN = `${baseSystem}

أعطِ 3–6 بطاقات **قريبة من مجال** "${subject}" تركز على توجهات حديثة (آخر 12 شهرًا):
تطبيقات ناشئة/تقنيات تعليمية عملية بصيغة خطوات تنفيذية مباشرة، مع "evidence_date" إن أمكن.
${lesson ? `مواءمة ضمنية مع "${lesson}".` : ''}`.trim();

        const r = await model.generateContent(promptN);
        const t = stripCodeFence((await r.response).text());
        const p = JSON.parse(t);
        const o = clampCards(p.cards || []);
        if (o.length) { nearby = o.map(tagFreshness); break; }
      } catch (e) {
        console.error('ethraa-nearby-error:', modelName, e?.message || e);
      }
    }
  }

  // بصمات (اختياري للواجهة)
  const sig = (d) => {
    const s = (d.title || '') + '|' + (d.idea || '');
    let h=0; for (let i=0;i<s.length;i++){ h=((h<<5)-h)+s.charCodeAt(i); h|=0; }
    return String(h);
  };

  const payload = {
    ok: true,
    cards,
    nearby: nearby.length ? nearby : undefined,
    _meta: {
      subject, stage, focus, lesson: lesson || null,
      all_stale: !!allStale,
      count: cards.length,
      dedup_sigs: cards.map(sig)
    }
  };

  // تتبّع (اختياري)
  try {
    if (typeof supaLogToolUsage === 'function') {
      await supaLogToolUsage(auth.user, 'ethraa', {
        subject, stage, focus, lesson: lesson || null,
        count: payload._meta.count, all_stale: payload._meta.all_stale
      });
    }
  } catch (e) {
    console.error('ethraa-log-error:', e?.message || e);
  }

  return {
    statusCode: 200,
    headers: { ...CORS_HEADERS, 'Content-Type':'application/json; charset=utf-8' },
    body: JSON.stringify(payload)
  };
};
