// /netlify/functions/mueen.js
// مُعين: خطة أسبوعية (٥ أيام) مع خطوة اختيارية لجلب مصادر رسمية وتمريرها للذكاء كسياق مُلزِم
// حماية: requireUser + اشتراك نشط

const { createClient } = require("@supabase/supabase-js");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { requireUser } = require("./_auth");

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

function parseGradeLabel(g){
  const map = {
    "أول ابتدائي":1,"ثاني ابتدائي":2,"ثالث ابتدائي":3,"رابع ابتدائي":4,"خامس ابتدائي":5,"سادس ابتدائي":6,
    "أول متوسط":7,"ثاني متوسط":8,"ثالث متوسط":9,"أول ثانوي":10,"ثاني ثانوي":11,"ثالث ثانوي":12
  };
  if (typeof g === "number") return { n:g, label: Object.keys(map).find(k=>map[k]===g) || `صف ${g}` };
  const n = map[String(g).trim()] || null;
  return { n, label: String(g).trim() };
}

// ======== جمع مصادر رسمية عبر Bing (اختياري) ========
const OFFICIAL_DOMAINS = [
  "moe.gov.sa",          // وزارة التعليم
  "ien.edu.sa",          // قنوات عين/بوابة تعليمية
  "madrasati.sa",        // مدرستي
  "k12.gov.sa",          // نطاقات تعليمية حكومية محتملة
  "noor.moe.gov.sa"      // نور
];

async function searchOfficialSources({ subject, grade_label, lessonNames, count }){
  const key = process.env.BING_SEARCH_KEY;
  const endpoint = process.env.BING_SEARCH_ENDPOINT || "https://api.bing.microsoft.com/v7.0/search";
  if (!key) return { sources: [], note: "تم التوليد دون مصادر مباشرة (BING_SEARCH_KEY غير متوفر)." };

  // نبني استعلامات مختصرة
  const queries = [];
  const baseQ = `${subject} ${grade_label} أهداف الدرس المفردات site:${OFFICIAL_DOMAINS.join(" OR site:")}`;
  queries.push(baseQ);
  (lessonNames||[]).slice(0,5).forEach(name=>{
    queries.push(`${subject} "${name}" ${grade_label} أهداف المفردات site:${OFFICIAL_DOMAINS.join(" OR site:")}`);
  });

  const results = [];
  for (const q of queries){
    const url = `${endpoint}?q=${encodeURIComponent(q)}&mkt=ar-SA&count=10&freshness=Year`;
    const res = await fetch(url, { headers: { "Ocp-Apim-Subscription-Key": key }});
    if (!res.ok) continue;
    const j = await res.json().catch(()=> ({}));
    const webPages = j?.webPages?.value || [];
    for (const w of webPages){
      const host = (new URL(w.url)).host;
      if (!OFFICIAL_DOMAINS.some(d => host.endsWith(d))) continue; // فلترة صارمة
      results.push({
        title: w.name,
        url: w.url,
        snippet: w.snippet || w.description || ""
      });
      if (results.length >= Math.max(3, count)) break;
    }
    if (results.length >= Math.max(3, count)) break;
  }

  // إزالة التكرارات حسب URL
  const uniq = [];
  const seen = new Set();
  for (const r of results){
    if (seen.has(r.url)) continue;
    seen.add(r.url); uniq.push(r);
  }
  return { sources: uniq.slice(0, Math.max(3, count)), note: uniq.length ? null : "لم تُعثر مصادر مناسبة؛ تم توليد مسودة ذكية." };
}

