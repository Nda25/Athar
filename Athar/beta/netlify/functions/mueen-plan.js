// /.netlify/functions/mueen-plan.js
// مُعين: خطة أسبوعية موزّعة على 5 أيام
// حماية: Auth0 + اشتراك نشط (كما في بقية المنظومة) + CORS

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createClient } = require("@supabase/supabase-js");
const { requireUser } = require("./_auth");

// ===== Supabase admin client =====
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

// فحص الاشتراك
async function isActive(user_sub, email){
  try{
    const { data, error } = await supabase
      .from("v_user_status")
      .select("active")
      .or(`user_sub.eq.${user_sub},email.eq.${(email||"").toLowerCase()}`)
      .limit(1).maybeSingle();
    if (!error && data) return !!data.active;
  }catch(_){}
  try{
    let q = supabase.from("memberships")
      .select("end_at, expires_at").order("end_at", { ascending:false }).limit(1);
    if (user_sub) q = q.eq("user_id", user_sub);
    else if (email) q = q.eq("email", (email||"").toLowerCase());
    else return false;
    const { data: rows } = await q;
    const row = rows?.[0];
    const exp = row?.end_at || row?.expires_at;
    return exp ? new Date(exp) > new Date() : false;
  }catch(_){ return false; }
}

// CORS
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

// أدوات مساعدة
const dayNames = ["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس"];
const clamp = (v,min,max)=> Math.max(min, Math.min(max, v));
const cleanTxt = (x)=> (typeof x==='string'?x.trim():'')||'';
const arr = (x)=> Array.isArray(x)? x.filter(Boolean).map(s=>cleanTxt(s)).slice(0,20) : [];

// تقسيم الأهداف على الأيام (Goal-first)
function distributeGoalsAcrossWeek({ subject, grade, lessonName, goals, vocab, days=5 }){
  const out = [];
  const g = arr(goals);
  const v = arr(vocab);
  // لو لا يوجد أهداف، نجعل على الأقل هدفًا عامًا مرتبطًا بالعنوان
  const baseGoals = g.length? g : [`التعرّف على مفاهيم ${lessonName} الأساسية وتطبيقها.`];

  // عدد القطاعات للدرس الواحد عبر الأسبوع
  const segments = Math.max(1, Math.min(days, baseGoals.length || 1));
  let gi = 0;

  for (let i=0;i<days;i++){
    const dayName = dayNames[i];
    let dayGoals = [];
    let noteType = null;

    if (gi < baseGoals.length){
      // نسند هدفًا واحدًا (بحد أقصى) لكل يوم حتى ننتهي
      dayGoals = [ baseGoals[gi] ];
      gi++;
    }else{
      // بعد نفاد الأهداف: أنشطة تثبيت/تطبيق لنفس الدرس (لا مفاهيم جديدة)
      noteType = i === days-1 ? 'مراجعة شاملة وتثبيت' : 'تطبيق عملي/معملي';
      dayGoals = [ noteType === 'مراجعة شاملة وتثبيت'
        ? `مراجعة ختامية مركزة على ${lessonName} مع تدريبات قصيرة`
        : `تطبيق عملي على ${lessonName} باستخدام مسائل وتمارين من واقع المادة` ];
    }

    // مفردات اليوم: نُبقي من نفس قائمة الدرس (لا نضيف جديدة)
    const dayVocab = v.slice(0, Math.max(0, Math.min(3, v.length)));

    // مخرجات وواجب متوافقان
    const outcomes = noteType==='مراجعة شاملة وتثبيت'
      ? `يثبّت الطالب مفاهيم ${lessonName} ويُظهر إتقانًا في الأساسيات.`
      : `يُظهر الطالب قدرة على تطبيق مفاهيم ${lessonName} على مسائل مختارة.`;

    const homework = noteType==='مراجعة شاملة وتثبيت'
      ? `حل 5 أسئلة مراجعة قصيرة حول ${lessonName} من الكتاب/المنصة.`
      : `تمرين منزلي قصير يطبّق فكرة اليوم في ${lessonName}.`;

    out.push({
      dayName,
      subject, grade,
      lessonName,
      segment: i < segments ? (i+1) : segments, // ترقيم مقاطع الدرس
      goals: dayGoals,
      vocab: dayVocab,
      outcomes, homework
    });
  }
  return out;
}

