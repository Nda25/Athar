// netlify/functions/mulham.js
// مُلهم — توليد حِزم أنشطة صفّية جاهزة (حركي / جماعي / فردي)

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
const AGE_LABEL = {
  p1: "ابتدائي دُنيا",
  p2: "ابتدائي عُليا",
  m: "متوسط",
  h: "ثانوي",
};
const ageLabel = (age) => AGE_LABEL[age] || "ابتدائي عُليا";

function clampInt(v, min, max, def) {
  const n = Number(v);
  if (Number.isFinite(n)) return Math.max(min, Math.min(max, Math.round(n)));
  return def;
}

function hashInt(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return Math.abs(h >>> 0);
}

const stripFences = (s = "") =>
  String(s)
    .replace(/^\s*```json\b/i, "")
    .replace(/^\s*```/i, "")
    .replace(/```$/i, "")
    .trim();

function isAgeAppropriate(txt, stage) {
  const t = String(txt || "").toLowerCase();
  const bannedHigh = /(ركض|جر[يى]|قفز|سباق|مطاردة|رقص|صراخ)/;
  const bannedPrimary = /(حمض|قلوي|لهب|غاز سام|مذيب|كحول مركز|مشرط)/;

  if (stage === "h" && bannedHigh.test(t)) return false;
  if ((stage === "p1" || stage === "p2") && bannedPrimary.test(t)) return false;
  return true;
}

function dedupActivities(arr, stage, max = 3) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  const seen = new Set();
  for (const a of arr) {
    const title = (a?.title || "").trim();
    const idea = (a?.summary || a?.description || "").trim();
    if (!title || !idea) continue;

    if (
      !isAgeAppropriate(`${title} ${idea} ${(a?.steps || []).join(" ")}`, stage)
    )
      continue;

    const key = (title + "|" + idea).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
    if (out.length >= max) break;
  }
  return out;
}

function normalizeActivity(a = {}, totalMinutes) {
  const dur =
    typeof a.duration === "number" && a.duration > 0
      ? clampInt(
          a.duration,
          3,
          Math.max(10, totalMinutes),
          Math.max(5, Math.round(totalMinutes / 2))
        )
      : Math.max(5, Math.min(20, Math.round(totalMinutes / 2)));

  const arr = (x) =>
    Array.isArray(x) ? x.filter(Boolean).map(String).slice(0, 10) : [];
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

// ====== توجيهات بسيطة حسب المرحلة ======
function getAgeGuidance(stage) {
  const guides = {
    p1: `
- العمر: 6-9 سنوات (ابتدائي دُنيا)
- اللغة: كلمات بسيطة جداً، جمل قصيرة (5-7 كلمات)
- التفكير: تذكّر بسيط، لا تحليل معقد
- الأمثلة: من حياتهم اليومية (البيت، المدرسة، المسجد، الحي)
- السياق السعودي: التمر، النخيل، الكعبة، العلم السعودي، رمضان
- الأنشطة: هادئة وآمنة تماماً، بدون جري/قفز/ركض
- التعليمات: مباشرة ('ارسم'، 'لوّن'، 'قل'، 'عدّ')`,

    p2: `
- العمر: 10-12 سنة (ابتدائي عُليا)
- اللغة: واضحة، جمل 8-12 كلمة، مصطلحات بسيطة
- التفكير: فهم وتطبيق بسيط
- الأمثلة: من بيئتهم المحلية والوطنية
- السياق السعودي: مدن المملكة، يوم التأسيس، رؤية 2030 (مبسطة)، مواسم السعودية
- الأنشطة: تفاعلية هادئة، عمل جماعي بسيط
- التعليمات: واضحة ('قارن'، 'صنّف'، 'اشرح بكلماتك')`,

    m: `
- العمر: 13-15 سنة (متوسط)
- اللغة: دقيقة، مصطلحات علمية واضحة
- التفكير: تحليل وربط واستنتاج
- الأمثلة: قضايا محلية ومشاريع وطنية
- السياق السعودي: رؤية 2030، الطاقة المتجددة، الاستدامة، المشاريع الوطنية
- الأنشطة: تعاون منظم، مشاريع قصيرة، تجارب بسيطة
- التعليمات: تحليلية ('حلل'، 'استنتج'، 'قارن واستخلص')`,

    h: `
- العمر: 16-18 سنة (ثانوي)
- اللغة: أكاديمية، مصطلحات متخصصة
- التفكير: تقييم ونقد وإبداع
- الأمثلة: بحث علمي، ابتكار، قضايا معاصرة
- السياق السعودي: ريادة الأعمال، الذكاء الاصطناعي، سوق العمل، الجامعات السعودية
- الأنشطة: رصينة، دراسات حالة، مشاريع بحثية، نقاش أكاديمي
- التعليمات: متقدمة ('قيّم'، 'انقد بموضوعية'، 'ابتكر حلاً')
- ممنوع: الركض، القفز، الجري، الرقص، الأنشطة الطفولية`,
  };

  return guides[stage] || guides.p2;
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

    const gate = await requireUser(event);
    if (!gate.ok) {
      return { statusCode: gate.status, headers: CORS, body: gate.error };
    }

    const active = await isActiveMembership(gate.user?.sub, gate.user?.email);
    if (!active) {
      return {
        statusCode: 402,
        headers: CORS,
        body: "Membership is not active (trial expired or not activated).",
      };
    }

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

    const DURATION_MIN = clampInt(time, 5, 60, 20);
    const SUBJ = String(subject || "").slice(0, 120);
    const TOPIC = String(topic || SUBJ || "").slice(0, 160);
    const STAGE = age;

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      return { statusCode: 500, headers: CORS, body: "Missing GEMINI_API_KEY" };
    }
    const genAI = new GoogleGenerativeAI(API_KEY);
    const MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

    // بناء البرومبت
    const ageGuidance = getAgeGuidance(STAGE);
    const constraints = [];
    constraints.push(`الوقت الإجمالي: ${DURATION_MIN} دقيقة`);
    constraints.push(`مستوى بلوم: ${bloom}`);
    constraints.push("اللغة عربية سليمة، آمنة تماماً، بدون مخاطر");
    constraints.push("الأنشطة قابلة للتنفيذ فوراً داخل الفصل");
    if (noTools) constraints.push("Zero-prep: بدون تجهيزات معقدة");

    const adaptations = [];
    if (adaptLow)
      adaptations.push("تكيّف منخفض التحفيز: مهام قصيرة، تعزيز فوري");
    if (adaptDiff)
      adaptations.push("فروق فردية: مستويات متعددة (سهل/متوسط/متقدم)");

    const prompt = `
أنت مصمم أنشطة تعليمية للمدارس السعودية. أعطني **JSON واحد فقط** يحوي 3 فئات:
1) أنشطة صفّية حركية
2) أنشطة صفّية جماعية  
3) أنشطة صفّية فردية

