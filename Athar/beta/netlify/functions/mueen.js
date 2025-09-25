// /.netlify/functions/mueen.js
// Mueen: يبني خطة أسبوعية من جدول المناهج الرسمي (Supabase)
// لا يختلق أهداف/مفردات. يتطلب مستخدمًا مصادقًا وعضوية نشطة.

const { createClient } = require("@supabase/supabase-js");
const { requireUser } = require("./_auth");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

// CORS
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

async function isActive(user_sub, email) {
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
    let q = supabase.from("memberships")
      .select("end_at, expires_at").order("end_at", { ascending:false }).limit(1);
    if (user_sub) q = q.eq("user_id", user_sub);
    else if (email) q = q.eq("email", (email||"").toLowerCase());
    else return false;
    const { data: rows } = await q;
    const row = rows?.[0]; const exp = row?.end_at || row?.expires_at;
    return exp ? new Date(exp) > new Date() : false;
  } catch (_) { return false; }
}

const DAYS = ["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس"];

function currentWeekLabel(){
  const d=new Date();
  const y=d.getFullYear(), m=d.getMonth()+1;
  const w=Math.ceil((d.getDate() + (new Date(y, m-1, 1).getDay()))/7);
  return `${y}-${String(m).padStart(2,"0")} / الأسبوع ${w}`;
}

// يجلب صف الدرس من جدول المناهج
async function fetchLessonRow(subject, grade, lessonName){
  const { data, error } = await supabase
    .from("ksa_curriculum_v2025")
    .select("lesson_name, unit_name, objectives, vocab, outcomes")
    .eq("grade", grade)
    .ilike("subject", subject.trim())
    .ilike("lesson_name", lessonName.trim())
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("fetchLesson error", error);
    return null;
  }
  return data || null;
}

function homeworkSuggestion(lesson){
  if(!lesson) return "مراجعة مختصرة للنقاط الرئيسة و3 أسئلة تطبيق من الكتاب.";
  return `حل تمارين نهاية درس «${lesson}» من الكتاب، والسؤال الإثرائي إن وُجد.`;
}

exports.handler = async (event) => {
  try{
    if (event.httpMethod === "OPTIONS") return { statusCode:204, headers:CORS, body:"" };
    if (event.httpMethod !== "POST")   return { statusCode:405, headers:CORS, body:"Method Not Allowed" };

    const gate = await requireUser(event);
    if (!gate.ok) return { statusCode: gate.status, headers:CORS, body: gate.error };

    const active = await isActive(gate.user?.sub, gate.user?.email);
    if (!active) return { statusCode:402, headers:CORS, body:"Membership is not active" };

    let body={};
    try { body = JSON.parse(event.body||"{}"); }
    catch { return { statusCode:400, headers:CORS, body:"Bad JSON body" }; }

    const subject = (body.subject||"").trim();
    const grade   = +body.grade;
    const lessons = Array.isArray(body.lessons) ? body.lessons.map(s=>String(s||"").trim()).filter(Boolean) : [];

    if(!subject || !(grade>=1 && grade<=12) || lessons.length<1 || lessons.length>5){
      return { statusCode:400, headers:CORS, body:"Invalid payload (subject, grade(1..12), lessons[1..5])" };
    }

    const planDays = [];
    for (let i=0; i<5; i++){
      const dayName = DAYS[i];
      const lesson  = lessons[i] || null;

      if (lesson){
        const row = await fetchLessonRow(subject, grade, lesson);
        if (row){
          planDays.push({
            day: dayName,
            lesson,
            found: true,
            objectives: Array.isArray(row.objectives) ? row.objectives : [],
            vocab: Array.isArray(row.vocab) ? row.vocab : [],
            outcomes: row.outcomes || "—",
            homework: homeworkSuggestion(lesson)
          });
        } else {
          planDays.push({
            day: dayName,
            lesson,
            found: false,
            objectives: [],
            vocab: [],
            outcomes: "",
            homework: homeworkSuggestion(lesson)
          });
        }
      } else {
        planDays.push({
          day: dayName,
          lesson: "مراجعة وتقويم قصير",
          found: true,
          objectives: ["مراجعة تعلّمات الأسبوع وتثبيت المفاهيم الأساسية."],
          vocab: [],
          outcomes: "يُظهر الطالب تمكنًا كافيًا من مفاهيم الأسبوع وفق تقويم قصير.",
          homework: "إكمال أي واجبات ناقصة والتحضير المسبق لدرس الأسبوع القادم."
        });
      }
    }

    const out = {
      meta: { subject, grade, weekLabel: currentWeekLabel() },
      days: planDays
    };

    return {
      statusCode:200,
      headers:{...CORS, "Content-Type":"application/json; charset=utf-8"},
      body: JSON.stringify(out)
    };
  }catch(e){
    console.error("mueen error:", e);
    return { statusCode:500, headers:CORS, body: e.message || "Server error" };
  }
};
