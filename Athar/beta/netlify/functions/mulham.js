// netlify/functions/mulham.js
// مُلهم — توليد حِزم أنشطة صفّية جاهزة (حركي / جماعي / فردي)
// حماية: requireUser (Auth0) + فحص اشتراك Supabase + تتبّع استخدام
// التزام صارم بالفئة العمرية + منع التكرار + بدائل Zero-prep وتكييف

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createClient } = require("@supabase/supabase-js");
const { requireUser } = require("./_auth.js");

// ====== CORS ======
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ====== Supabase (Service Role) ======
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

// ====== اشتراك مستخدم نشط؟ ======
async function isActiveMembership(user_sub, email) {
  try {
    const { data, error } = await supabase
      .from("v_user_status")
      .select("active")
      .or(`user_sub.eq.${user_sub},email.eq.${(email || "").toLowerCase()}`)
      .limit(1)
      .maybeSingle();
    if (!error && data) return !!data.active;
  } catch (_) {}

  try {
    let q = supabase
      .from("memberships")
      .select("end_at, expires_at")
      .order("end_at", { ascending: false })
      .limit(1);

    if (user_sub) q = q.eq("user_id", user_sub);
    else if (email) q = q.eq("email", (email || "").toLowerCase());
    else return false;

    const { data: rows } = await q;
    const row = rows?.[0];
    const exp = row?.end_at || row?.expires_at;
    return exp ? new Date(exp) > new Date() : false;
  } catch (_) {
    return false;
  }
}

// ====== تتبّع استخدام بسيط ======
async function supaLogToolUsage(user, meta) {
  try {
    const payload = {
      user_sub: user?.sub || null,
      tool_name: "mulham",
      path: meta?.path || null,
      meta,
      user_agent: meta?.ua || null,
      ip: meta?.ip || null,
    };
    await supabase.from("tool_usage").insert(payload);
  } catch (_) {}
}

// ====== أدوات عامة ======
const AGE_LABEL = { p1: "ابتدائي دُنيا", p2: "ابتدائي عُليا", m: "متوسط", h: "ثانوي" };
const ageLabel = (age) => AGE_LABEL[age] || "ابتدائي عُليا";

function clampInt(v, min, max, def) {
  const n = Number(v);
  if (Number.isFinite(n)) return Math.max(min, Math.min(max, Math.round(n)));
  return def;
}

// FNV-like hash → لتثبيت اختيار نشاط لكل مُدخلات
function hashInt(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return Math.abs(h >>> 0);
}

