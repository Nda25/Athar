// netlify/functions/murtakaz.js
// مرتكز — توليد مخطط درس مختصر (موضوع/نص) مع حماية كاملة + تتبّع

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createClient } = require("@supabase/supabase-js");
const { requireUser } = require("./_auth.js");

/* ========= إعدادات عامة ========= */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "https://n-athar.co,https://www.n-athar.co,https://athar.sa")
  .split(",").map(s => s.trim()).filter(Boolean);

// نخلي الموديل من البيئة وإلا الافتراضي موحّد
const MODEL_ID = process.env.GEMINI_MODEL || "gemini-1.5-flash";

// حدود أمان
const MAX_BODY_BYTES = +(process.env.MAX_BODY_BYTES || 200 * 1024);
const MAX_TEXT_CHARS = +(process.env.MAX_TEXT_CHARS || 1200);

/* ========= CORS ========= */
function corsHeaders(origin) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
  };
}

/* ========= Supabase ========= */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

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

async function supaLogToolUsage(user, meta) {
  try {
    await supabase.from("tool_usage").insert({
      user_sub: user?.sub || null,
      tool_name: "murtakaz",
      path: meta?.path || null,
      meta,
      user_agent: meta?.ua || null,
      ip: meta?.ip || null,
    });
  } catch (_) {}
}

/* ========= أدوات ========= */
function safeJson(str, fallback = null) {
  try { return JSON.parse(str || "null") ?? fallback; } catch { return fallback; }
}
const cut = (s, n) => (s || "").slice(0, n);

const AGE_LABEL = { p1: "ابتدائي دُنيا", p2: "ابتدائي عُليا", m: "متوسط", h: "ثانوي" };
const dhow = (v) => (v == null ? "—" : String(v));

