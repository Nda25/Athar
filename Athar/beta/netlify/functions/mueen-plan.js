// مُعين: تقسيم خطة أسبوعية (5 أيام) دون خلط دروس، وتقسيم أهداف الدرس على الأيام.
// يعتمد Gemini للاستدلال. الحماية عبر Auth0 + تحقق عضوية Supabase كما في بقية المنظومة.

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createClient } = require("@supabase/supabase-js");
const { requireUser } = require("./_auth.js");
const { CORS, preflight } = require("./_cors.js");

// ===== Supabase (SR) =====
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

// عضوية فعالة؟
async function isActiveMembership(user_sub, email) {
  try {
    const { data } = await supabase
      .from("v_user_status")
      .select("active")
      .or(`user_sub.eq.${user_sub},email.eq.${(email||"").toLowerCase()}`)
      .limit(1)
      .maybeSingle();
    if (data) return !!data.active;
  } catch (_) {}
  try {
    let q = supabase.from("memberships").select("end_at,expires_at").order("end_at",{ascending:false}).limit(1);
    if (user_sub) q = q.eq("user_id", user_sub);
    else if (email) q = q.eq("email", (email||"").toLowerCase());
    else return false;
    const { data: rows } = await q;
    const row = rows?.[0]; const exp = row?.end_at || row?.expires_at;
    return exp ? new Date(exp) > new Date() : false;
  } catch(_) { return false; }
}

// CORS خفيف