const stripFences = (s = "") =>
  String(s).replace(/^\s*```json\b/i, "").replace(/^\s*```/i, "").replace(/```$/i, "").trim();

// فلترة أنشطة غير مناسبة عمريًا (ألفاظ/أفعال)
// - للثانوي: امنعي “ركض/قفز/جري/رقص/ألعاب مطاردة”… إلخ
// - للابتدائي: امنعي أدوات أو تعليمات غير آمنة/معمليّة معقدة
function isAgeAppropriate(txt, stage) {
  const t = String(txt || "").toLowerCase();

  const bannedHigh = /(ركض|جر[يى]|قفز|سباق|مطاردة|رقص|كوكلات|صراخ|تصفيق صاخب)/;
  const bannedPrimary = /(حمض|قلوي|لهب|غاز سام|مذيب|تيار كهربائي مباشر|كحول مركز|مشرط)/;

  if (stage === "h") {
    if (bannedHigh.test(t)) return false;
  }
  if (stage === "p1" || stage === "p2") {
    if (bannedPrimary.test(t)) return false;
  }
  return true;
}

// إزالة التكرار + ضبط 2..3 عناصر لكل فئة
function dedupActivities(arr, stage, max = 3) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  const seen = new Set();
  for (const a of arr) {
    const title = (a?.title || "").trim();
    const idea = (a?.summary || a?.description || "").trim();
    if (!title || !idea) continue;

    // فلترة الملاءمة
    if (!isAgeAppropriate(`${title} ${idea} ${(a?.steps || []).join(" ")}`, stage)) continue;

    const key = (title + "|" + idea).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
    if (out.length >= max) break;
  }
  return out;
}

function normalizeActivity(a = {}, totalMinutes) {
  const dur = typeof a.duration === "number" && a.duration > 0
    ? clampInt(a.duration, 3, Math.max(10, totalMinutes), Math.max(5, Math.round(totalMinutes / 2)))
    : Math.max(5, Math.min(20, Math.round(totalMinutes / 2)));

  const arr = (x) => (Array.isArray(x) ? x.filter(Boolean).map(String).slice(0, 10) : []);
  const txt = (x) => (typeof x === "string" ? x.trim() : "") || "";

  return {
    ideaHook: txt(a.ideaHook || a.title),
    desc: txt(a.summary || a.description),
    duration: dur,
    materials: arr(a.materials),
    steps: arr(a.steps),
    exitTicket: txt(a.exit || a.exitTicket),
    expectedImpact: txt(a.impact || a.expectedImpact),
    diff: {
      lowMotivation: txt(a.lowMotivation || a.diff_low || a.low),
      differentiation: txt(a.differentiation || a.diff_levels || a.diff),
    },
  };
}

// ================== HANDLER ==================
exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: CORS, body: "" };
    }
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
    }

    // حماية JWT
    const gate = await requireUser(event);
    if (!gate.ok) {
      return { statusCode: gate.status, headers: CORS, body: gate.error };
    }

    // اشتراك نشط
    const active = await isActiveMembership(gate.user?.sub, gate.user?.email);
    if (!active) {
      return {
        statusCode: 402,
        headers: CORS,
        body: "Membership is not active (trial expired or not activated).",
      };
    }

    // قراءة الجسم
    let payload = {};
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return { statusCode: 400, headers: CORS, body: "Bad JSON body" };
    }

    const {
      subject = "",
      topic = "",
      time = 20,
      bloom = "understand",
      age = "p2",
      noTools = false,
      adaptLow = false,
      adaptDiff = false,
      variant = "",
    } = payload;

    // (1) ضبط/تطبيع القيم — ***لا نعيد تعريف اسم مرة ثانية***
    const DURATION_MIN = clampInt(time, 5, 60, 20);
    const SUBJ = String(subject || "").slice(0, 120);
    const TOPIC = String(topic || SUBJ || "").slice(0, 160);
    const STAGE = age; // p1/p2/m/h

    // (2) إعداد Gemini
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      return { statusCode: 500, headers: CORS, body: "Missing GEMINI_API_KEY" };
    }
    const genAI = new GoogleGenerativeAI(API_KEY);
    const MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash"; // ثابت مثل بقية الملفات

    // (3) برومبت صارم
    const stageNote = {
      p1: "ابتدائي دُنيا (أعمار 6–9): حركات بسيطة هادئة، لغة شديدة البساطة، ألعاب تعليمية آمنة بدون جري/ركض/قفز.",
      p2: "ابتدائي عُليا (10–12): تجسيد وتمثيل بصري بسيط، تجنب الجري/الركض/القفز الطويل.",
      m: "متوسط (13–15): تعاون منظم، تعليمات واضحة، تجنّب أنشطة طفولية أو راقصة.",
      h: "ثانوي (16–18): أنشطة رصينة، تطبيقات واقعية، **يُمنع** الركض/القفز/الرقص/مطاردات.",
    }[STAGE] || "ابتدائي عُليا: لغة بسيطة وأنشطة آمنة.";

    const constraints = [];
    constraints.push(`إجمالي الوقت ~ ${DURATION_MIN} دقيقة؛ كل نشاط 5–${Math.max(10, DURATION_MIN)} دقائق.`);
    constraints.push(`مستوى بلوم المستهدف: ${bloom}. المرحلة: ${ageLabel(STAGE)}.`);
    constraints.push("اللغة عربية سليمة، جمل قصيرة، آمنة تمامًا، بدون مخاطر/كيماويات/لهب.");
    constraints.push("الأنشطة قابلة للتنفيذ فورًا داخل الفصل المدرسي.");
    if (noTools) constraints.push("Zero-prep: بدون مواد مطبوعة/قص/لصق/تجهيزات معقدة.");

    const adaptations = [];
    if (adaptLow) adaptations.push("تكيّف منخفض التحفيز: مهام قصيرة جدًا، تعزيز فوري، خيارات بسيطة، فواصل دقيقة.");
    if (adaptDiff) adaptations.push("فروق فردية: (سهل/متوسط/متقدم) أو منتجات بديلة.");

    const prompt = `
أنت مصمم تعلمي عربي خبير. أعطني **JSON واحد فقط** بالشكل المبين لاحقًا، يحوي ثلاث فئات:
1) أنشطة صفّية حركية، 2) أنشطة صفّية جماعية، 3) أنشطة صفّية فردية.
لكل فئة قدِّم **٢ إلى ٣** أنشطة مختلفة قوية **مناسبة تمامًا** لـ "${ageLabel(STAGE)}".
المجال: "${SUBJ}"، الموضوع: "${TOPIC}".

${stageNote}
${constraints.map((s) => "- " + s).join("\n")}
${adaptations.length ? "\nالتكييفات:\n" + adaptations.map((s) => "- " + s).join("\n") : ""}

