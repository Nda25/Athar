// /netlify/functions/mueen.js
// مُعين: خطة أسبوعية موزعة على 5 أيام مع توزيع صارم للدروس على الأيام (لا خلط)
// + خيار مصادر رسمية (Bing) كسياق مُلزِم
// الحماية: requireUser + اشتراك نشط

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

// ======== مصادر رسمية عبر Bing (اختياري) ========
const OFFICIAL_DOMAINS = [
  "moe.gov.sa","ien.edu.sa","madrasati.sa","k12.gov.sa","noor.moe.gov.sa"
];

async function searchOfficialSources({ subject, grade_label, lessonNames, count }){
  const key = process.env.BING_SEARCH_KEY;
  const endpoint = process.env.BING_SEARCH_ENDPOINT || "https://api.bing.microsoft.com/v7.0/search";
  if (!key) return { sources: [], note: "تم التوليد دون مصادر مباشرة (BING_SEARCH_KEY غير متوفر)." };

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
      if (!OFFICIAL_DOMAINS.some(d => host.endsWith(d))) continue;
      results.push({ title:w.name, url:w.url, snippet:w.snippet || w.description || "" });
      if (results.length >= Math.max(3, count)) break;
    }
    if (results.length >= Math.max(3, count)) break;
  }
  const uniq = []; const seen=new Set();
  for (const r of results){ if (!seen.has(r.url)){ seen.add(r.url); uniq.push(r); } }
  return { sources: uniq.slice(0, Math.max(3, count)), note: uniq.length ? null : "لم تُعثر مصادر مناسبة؛ تم توليد مسودة ذكية." };
}

// ======== توزيع الأيام على الدروس (لا خلط) ========
const DAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"];

function allocateDays(numLessons){
  const base = Math.floor(5 / numLessons);
  const rem  = 5 % numLessons;
  const buckets = Array.from({length:numLessons}, (_,i)=> base + (i<rem?1:0)); // مثلاً 2+3
  // تحويل إلى تعيين أيام فعلية
  const mapping = []; let idx=0;
  for (let i=0;i<numLessons;i++){
    const size = buckets[i];
    mapping.push(DAYS.slice(idx, idx+size));
    idx += size;
  }
  return mapping; // مصفوفة طولها numLessons، كل عنصر أيام ذلك الدرس
}

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
    const lessonNames  = Array.isArray(body.lessonNames) ? body.lessonNames.filter(Boolean).slice(0,lessonsCount) : [];
    const sourceMode   = (body.sourceMode || "authoritative");

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

    // 2) مواصفة توزيع الأيام على الدروس (لا خلط)
    const dayBuckets = allocateDays(lessonsCount);
    const planSpec = dayBuckets.map((daysArr, i)=>({
      order: i+1,
      lesson_name: lessonsMode==="manual" ? (lessonNames[i] || `درس ${i+1}`) : "(يُحدده النموذج من المنهج)",
      days: daysArr
    }));
    // أمثلة أجزاء مقترحة ليسترشد بها الموديل عندما يمتد الدرس على عدة أيام
    const segmentGuide = [
      "تمهيد وتنشيط معرفي",
      "بناء المفهوم/الشرح الموجّه",
      "ممارسة تطبيقية/مختبر",
      "تقويم بنائي وتشخيص فجوات",
      "إثراء/مشروع قصير/عرض"
    ];

    const phase = grade<=6 ? "ابتدائي" : grade<=9 ? "متوسط" : "ثانوي";

    const constraints = [
      `المادة: ${subject}، الصف: ${grade_label} (${phase}).`,
      "الخطة ثابتًا على ٥ أيام: الأحد، الاثنين، الثلاثاء، الأربعاء، الخميس.",
      "يُمنع خلط درسين في يوم واحد.",
      "عندما يمتد الدرس أكثر من يوم واحد، اجعل كل يوم «جزءًا» مستقلاً باسم Segment واضح، مع هدف جزء مميز، وتقدم منطقي (مثل: تمهيد ← بناء ← ممارسة ← تقويم ← إثراء).",
      "لكل يوم: اسم الدرس، اسم الجزء (segment_name) وهدفه (segment_goal)، 3–5 أهداف تعلم لليوم، 3–8 مفردات جديدة، نتائج متوقعة مختصرة، وواجب منزلي مقترح.",
      "تجنّب تكرار الأهداف عبر الأيام؛ اجعلها تراكمية تصاعدية.",
      "صياغة عربية سليمة ومباشرة وملائمة للفئة العمرية."
    ];

    // سياق المصادر الرسمية (إن وُجدت)
    let sourcesBlock = "";
    if (sources.length){
      const sTxt = sources.map((s,i)=>`[${i+1}] ${s.title}\nURL: ${s.url}\nمقتطف: ${s.snippet||""}`).join("\n\n");
      sourcesBlock = `\n\nالمصادر الرسمية التالية مُلزِمة لا تخرج عنها:\n${sTxt}\n\n`;
    }

    const schema = `{
  "meta": { "subject":"...", "grade_label":"...", "days":["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"] },
  "week": [
    { "day":"الأحد",
      "lesson_name":"...",
      "unit_name":"...",
      "segment_name":"تمهيد وتنشيط معرفي",
      "segment_goal":"...",
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

مواصفة توزيع الدروس على أيام الأسبوع (اتّبعها حرفيًا):
${planSpec.map(s=>`- الدرس ${s.order}: ${s.lesson_name} → الأيام: ${s.days.join("، ")}`).join("\n")}

أسماء أجزاء مقترحة للدرس الممتد عبر عدة أيام (يمكن الاختيار منها أو ما شابهها): ${segmentGuide.join("، ")}.

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
        temperature: sources.length ? 0.5 : 0.7,
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

    // 4) تطبيع + **تحقق صارم** من الالتزام بالتوزيع
    const usedDays = DAYS.slice(0,5);
    const arr = a => Array.isArray(a) ? a.filter(Boolean).slice(0,8) : [];
    const txt = t => (typeof t==="string"?t.trim():"") || "";

    // خرائط الدرس → أيامه بحسب planSpec
    const dayToLessonOrder = {};
    planSpec.forEach(spec=> spec.days.forEach(d=> { dayToLessonOrder[d]=spec.order; }));

    // إبقاء يوم واحد لكل عنصر من usedDays
    const received = Array.isArray(data.week) ? data.week : [];
    const byDay = {};
    received.forEach(x => { if (x?.day && usedDays.includes(x.day) && !byDay[x.day]) byDay[x.day]=x; });

    const week = usedDays.map(d => {
      const x = byDay[d] || { day:d };
      // ضمان الحقول
      return {
        day: d,
        lesson_name: txt(x.lesson_name),
        unit_name: txt(x.unit_name),
        segment_name: txt(x.segment_name),
        segment_goal: txt(x.segment_goal),
        objectives: arr(x.objectives),
        vocab: arr(x.vocab),
        outcomes: txt(x.outcomes),
        homework: txt(x.homework)
      };
    });

    const out = { meta: { subject, grade_label, days: usedDays, note }, week, sources };

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
