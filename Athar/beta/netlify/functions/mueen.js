// /netlify/functions/mueen.js
// مُعين: خطة أسبوعية (٥ أيام) بلا قاعدة محلية — توليد ذكي موجّه
// حماية: requireUser + اشتراك نشط عبر Supabase
// ملاحظة: الذكاء يولد مسودة متوافقة مع منهج السعودية 2025 قدر الإمكان، لكنها تظل قابلة للمراجعة السريعة.

const { createClient } = require("@supabase/supabase-js");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { requireUser } = require("./_auth");

// ===== Supabase admin client =====
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession:false } }
);

async function isActiveMembership(user_sub, email){
  try {
    const { data } = await supabase
      .from("v_user_status").select("active")
      .or(`user_sub.eq.${user_sub},email.eq.${(email||"").toLowerCase()}`)
      .limit(1).maybeSingle();
    if (data) return !!data.active;
  } catch(_) {}
  try {
    let q = supabase.from("memberships").select("end_at,expires_at").order("end_at",{ascending:false}).limit(1);
    if (user_sub) q = q.eq("user_id", user_sub);
    else if (email) q = q.eq("email", (email||"").toLowerCase());
    else return false;
    const { data:rows } = await q;
    const row=rows?.[0]; const exp=row?.end_at||row?.expires_at;
    return exp ? new Date(exp)>new Date() : false;
  } catch(_) { return false; }
}

const CORS = {
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"Content-Type, Authorization",
  "Access-Control-Allow-Methods":"POST, OPTIONS"
};

// ========= أدوات =========
function parseGradeLabel(g){
  const map = {
    "أول ابتدائي":1,"ثاني ابتدائي":2,"ثالث ابتدائي":3,"رابع ابتدائي":4,"خامس ابتدائي":5,"سادس ابتدائي":6,
    "أول متوسط":7,"ثاني متوسط":8,"ثالث متوسط":9,"أول ثانوي":10,"ثاني ثانوي":11,"ثالث ثانوي":12
  };
  if (typeof g === "number") return { n:g, label: Object.keys(map).find(k=>map[k]===g) || `صف ${g}` };
  const n = map[String(g).trim()] || null;
  return { n, label: String(g).trim() };
}