قواعد صارمة:
- العناوين رصينة ومناسبة للعمر. للثانوي **ممنوع**: ركض/جري/قفز/رقص/مطاردة/تصفيق صاخب. للابتدائي **ممنوع**: أي مواد خطرة أو تجارب معملية معقدة.
- "steps" = خطوات تنفيذ مباشرة (أوامر عملية)، لا أسئلة مفتوحة من نوع "ناقش/تخيّل".
- "exit" = تذكرة خروج دقيقة واحدة بصياغة عربية سليمة، ليست سؤال نقاش مفتوح.
- لا تكرار للأفكار بين الأنشطة.
- إذا لم تُستخدم مواد اكتبي "materials": [] ولا تخترعي أدوات.

استجيبي **فقط** بهذا القالب:
{
  "categories": [
    { "name": "أنشطة صفّية حركية",
      "activities": [
        {
          "title": "...", "summary": "...", "duration": 7,
          "materials": ["..."], "steps": ["...", "..."],
          "exit": "...", "impact": "...",
          "zeroPrep": true,
          "lowMotivation": "إن لزم", "differentiation": "إن لزم"
        }
      ]
    },
    { "name": "أنشطة صفّية جماعية", "activities": [...] },
    { "name": "أنشطة صفّية فردية", "activities": [...] }
  ],
  "tips": ["...", "..."]
}
بدون أي نص خارج JSON.
`.trim();

    const req = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        candidateCount: 1,
        maxOutputTokens: 2048,
        temperature: 0.75,
        topK: 64,
        topP: 0.9,
      },
    };

    const model = genAI.getGenerativeModel({ model: MODEL });
    const res = await model.generateContent(req);

    // (4) قراءة النص
    const rawText =
      (typeof res?.response?.text === "function" ? res.response.text() : "") ||
      res?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "";

    if (!rawText) {
      return { statusCode: 502, headers: CORS, body: "Empty response from model" };
    }

    // (5) JSON parsing + تنظيف
    let data;
    try {
      data = JSON.parse(stripFences(rawText));
    } catch (e) {
      return {
        statusCode: 500,
        headers: CORS,
        body: "Model returned non-JSON response",
      };
    }

    if (!data || !Array.isArray(data.categories)) {
      return { statusCode: 500, headers: CORS, body: "Invalid JSON shape" };
    }

    // (6) إزالة التكرار وضبط 2..3 لكل فئة + فلترة الملاءمة
    const categories = (data.categories || []).map((c) => {
      const acts = Array.isArray(c.activities) ? c.activities : [];
      return {
        name: String(c.name || "").trim(),
        activities: dedupActivities(acts, STAGE, 3),
      };
    });

    // (7) اختيار عنصر ثابت لكل فئة اعتمادًا على seed
    const seedStr = `${variant}|${TOPIC}|${STAGE}|${bloom}|${DURATION_MIN}`;
    const idxSeed = hashInt(seedStr);

    function pickOne(cat) {
      const a = Array.isArray(cat.activities) ? cat.activities : [];
      if (a.length === 0) return null;
      const idx = idxSeed % a.length;
      return a[idx];
    }

    let movement = null,
      group = null,
      individual = null;
    for (const c of categories) {
      const n = (c.name || "").toLowerCase();
      if (!movement && /حرك/.test(n)) movement = pickOne(c);
      else if (!group && /جمع/.test(n)) group = pickOne(c);
      else if (!individual && /فرد/.test(n)) individual = pickOne(c);
    }
    // احتياطي بالترتيب إن لم تُسمّ الفئات بدقة
    if (!movement && categories[0]) movement = pickOne(categories[0]);
    if (!group && categories[1]) group = pickOne(categories[1]);
    if (!individual && categories[2]) individual = pickOne(categories[2]);

    // (8) تحويل لصيغة الواجهة
    const sets = {
      movement: movement ? normalizeActivity(movement, DURATION_MIN) : {},
      group: group ? normalizeActivity(group, DURATION_MIN) : {},
      individual: individual ? normalizeActivity(individual, DURATION_MIN) : {},
    };

    const tips = Array.isArray(data.tips) ? data.tips.filter(Boolean).slice(0, 10) : [];

    // (9) ميتا
    const meta = {
      subject: SUBJ,
      topic: TOPIC,
      time: DURATION_MIN,
      bloom,
      age: STAGE,
      variant: variant || "",
      model: MODEL,
    };

    // (10) تتبّع
    const ua = event.headers["user-agent"] || null;
    const ref = event.headers["referer"] || event.headers["referrer"] || null;
    const ip =
      event.headers["x-nf-client-connection-ip"] ||
      (event.headers["x-forwarded-for"]?.split(",")[0] || null);
    supaLogToolUsage(gate.user, {
      subject: SUBJ,
      topic: TOPIC,
      time: DURATION_MIN,
      bloom,
      age: STAGE,
      variant: variant || "",
      ua,
      ip,
      path: ref,
    }).catch(() => {});

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ meta, sets, tips }),
    };
  } catch (err) {
    const msg = err?.stack || err?.message || String(err);
    return { statusCode: 500, headers: CORS, body: `Mulham failed: ${msg}` };
  }
};