لكل فئة: **٢-٣ أنشطة** مختلفة ومناسبة تماماً للمرحلة.

📚 المادة: "${SUBJ}"
📖 الموضوع: "${TOPIC}"

👥 المرحلة والتوجيهات:
${ageGuidance}

📌 القواعد:
${constraints.map((c) => `- ${c}`).join("\n")}
${
  adaptations.length
    ? "\n🎯 التكييفات:\n" + adaptations.map((a) => `- ${a}`).join("\n")
    : ""
}

⚠️ مهم جداً:
- العناوين رصينة ومناسبة للعمر
- خطوات عملية واضحة (ليست أسئلة نقاش)
- تذكرة خروج محددة (ليست سؤال مفتوح)
- لا تكرار بين الأنشطة
- إذا لم تُستخدم مواد اكتبي []

JSON فقط:
{
  "categories": [
    {
      "name": "أنشطة صفّية حركية",
      "activities": [
        {
          "title": "...",
          "summary": "...",
          "duration": 7,
          "materials": ["..."],
          "steps": ["...", "..."],
          "exit": "...",
          "impact": "...",
          "lowMotivation": "...",
          "differentiation": "..."
        }
      ]
    },
    { "name": "أنشطة صفّية جماعية", "activities": [...] },
    { "name": "أنشطة صفّية فردية", "activities": [...] }
  ],
  "tips": ["...", "..."]
}
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

    const rawText =
      (typeof res?.response?.text === "function" ? res.response.text() : "") ||
      res?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "";

    if (!rawText) {
      return {
        statusCode: 502,
        headers: CORS,
        body: "Empty response from model",
      };
    }

    let data;
    try {
      data = JSON.parse(stripFences(rawText));
    } catch (e) {
      // محاولة استخراج JSON من النص
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          data = JSON.parse(jsonMatch[0]);
        } catch (e2) {
          return {
            statusCode: 500,
            headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" },
            body: `Model returned non-JSON response. Raw text:\n${rawText.slice(
              0,
              500
            )}`,
          };
        }
      } else {
        return {
          statusCode: 500,
          headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" },
          body: `Model returned non-JSON response. Raw text:\n${rawText.slice(
            0,
            500
          )}`,
        };
      }
    }

    if (!data || !Array.isArray(data.categories)) {
      return { statusCode: 500, headers: CORS, body: "Invalid JSON shape" };
    }

    // إزالة التكرار وفلترة
    const categories = (data.categories || []).map((c) => {
      const acts = Array.isArray(c.activities) ? c.activities : [];
      return {
        name: String(c.name || "").trim(),
        activities: dedupActivities(acts, STAGE, 3),
      };
    });

    // اختيار نشاط واحد لكل فئة
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
    if (!movement && categories[0]) movement = pickOne(categories[0]);
    if (!group && categories[1]) group = pickOne(categories[1]);
    if (!individual && categories[2]) individual = pickOne(categories[2]);

    const sets = {
      movement: movement ? normalizeActivity(movement, DURATION_MIN) : {},
      group: group ? normalizeActivity(group, DURATION_MIN) : {},
      individual: individual ? normalizeActivity(individual, DURATION_MIN) : {},
    };

    const tips = Array.isArray(data.tips)
      ? data.tips.filter(Boolean).slice(0, 10)
      : [];

    const meta = {
      subject: SUBJ,
      topic: TOPIC,
      time: DURATION_MIN,
      bloom,
      age: STAGE,
      variant: variant || "",
      model: MODEL,
    };

    const ua = event.headers["user-agent"] || null;
    const ref = event.headers["referer"] || event.headers["referrer"] || null;
    const ip =
      event.headers["x-nf-client-connection-ip"] ||
      event.headers["x-forwarded-for"]?.split(",")[0] ||
      null;
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