exports.handler = async (event)=>{
  try{
    if (event.httpMethod === "OPTIONS") return { statusCode:204, headers:CORS, body:"" };
    if (event.httpMethod !== "POST") return { statusCode:405, headers:CORS, body:"Method Not Allowed" };

    // 0) Auth + اشتراك
    const gate = await requireUser(event);
    if (!gate.ok) return { statusCode: gate.status, headers:CORS, body: gate.error };
    const active = await isActiveMembership(gate.user?.sub, gate.user?.email);
    if (!active) return { statusCode:402, headers:CORS, body:"Membership is not active." };

    // 1) مفاتيح الذكاء
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { statusCode:500, headers:CORS, body:"Missing GEMINI_API_KEY" };

    // 2) جسم الطلب
    let body = {};
    try { body = JSON.parse(event.body || "{}"); }
    catch { return { statusCode:400, headers:CORS, body:"Bad JSON" }; }

    const subject = String(body.subject||"").trim();
    const gradeIn  = body.grade;
    const { n:grade, label:grade_label } = parseGradeLabel(gradeIn);
    const lessonsMode  = (body.lessonsMode || "manual"); // manual | ai
    const lessonsCount = Math.max(1, Math.min(5, Number(body.lessonsCount || 5)));
    const lessonNames  = Array.isArray(body.lessonNames) ? body.lessonNames.filter(Boolean).slice(0,5) : [];

    if (!subject || !grade) return { statusCode:400, headers:CORS, body:"Missing subject/grade" };
    if (lessonsMode === "manual" && lessonNames.length === 0) {
      return { statusCode:400, headers:CORS, body:"Provide lesson names or switch mode to ai" };
    }

    // 3) برومبت صارم
    const phase =
      grade<=6 ? "ابتدائي" : grade<=9 ? "متوسط" : "ثانوي";

    const constraints = [
      `المادة: ${subject}، الصف: ${grade_label} (${phase}).`,
      "قسّم خطة أسبوعية من الأحد إلى الخميس (٥ أيام).",
      lessonsMode==="manual"
        ? `أسماء الدروس الواردة (بالترتيب): ${lessonNames.join(" | ")}`
        : `اختر أسماء الدروس بنفسك بما يحاكي منهج السعودية 2025 (آخر إصدار) لهذه المادة والصف.`,
      `عدد الدروس لهذا الأسبوع: ${lessonsCount} (يوزّع كل درس على يوم واحد، ولا تخلط بين الدروس).`,
      "لكل يوم أعطِ: اسم الدرس، أهداف تعلم واضحة قابلة للقياس (٣–5 نقاط قصيرة)، مفردات جديدة (٣–8 مفردات ملائمة)، نتائج متوقعة مختصرة، وواجب منزلي مقترح.",
      "التزِم بالملاءمة العمرية؛ تجنب الأفكار الطفولية في الثانوي، وتجنب المصطلحات المعقّدة جدًا في الابتدائي.",
      "تجنّب التكرار بين الأيام. لا تنسخ الأهداف نفسها عبر الأيام.",
      "صياغة عربية سليمة ومباشرة، وخالية من الإطالة.",
      "لا تستخدم أدوات صفية ولا مراجع خارجية؛ فقط خطة قابلة للنسخ.",
      "أجب فقط في JSON بالمخطط التالي وبدون أي نص زائد."
    ];

    const schema = `{
  "meta": { "subject":"...", "grade_label":"...", "days":["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"] },
  "week": [
    { "day":"الأحد",
      "lesson_name":"...",
      "unit_name":"...", 
      "objectives":["...","..."],
      "vocab":["...","..."],
      "outcomes":"...",
      "homework":"..."
    }
  ]
}`;

    const prompt = `
أنت مساعد تخطيط دروس سعودي موثوق. أنشئ خطة أسبوعية محاكية لمنهج السعودية 2025، تراعي الفئة العمرية بدقة.
${constraints.map(s=>"- "+s).join("\n")}

أجب بصيغة JSON فقط مطابقة للمخطط:
${schema}
`.trim();

    // 4) استدعاء Gemini
    const gen = new GoogleGenerativeAI(apiKey);
    const model = gen.getGenerativeModel({ model: "gemini-1.5-flash" });
    const req = {
      contents: [{ role:"user", parts:[{ text: prompt }] }],
      generationConfig: {
        responseMimeType:"application/json",
        maxOutputTokens: 2048,
        temperature: 0.7,
        topP: 0.9,
        candidateCount: 1
      }
    };
    const result = await model.generateContent(req);

    const raw =
      (typeof result?.response?.text === "function" ? result.response.text() : "") ||
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!raw) return { statusCode:502, headers:CORS, body:"Empty model response" };

    let data;
    try { data = JSON.parse(raw); }
    catch {
      const cleaned = raw.replace(/```json|```/g,"").trim();
      data = JSON.parse(cleaned);
    }

    // 5) تطبيع + تقليص لعدد الأيام المطلوبة
    const DAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"];
    let week = Array.isArray(data.week) ? data.week : [];
    // ضمان 5 عناصر مرتبة
    const mapByDay = {};
    week.forEach(x=>{ if (x?.day && DAYS.includes(x.day)) mapByDay[x.day]=x; });
    week = DAYS.map(d => mapByDay[d] || { day:d });

    // إبقاء فقط عدد الدروس المطلوب (أول N أيام)
    const usedDays = DAYS.slice(0, lessonsCount);
    week = week.filter(x => usedDays.includes(x.day));

    // تنظيف الحقول
    function arr(a){ return Array.isArray(a) ? a.filter(Boolean).slice(0,8) : []; }
    function txt(t){ return (typeof t==="string"?t.trim():"") || ""; }
    week = week.map(x=>({
      day: x.day,
      lesson_name: txt(x.lesson_name),
      unit_name: txt(x.unit_name),
      objectives: arr(x.objectives),
      vocab: arr(x.vocab),
      outcomes: txt(x.outcomes),
      homework: txt(x.homework)
    }));

    const out = {
      meta: {
        subject,
        grade_label,
        days: usedDays
      },
      week
    };

    return {
      statusCode:200,
      headers:{ ...CORS, "Content-Type":"application/json; charset=utf-8" },
      body: JSON.stringify(out)
    };

  }catch(e){
    console.error("mueen error:", e);
    return { statusCode:500, headers:CORS, body:"Server error" };
  }
};