/* ========= الفنكشن ========= */
exports.handler = async (event) => {
  const origin = (event.headers?.origin || "").trim();
  const CORS = corsHeaders(origin);

  try {
    // Preflight
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: CORS, body: "" };
    }
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
    }

    // تحقّق من الأصل (اختياري تشدّدي هنا)
    if (ALLOWED_ORIGINS.length && origin && !ALLOWED_ORIGINS.includes(origin)) {
      return { statusCode: 403, headers: CORS, body: "Forbidden origin" };
    }

    // حماية JWT
    const gate = await requireUser(event);
    if (!gate.ok) {
      return { statusCode: gate.status, headers: CORS, body: gate.error };
    }

    // اشتراك نشط
    const active = await isActiveMembership(gate.user?.sub, gate.user?.email);
    if (!active) {
      return { statusCode: 402, headers: CORS, body: "Membership is not active (trial expired or not activated)." };
    }

    // حجم الطلب
    const rawLen = Buffer.byteLength(event.body || "", "utf8");
    if (rawLen > MAX_BODY_BYTES) {
      return { statusCode: 413, headers: CORS, body: "Payload too large" };
    }

    // مفتاح Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { statusCode: 500, headers: CORS, body: "Missing GEMINI_API_KEY" };

    // المدخلات
    const {
      mode,         // "topic" | "text"
      subject,
      topic,
      sourceText,
      age,
      duration,
      bloomMain,
      bloomSupport,
      goalCount,
      notes,
      level,
      adapt,
      variant
    } = safeJson(event.body, {}) || {};

    // تنظيف وقيود
    const S = {
      mode: (mode || "topic"),
      subject: cut(subject || "—", 100),
      topic: cut(topic || "—", 140),
      sourceText: cut(sourceText || "", MAX_TEXT_CHARS),
      age: (age || "p2"),
      duration: Math.max(15, Math.min(90, +duration || 45)),
      bloomMain: (bloomMain || "understand"),
      bloomSupport: (bloomSupport || ""),
      goalCount: Math.max(1, Math.min(5, +goalCount || 2)),
      notes: cut(notes || "", 240),
      level: (level || "mixed"),
      adapt: !!adapt,
      variant: String(variant || Date.now())
    };

    // زمن داخل/قبل/بعد
    const pre = Math.min(10, Math.max(3, Math.round(S.duration * 0.20)));
    const during = Math.max(15, Math.round(S.duration * 0.55));
    const post = Math.max(5, Math.round(S.duration * 0.25));

    const ageLabel = AGE_LABEL[S.age] || S.age || "—";

    // تهيئة الموديل
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_ID });

    // برومبت — JSON فقط
    const prompt = `
أنت مخطط دروس ذكي بالعربية لمدارس السعودية (مناهج 2025+).
- أخرج **JSON واحد فقط** (لا نص خارجه).
- نسلّك الأهداف والأنشطة وأدوات التقويم مع Bloom الأساسي: "${dhow(S.bloomMain)}" (+ "${dhow(S.bloomSupport)}" إن وجد).
- الأنشطة عملية قابلة للتنفيذ خلال ${S.duration} دقيقة، منظمة "قبل/أثناء/بعد" بمدد: ${pre}/${during}/${post}.
- المخرجات قصيرة وواضحة ومناسبة لعمر "${ageLabel}" وبيئة الصف السعودي.
- إن وُضع mode="text" فاستخرج موضوعًا مناسبًا من النص ووافق الأهداف معه.
- لو "variant" موجود نوّع جذريًا في العنوان والتنظيم.

أجب بهذا القالب حصراً:
{
  "meta": {
    "topic": "عنوان مختصر مبتكر ومحدد",
    "age": "${dhow(S.age)}",
    "ageLabel": "${ageLabel}",
    "mainBloomLabel": "${dhow(S.bloomMain)}",
    "supportBloomLabel": "${dhow(S.bloomSupport)}"
  },
  "goals": [ ${Array.from({length: S.goalCount}).map(()=>'"__"').join(", ")} ],
  "success": "__",
  "structure": ["قبل (تهيئة ${pre}د): __", "أثناء (${during}د): __", "بعد (${post}د): __"],
  "activities": ["تمهيد محسوس ملائم للعمر", "نشاط تعاوني موجّه", "تطبيق فردي قصير", "منتج نهائي/عرض وجيز"],
  "assessment": ["س١ مباشر مرتبط بالموضوع: __", "س٢ أعلى قليلاً في بلوم: __", "س٣ تذكرة خروج قابلة للقياس: __"],
  "diff": ["دعم: __", "إثراء: __", "مرونة العرض: __"],
  "oneMin": "نص الدقيقة الواحدة الملائم"
}

المعطيات:
- mode: ${dhow(S.mode)} (topic/text)
- المادة: ${dhow(S.subject)}
- الموضوع: ${dhow(S.topic)}
- النص للتحليل: ${S.sourceText || "—"}
- ملاحظات المعلم: ${dhow(S.notes)}
- مستوى الصف: ${dhow(S.level)}
- تعلم تكيفي: ${S.adapt ? "نعم" : "لا"}
- Bloom: ${dhow(S.bloomMain)} / ${dhow(S.bloomSupport)}
- الزمن: ${S.duration} دقيقة
- variant: ${S.variant}

JSON فقط.
`.trim();

    // استدعاء Gemini
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        candidateCount: 1,
        maxOutputTokens: 2048,
        temperature: 0.6
      }
    });

    const raw = String(result?.response?.text?.() || "").trim();
    if (!raw) {
      return { statusCode: 502, headers: CORS, body: "Bad model output (empty)" };
    }

    // التقاط JSON ولو مُسوّر بـ ```
    const m = raw.match(/\{[\s\S]*\}$/m) || raw.match(/\{[\s\S]*\}/m);
    let payload;
    try { payload = JSON.parse(m ? m[0] : raw); }
    catch {
      return { statusCode: 502, headers: CORS, body: "Bad model output (non-JSON)" };
    }

    const sa = (a) => Array.isArray(a) ? a.filter(Boolean) : [];
    const body = {
      meta: payload.meta || {
        topic: S.topic || "—",
        age: S.age || "",
        ageLabel,
        mainBloomLabel: S.bloomMain || "",
        supportBloomLabel: S.bloomSupport || ""
      },
      goals: sa(payload.goals),
      success: payload.success || "",
      structure: sa(payload.structure),
      activities: sa(payload.activities),
      assessment: sa(payload.assessment),
      diff: sa(payload.diff),
      oneMin: payload.oneMin || ""
    };

    // تتبّع
    const ua = event.headers["user-agent"] || null;
    const ref = event.headers["referer"] || event.headers["referrer"] || null;
    const ip =
      event.headers["x-nf-client-connection-ip"] ||
      (event.headers["x-forwarded-for"]?.split(",")[0] || null);
    supaLogToolUsage(gate.user, {
      ...S,
      model: MODEL_ID,
      ua, ip, path: ref
    }).catch(()=>{});

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body)
    };

  } catch (err) {
    console.error("murtakaz error:", err);
    const msg = (err && err.message) ? err.message : String(err);
    return { statusCode: 500, headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" }, body: `Server error: ${msg}` };
  }
};