exports.handler = async (event) => {
  try{
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: CORS, body: '' };
    }
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };
    }

    // حماية
    const gate = await requireUser(event);
    if (!gate.ok) return { statusCode: gate.status, headers: CORS, body: gate.error };
    const active = await isActive(gate.user?.sub, gate.user?.email);
    if (!active) return { statusCode: 402, headers: CORS, body: 'Membership is not active' };

    // مدخلات
    let p = {};
    try{ p = JSON.parse(event.body||'{}'); }catch{ return { statusCode:400, headers:CORS, body:'Bad JSON body' }; }

    const subject = cleanTxt(p.subject);
    const grade   = cleanTxt(p.grade);
    const mode    = p.mode === 'ai' ? 'ai':'manual';
    const days    = clamp(Number(p.days)||5, 5, 5); // ثابت 5 أيام
    let   lessons = Array.isArray(p.lessons) ? p.lessons.map(cleanTxt).filter(Boolean) : [];

    if (!subject || !grade) return { statusCode:400, headers:CORS, body:'Missing subject/grade' };

    // مفاتيح Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { statusCode:500, headers:CORS, body:'Missing GEMINI_API_KEY' };

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model:'gemini-1.5-flash' });

    // إن أراد المستخدم كشف أسماء الدروس (ذكاء اصطناعي)
    if (mode==='ai' || lessons.length===0){
      const q = `
أنت مساعد تربوي على مناهج السعودية (آخر إصدار).
أعطني قائمة مختصرة (من ١ إلى ٥ فقط) بعناوين دروس محتملة في مادة "${subject}" للصف/المرحلة "${grade}"،
بصياغة مطابقة لأسماء الدروس المتداولة في المنهج.
الخرج JSON فقط: { "lessons": ["...", "..."] }`;
      const res = await model.generateContent({
        contents:[{role:'user', parts:[{text:q}]}],
        generationConfig:{ responseMimeType:'application/json', maxOutputTokens:512, temperature:0.4 }
      });
      const txt = (typeof res?.response?.text==='function') ? res.response.text() : res?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      let j = {};
      try{ j = JSON.parse((txt||'').replace(/```json|```/g,'')); }catch{}
      if (Array.isArray(j.lessons) && j.lessons.length){
        lessons = j.lessons.slice(0, clamp(p.lessons?.length||lessons.length||5,1,5));
      }
    }

    if (!lessons.length) return { statusCode:400, headers:CORS, body:'No lessons provided/found' };

    // الآن نطلب من الموديل الأهداف والمفردات لكل درس — ونُلزمه بعدم الخروج عنها لاحقًا
    const ask = `
أنت خبير تصميم تعلّم على مناهج السعودية (آخر إصدار).
لكل درس من الدروس التالية في مادة "${subject}" للصف "${grade}":
- استخرج أهدافًا تعليمية دقيقة (٣–٦) من المنهج فقط.
- استخرج مفردات جديدة أساسية (٣–٨) من نفس الدرس.
- لا تضف أهدافًا أو مصطلحات من خارج الدرس.
أعد JSON وفق القالب:
{
  "items":[
    {"lesson":"اسم الدرس","objectives":["...","..."],"vocab":["...","..."]}
  ]
}
الدروس:
${lessons.map((t,i)=>`${i+1}- ${t}`).join('\n')}
أجب JSON فقط.`;
    const res2 = await model.generateContent({
      contents:[{role:'user', parts:[{text:ask}]}],
      generationConfig:{ responseMimeType:'application/json', temperature:0.5, maxOutputTokens:2048 }
    });
    const raw = (typeof res2?.response?.text==='function') ? res2.response.text() : res2?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let data = {};
    try{ data = JSON.parse((raw||'').replace(/```json|```/g,'')); }catch(e){
      return { statusCode:502, headers:CORS, body:'Model JSON parse error' };
    }
    const items = Array.isArray(data.items)? data.items : [];

    // نوزّع كل درس على الأسبوع بتتابع الأهداف (دون مفاهيم جديدة)
    let daysOut = [];
    // إستراتيجية: نحجز أيامًا متتابعة لكل درس. مثال: درس واحد -> يملأ كل الأسبوع. درسان -> كل واحد ٢–٣ أيام… وهكذا.
    const blocks = lessons.length; // 1..5
    const baseLen = Math.floor(5 / blocks);
    let remainder = 5 % blocks;

    let dayIndex = 0;
    for (let li=0; li<lessons.length; li++){
      const name = lessons[li];
      const found = items.find(x=> cleanTxt(x.lesson)===name ) || items[li] || {};
      const goals = arr(found?.objectives);
      const vocab = arr(found?.vocab);

      const span = baseLen + (remainder>0 ? 1 : 0);
      if (remainder>0) remainder--;

      const chunkDays = [];
      for (let k=0;k<span;k++){
        chunkDays.push(dayIndex+k);
      }
      dayIndex += span;

      // نبني أيام هذا الدرس
      const distributed = distributeGoalsAcrossWeek({
        subject, grade, lessonName: name,
        goals, vocab, days: span
      });

      // عدّل أسماء الأيام حسب مواقعها في الأسبوع
      for (let j=0;j<distributed.length;j++){
        distributed[j].dayName = dayNames[ chunkDays[j] ];
      }
      daysOut = daysOut.concat(distributed);
    }

    // ترتيب حسب الأيام
    daysOut.sort((a,b)=> dayNames.indexOf(a.dayName) - dayNames.indexOf(b.dayName));

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type":"application/json; charset=utf-8" },
      body: JSON.stringify({
        meta:{ subject, grade, note:"توزيع الأهداف بالتتابع + تثبيت عند الحاجة" },
        days: daysOut
      })
    };
  }catch(e){
    console.error(e);
    return { statusCode:500, headers:CORS, body: JSON.stringify({ error: e.message || 'Server error' }) };
  }
};