exports.handler = async (event) => {
  const pre = preflight(event);
  if (pre) return pre;
  const pf = preflight?.(event);
  if (pf) return pf;

  try {
    if (event.httpMethod !== "POST") {
      return { statusCode:405, headers: { ...CORS }, body:"Method Not Allowed" };
    }
    // حراسة
    const gate = await requireUser(event);
    if (!gate.ok) return { statusCode: gate.status, headers: { ...CORS }, body: gate.error };
    const active = await isActiveMembership(gate.user?.sub, gate.user?.email);
    if (!active) return { statusCode:402, headers: { ...CORS }, body:"Membership is not active." };

    // مفاتيح
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return { statusCode:500, headers: { ...CORS }, body:"Missing GEMINI_API_KEY" };

    // المدخلات
    let p = {};
    try { p = JSON.parse(event.body||"{}"); } catch { return { statusCode:400, headers: { ...CORS }, body:"Bad JSON" }; }
    const subject = (p.subject||"").trim();
    const grade   = (p.grade||"").trim();
    const count   = Math.min(5, Math.max(1, Number(p.count)||1));
    const mode    = p.mode || "manual";
    const lessons = Array.isArray(p.lessons) ? p.lessons.filter(Boolean).slice(0,5) : [];


    // (اختياري للمستقبل) مصادر رسمية تُحقن هنا:
    const officialContext = ""; // اتركيه فارغًا الآن. عند التوصيل بمصدر رسمي نملأه ونُلزم النموذج بعدم الخروج عنه.

    // لو الوضع AI لاختيار الدروس: نطلب من النموذج اقتراح أسماء دروس للصف/المادة (لكن لن نخلط)
    let lessonList = lessons;
    if (mode === "ai" && lessonList.length === 0) {
      lessonList = ["الدرس"]; // مكانية بسيطة؛ سيتم تخصيصه داخل البرومبت.
    }

    const prompt = `
أنت مُخطِّط تعليمي سعودي يلتزم بآخر إصدار من مناهج السعودية. إياك إضافة مفردات أو أهداف من دروس أخرى.
${officialContext ? "اعتمد فقط على المصادر التالية:\n"+officialContext+"\n" : ""}

المادة: "${subject}"
الصف: "${grade}"
عدد الدروس هذا الأسبوع: ${count}
أسماء الدروس المقصودة (إن وُجدت): ${lessonList.join(" | ") || "غير مُحددة؛ استنتج درسًا واحدًا مناسبًا واستعمله للأسبوع كله"}

المطلوب على خطوتين:

[الخطوة A — تحديد Canon للدرس]
- استخرج أهداف الدرس الأساسية (من 2 إلى 6 أهداف قصيرة دقيقة).
- استخرج مفرداته الجديدة الأساسية (من 3 إلى 8 كلمات كحد أقصى).
- لا تضع مفردة من درس آخر.
- الناتج: {"canon":{"lessonTitle":"...", "objectives":[...], "vocab":[...] }}

[الخطوة B — خطة أسبوعية ٥ أيام]
- وزّع أهداف الدرس الأساسية على أيام الأسبوع (Segment 1..5).
- لا يجوز خلط درسين في اليوم نفسه. نعمل على درس واحد للأسبوع.
- يجب أن تكون مفردات كل يوم Subset من canon.vocab فقط (بدون إضافة كلمات جديدة).
- إذا كانت الأهداف أقل من ٥: خصص الأيام المتبقية للتثبيت/التطبيق/مختبر/تقويم، **بدون** إدخال مفردات جديدة.
- لا تكرّر الهدف نفسه في أكثر من يوم إلا لو بصياغة تعزيز/تطبيق مختلفة.
- لكل يوم:
  { "goals":[... 1-2 أهداف كحد أقصى ...],
    "vocab":[... subset of canon.vocab ... حد أقصى 1-3 كلمات],
    "outcomes":"نتيجة متوقعة مختصرة متوافقة مع الأهداف",
    "homework":"تكليف منزلي بسيط لدقيقة أو تمرين قصير" }

أعِد **فقط** JSON بالشكل:
{
  "meta": { "subject":"...", "grade":"...", "count": ${count}, "lesson": "..." },
  "canon": { "objectives":[...], "vocab":[...] },
  "days": [
    { "goals":[...], "vocab":[...], "outcomes":"...", "homework":"..." },
    { "goals":[...], "vocab":[...], "outcomes":"...", "homework":"..." },
    { "goals":[...], "vocab":[...], "outcomes":"...", "homework":"..." },
    { "goals":[...], "vocab":[...], "outcomes":"...", "homework":"..." },
    { "goals":[...], "vocab":[...], "outcomes":"...", "homework":"..." }
  ]
}
`.trim();

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-1.5-flash" });
    const req = {
      contents:[{ role:"user", parts:[{ text: prompt }] }],
      generationConfig:{
        responseMimeType:"application/json",
        maxOutputTokens: 2048,
        temperature: 0.6,
        topP: 0.9,
        topK: 64
      }
    };
    const result = await model.generateContent(req);
    const raw =
      (typeof result?.response?.text === "function" ? result.response.text() : "") ||
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!raw) return { statusCode:502, headers: { ...CORS }, body:"Empty response" };

    let j;
    try{ j = JSON.parse(raw); }
    catch{
      const cleaned = raw.replace(/```json|```/g,'').trim();
      j = JSON.parse(cleaned);
    }

    // ==== Post-processing صارم لمنع المفردات/الأهداف الغلط/التكرار ====
    const canon = {
      objectives: Array.isArray(j?.canon?.objectives) ? j.canon.objectives.map(s=>String(s).trim()).filter(Boolean) : [],
      vocab:      Array.isArray(j?.canon?.vocab)      ? j.canon.vocab.map(s=>String(s).trim()).filter(Boolean) : []
    };
    // Dedup
    const uniq = arr => [...new Set(arr.map(s=>s.trim()))].filter(Boolean);
    canon.objectives = uniq(canon.objectives).slice(0,6);
    canon.vocab      = uniq(canon.vocab).slice(0,8);

    // days
    const days = Array.isArray(j?.days) ? j.days : [];
    const safeDays = [];
    for (let i=0;i<5;i++){
      const d = days[i] || {};
      const goals = uniq(Array.isArray(d.goals)? d.goals : []).slice(0,2);
      // Subset vocab
      const sub  = uniq(Array.isArray(d.vocab)? d.vocab : []).filter(v => canon.vocab.includes(v)).slice(0,3);
      const out  = String(d.outcomes||'').trim();
      const hw   = String(d.homework||'').trim();
      safeDays.push({ goals, vocab: sub, outcomes: out, homework: hw });
    }

    // توزيع إضافي لضمان تغطية الأهداف الأساسية وعدم تكرارها بنفس اليوم:
    // إذا لم تُغطَّ كل الأهداف، نحقن المتبقي بالتتابع في الأيام الفارغة (هدف واحد في اليوم).
    const covered = new Set(safeDays.flatMap(d=>d.goals));
    const remaining = canon.objectives.filter(o => !covered.has(o));
    let cursor = 0;
    for (let i=0;i<5 && cursor<remaining.length;i++){
      if ((safeDays[i].goals||[]).length < 2){
        safeDays[i].goals.push(remaining[cursor++]);
      }
    }
    // لو بقت أهداف، انثريها هدفًا واحدًا في الأيام التالية دون تكرار
    for (; cursor<remaining.length; cursor++){
      const idx = cursor % 5;
      if (!safeDays[idx].goals.includes(remaining[cursor])){
        if (safeDays[idx].goals.length<2) safeDays[idx].goals.push(remaining[cursor]);
      }
    }
    // لا مفردات جديدة في أيام “التثبيت/التطبيق” الخالية من أهداف جديدة
    for (let i=0;i<5;i++){
      if (!safeDays[i].goals.length) safeDays[i].vocab = [];
    }

    const payload = {
      meta: {
        subject: subject || j?.meta?.subject || "المادة",
        grade:   grade   || j?.meta?.grade   || "الصف",
        count,
        lesson:  j?.meta?.lesson || (lessons[0]||"")
      },
      canon,
      days: safeDays
    };

    return {
      statusCode:200,
  headers: { ...CORS, "Content-Type":"application/json; charset=utf-8" },
      body: JSON.stringify(payload)
    };

  }catch(e){
    console.error("mueen-plan error:", e);
    return { statusCode:500, headers: { ...CORS }, body: e.message || "Server error" };
  }
};