// ======== الدالة الرئيسية ========
exports.handler = async (event)=>{
  try{
    if (event.httpMethod === "OPTIONS") return { statusCode:204, headers:CORS, body:"" };
    if (event.httpMethod !== "POST") return { statusCode:405, headers:CORS, body:"Method Not Allowed" };

    const gate = await requireUser(event);
    if (!gate.ok) return { statusCode: gate.status, headers:CORS, body: gate.error };
    const active = await isActiveMembership(gate.user?.sub, gate.user?.email);
    if (!active) return { statusCode:402, headers:CORS, body:"Membership is not active." };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { statusCode:500, headers:CORS, body:"Missing GEMINI_API_KEY" };

    let body = {};
    try { body = JSON.parse(event.body || "{}"); }
    catch { return { statusCode:400, headers:CORS, body:"Bad JSON" }; }

    const subject = String(body.subject||"").trim();
    const gradeIn  = body.grade;
    const { n:grade, label:grade_label } = parseGradeLabel(gradeIn);
    const lessonsMode  = (body.lessonsMode || "manual"); // manual | ai
    const lessonsCount = Math.max(1, Math.min(5, Number(body.lessonsCount || 5)));
    const lessonNames  = Array.isArray(body.lessonNames) ? body.lessonNames.filter(Boolean).slice(0,5) : [];
    const sourceMode   = (body.sourceMode || "authoritative"); // authoritative | off

    if (!subject || !grade) return { statusCode:400, headers:CORS, body:"Missing subject/grade" };
    if (lessonsMode === "manual" && lessonNames.length === 0) {
      return { statusCode:400, headers:CORS, body:"Provide lesson names or switch mode to ai" };
    }

    // 1) مصادر رسمية (اختياري)
    let sources = []; let note = null;
    if (sourceMode === "authoritative"){
      try {
        const sr = await searchOfficialSources({ subject, grade_label, lessonNames, count: lessonsCount });
        sources = sr.sources || []; note = sr.note || null;
      } catch(e){ note = "تعذّر الربط بالمصادر؛ تم توليد مسودة ذكية."; }
    }

    // 2) برومبت صارم
    const phase = grade<=6 ? "ابتدائي" : grade<=9 ? "متوسط" : "ثانوي";

    const constraints = [
      `المادة: ${subject}، الصف: ${grade_label} (${phase}).`,
      "قسّم خطة أسبوعية من الأحد إلى الخميس (٥ أيام).",
      lessonsMode==="manual"
        ? `أسماء الدروس الواردة (بالترتيب): ${lessonNames.join(" | ")}`
        : `اختر أسماء الدروس بنفسك بما يحاكي منهج السعودية 2025 (آخر إصدار) لهذه المادة والصف.`,
      `عدد الدروس لهذا الأسبوع: ${lessonsCount} (يوزّع كل درس على يوم واحد، ولا تخلط بين الدروس).`,
      "لكل يوم أعطِ: اسم الدرس، أهداف تعلم واضحة قابلة للقياس (٣–5)، مفردات جديدة (٣–8)، نتائج متوقعة مختصرة، وواجب منزلي مقترح.",
      "التزِم بالملاءمة العمرية؛ تجنب الأفكار الطفولية في الثانوي، وتجنب المصطلحات المعقّدة جدًا في الابتدائي.",
      "تجنّب التكرار بين الأيام. لا تنسخ الأهداف نفسها عبر الأيام.",
      "صياغة عربية سليمة ومباشرة، وخالية من الإطالة.",
      "لا تستخدم أدوات صفية ولا مراجع خارجية؛ فقط خطة قابلة للنسخ.",
      "أجب فقط في JSON بالمخطط المطلوب وبدون أي نص زائد."
    ];

    // سياق المصادر الرسمية (إن وُجدت): نُلزم النموذج بعدم الخروج عنه
    let sourcesBlock = "";
    if (sources.length){
      const sTxt = sources.map((s,i)=>`[${i+1}] ${s.title}\nURL: ${s.url}\nمقتطف: ${s.snippet||""}`).join("\n\n");
      sourcesBlock = `\n\nالمصادر الرسمية التالية مُلزِمة، لا تخرج عنها، واستلهم منها الأهداف والمفردات:\n${sTxt}\n\n`;
    }

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
${sourcesBlock}
أجب بصيغة JSON فقط مطابقة للمخطط:
${schema}
`.trim();

    // 3) توليد
    const gen = new GoogleGenerativeAI(apiKey);
    const model = gen.getGenerativeModel({ model: "gemini-1.5-flash" });
    const req = {
      contents: [{ role:"user", parts:[{ text: prompt }] }],
      generationConfig: {
        responseMimeType:"application/json",
        maxOutputTokens: 2048,
        temperature: sources.length ? 0.5 : 0.7, // أكثر تحفظًا عند وجود مصادر
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

    // 4) تطبيع + اقتصار على عدد الأيام
    const DAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"];
    let week = Array.isArray(data.week) ? data.week : [];
    const mapByDay = {};
    week.forEach(x=>{ if (x?.day && DAYS.includes(x.day)) mapByDay[x.day]=x; });
    const usedDays = DAYS.slice(0, lessonsCount);
    week = usedDays.map(d => mapByDay[d] || { day:d });

    const arr = a => Array.isArray(a) ? a.filter(Boolean).slice(0,8) : [];
    const txt = t => (typeof t==="string"?t.trim():"") || "";
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
      meta: { subject, grade_label, days: usedDays, note },
      week,
      sources // نعرضها في الواجهة كرابط مرجعي
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
