// مُعين: خطة أسبوعية موزّعة (أحد→خميس) بلا خلط دروس في نفس اليوم.
// الحماية: Auth0 (JWT) + اشتراك Supabase (active). مع CORS.

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createClient } = require("@supabase/supabase-js");
const { requireUser } = require("./_auth.js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

// ===== عضوية نشطة =====
async function isActiveMembership(user_sub, email) {
  try {
    const { data } = await supabase
      .from("v_user_status")
      .select("active")
      .or(`user_sub.eq.${user_sub},email.eq.${(email||"").toLowerCase()}`)
      .limit(1).maybeSingle();
    if (data) return !!data.active;
  } catch(_) {}
  try {
    let q = supabase.from("memberships")
      .select("end_at, expires_at").order("end_at",{ascending:false}).limit(1);
    if (user_sub) q = q.eq("user_id", user_sub);
    else if (email) q = q.eq("email", (email||"").toLowerCase());
    else return false;
    const { data: rows } = await q;
    const row = rows?.[0]; const exp = row?.end_at || row?.expires_at;
    return exp ? new Date(exp) > new Date() : false;
  } catch(_) { return false; }
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

exports.handler = async (event) => {
  try{
    if (event.httpMethod === 'OPTIONS') return { statusCode:204, headers:CORS, body:'' };
    if (event.httpMethod !== 'POST') return { statusCode:405, headers:CORS, body:'Method Not Allowed' };

    // Auth
    const gate = await requireUser(event);
    if (!gate.ok) return { statusCode: gate.status, headers:CORS, body: gate.error };

    const active = await isActiveMembership(gate.user?.sub, gate.user?.email);
    if (!active) return { statusCode:402, headers:CORS, body:'Membership is not active' };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { statusCode:500, headers:CORS, body:'Missing GEMINI_API_KEY' };

    // Payload
    let p={}; try{ p = JSON.parse(event.body||'{}'); }catch{ return { statusCode:400, headers:CORS, body:'Bad JSON' }; }
    const subject = String(p.subject||'').slice(0,120);
    const grade   = String(p.grade||'').slice(0,60);
    const lessons = Array.isArray(p.lessons) ? p.lessons.filter(Boolean).map(x=>String(x).slice(0,160)) : [];
    const weekDays= Array.isArray(p.weekDays)&&p.weekDays.length? p.weekDays : ["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس"];
    if (!subject || lessons.length===0) return { statusCode:400, headers:CORS, body:'Missing subject/lessons' };

    // 1) اطلب أهداف ومفردات موثوقة للـ"درس" من الموديل فقط.
    // نُلزم الموديل ألّا يخترع خارج سياق "مناهج السعودية".
    const sysPrompt = `
أنت مساعد تربوي يلتزم فقط بمحتوى "منهج السعودية — آخر إصدار".
مطلوب لكل درس اسمُه أن تُرجِع:
- قائمة أهداف تعلم دقيقة ومختصرة (٣–٨ كحد أقصى).
- مفردات جديدة مباشرة من الدرس فقط (٠–٦ عناصر). لا تُدخل مصطلحات عامة بعيدة.
- مخرجات تعلم مختصرة.
صيغة JSON فقط:
{
  "lesson": "اسم الدرس",
  "objectives": ["..."],
  "vocab": ["...", "..."],
  "outcomes": "..."
}
`.trim();

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model:"gemini-1.5-flash" });

    async function fetchLessonPack(name){
      const req = {
        contents: [{ role: "user", parts:[{ text: sysPrompt + `\nالمرحلة/الصف: ${grade}\nالمادة: ${subject}\nالدرس: ${name}\nأجب JSON فقط.` }] }],
        generationConfig: { responseMimeType:"application/json", maxOutputTokens: 1024, temperature: 0.5 }
      };
      const res = await model.generateContent(req);
      const txt = (typeof res?.response?.text==='function' ? res.response.text() : '') ||
                  res?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      let data; try{ data = JSON.parse(txt.replace(/```json|```/g,'')); }catch{ data=null; }
      if(!data) data = { lesson:name, objectives:[`أهداف مناسبة لدرس ${name}`], vocab:[], outcomes:"" };
      data.lesson = name;
      data.objectives = Array.isArray(data.objectives)? data.objectives.filter(Boolean) : [];
      data.vocab      = Array.isArray(data.vocab)? data.vocab.filter(Boolean) : [];
      data.outcomes   = String(data.outcomes||'');
      return data;
    }

    const packs = [];
    for (const n of lessons){ packs.push(await fetchLessonPack(n)); }

    // 2) خوارزمية التوزيع على خمسة أيام:
    //   - لا خلط بين درسين في اليوم الواحد.
    //   - كل درس يأخذ عدد أيام يتناسب مع أهدافه.
    //   - عند انتهاء الأهداف قبل نهاية الأيام: نُضيف تبثيت/تطبيقات وتجربة مرتبطة بالدرس نفسه دون مفردات جديدة بعيدة.
    const DAYS = weekDays.slice(0,5);
    const daysTotal = 5;
    // احسب الوزن: 1 + log(1+عدد الأهداف)
    const weights = packs.map(pck => 1 + Math.log(1 + (pck.objectives.length||1)));
    const weightSum = weights.reduce((a,b)=>a+b,0);
    // عدد الأيام المبدئي لكل درس (على الأقل يوم 1)
    let alloc = weights.map(w => Math.max(1, Math.round((w/weightSum) * daysTotal)));
    // اضبط المجموع ليكون 5 بالضبط
    let diff = daysTotal - alloc.reduce((a,b)=>a+b,0);
    // وزّع الفرق
    while(diff !== 0){
      for(let i=0;i<alloc.length && diff!==0;i++){
        if (diff>0) { alloc[i]++; diff--; }
        else if (diff<0 && alloc[i]>1) { alloc[i]--; diff++; }
      }
      if (alloc.every(a=>a===1) && diff<0){ alloc[0]+=diff; diff=0; }
    }

    // ابْنِ الأيام
    const plan = [];
    let dayIdx = 0;
    for (let i=0;i<packs.length;i++){
      const pck = packs[i];
      const daysForThis = alloc[i];
      const objs = pck.objectives.slice(); // copy
      const chunkSize = Math.max(1, Math.ceil(objs.length / daysForThis));
      for (let d=0; d<daysForThis && dayIdx < daysTotal; d++, dayIdx++){
        const segStart = d*chunkSize;
        const seg = objs.slice(segStart, segStart+chunkSize);
        // لو انتهت الأهداف، حوّل إلى تثبيت/تطبيقات منبثقة من نفس الدرس
        const isPractice = seg.length===0;
        const day = {
          day: DAYS[dayIdx],
          lesson: pck.lesson,
          segment: isPractice ? "تثبيت وتطبيقات" : `Segment ${d+1}`,
          objectives: isPractice ? [
            `تثبيت مفاهيم الدرس "${pck.lesson}" عبر أمثلة وتمارين مركزة.`,
            `تطبيق عملي/مخبري مرتبط مباشرة بالدرس دون إدخال مفاهيم جديدة.`
          ] : seg,
          vocab: isPractice ? pck.vocab.slice(0, Math.min(2, pck.vocab.length)) : pck.vocab.slice(0, Math.min(4, pck.vocab.length)),
          outcomes: isPractice ? `يُطبق الطالب مفاهيم "${pck.lesson}" على مواقف وتمارين عملية، مع مراجعة دقيقة للمفردات.` : (pck.outcomes || `يتقن أهداف الجزء الحالي من "${pck.lesson}".`),
          homework: isPractice
            ? `مهمة تطبيقية قصيرة مرتبطة بـ"${pck.lesson}" (٣–٥ مسائل/سؤال تأملي).`
            : `سؤال ختامي قصير أو تمرين واحد يثبت هدف اليوم من "${pck.lesson}".`
        };
        plan.push(day);
      }
    }

    // إن لم نملأ 5 أيام (عدد دروس أقل)، أكمِل بأيام تثبيت عامة لنفس آخر درس
    while (plan.length < daysTotal){
      const last = packs[packs.length-1];
      plan.push({
        day: DAYS[plan.length],
        lesson: last.lesson,
        segment: "مراجعة شاملة",
        objectives: [
          `مراجعة مركزة لأبرز أهداف "${last.lesson}".`,
          "حل نموذج قصير وتغذية راجعة فورية."
        ],
        vocab: last.vocab.slice(0,2),
        outcomes: `يثبت الطالب المفاهيم الرئيسة لدرس "${last.lesson}".`,
        homework: "ورقة عمل قصيرة أو سؤال تفكير ناقد مرتبط بالدرس."
      });
    }

    const out = { subject, grade, plan };
    return { statusCode:200, headers:{...CORS, "Content-Type":"application/json; charset=utf-8"}, body: JSON.stringify(out) };

  }catch(e){
    console.error("mueen-plan error:", e);
    return { statusCode:500, headers:CORS, body:"Server error" };
  }
};
