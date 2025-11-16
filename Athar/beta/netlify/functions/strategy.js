const { createClient } = require("@supabase/supabase-js");
const { requireUser } = require("./_auth.js");

/* ===== CORS ===== */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/* ===== Supabase ===== */
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

/* ===== Helpers ===== */
function safeJson(str, fallback = null) {
  try {
    return JSON.parse(str || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
const cut = (s, n) => (s || "").slice(0, n);

// تحويل stage → age
const STAGE_TO_AGE = {
  "primary-lower": "p1",
  "primary-upper": "p2",
  middle: "m",
  secondary: "h",
};

const AGE_LABEL = {
  p1: "ابتدائي دُنيا",
  p2: "ابتدائي عُليا",
  m: "متوسط",
  h: "ثانوي",
};

const dhow = (v) => (v == null ? "—" : String(v));
const stripFences = (s = "") =>
  String(s)
    .replace(/^\s*```json\b/i, "")
    .replace(/^\s*```/i, "")
    .replace(/```$/i, "")
    .trim();

/* ===== Gemini models ===== */
const PRIMARY = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const FALLBACKS = (
  process.env.GEMINI_FALLBACKS || "gemini-1.5-pro,gemini-1.5-flash-8b"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const MODELS = [PRIMARY, ...FALLBACKS];

const TIMEOUT_MS = +(process.env.TIMEOUT_MS || 23000);
const MAX_RETRIES = +(process.env.RETRIES || 2);
const BACKOFF_MS = +(process.env.BACKOFF_MS || 700);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ===== One-shot call with robust JSON parse ===== */
async function callGeminiOnce(model, apiKey, promptText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error("timeout")),
    TIMEOUT_MS
  );

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        generationConfig: {
          responseMimeType: "application/json",
          candidateCount: 1,
          maxOutputTokens: 2048,
          temperature: 0.6,
        },
      }),
      signal: controller.signal,
    });

    const txt = await res.text();
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      err.body = txt.slice(0, 800);
      throw err;
    }

    let outer;
    try {
      outer = JSON.parse(txt);
    } catch {
      const err = new Error("Bad JSON (outer) from API");
      err.status = 502;
      err.body = txt.slice(0, 800);
      throw err;
    }

    const raw = outer?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    if (!raw) return { ok: false, rawText: "", data: null };

    const txtClean = stripFences(raw);
    try {
      return { ok: true, rawText: txtClean, data: JSON.parse(txtClean) };
    } catch {
      const m =
        txtClean.match(/\{[\s\S]*\}$/m) || txtClean.match(/\{[\s\S]*\}/m);
      if (m) {
        try {
          return { ok: true, rawText: m[0], data: JSON.parse(m[0]) };
        } catch {
          /* ignore */
        }
      }
      return { ok: false, rawText: txtClean, data: null };
    }
  } finally {
    clearTimeout(timer);
  }
}

/* ===== Prompt builder - معدل للـstrategy format ===== */
function buildPrompt(
  stage,
  subject,
  bloomType,
  lesson,
  preferred,
  ageLabelStr,
  variant
) {
  return `
أنت مخطط استراتيجيات تدريسية مبتكرة للمدارس السعودية (مناهج 2025+).
- أخرج **JSON واحد فقط** (لا نص خارجه).
- المرحلة: ${ageLabelStr}
- المادة: ${subject}
- نوع التفكير (Bloom): ${bloomType}
- الدرس: ${lesson}
${preferred ? `- تفضيل المعلم: ${preferred}` : ""}
- variant: ${variant}

المطلوب: استراتيجية تدريسية **مبتكرة وعملية** مناسبة للمرحلة والمادة.

أجب بهذا القالب حصراً:
{
  "strategy_name": "اسم الاستراتيجية بالعربي (مثل: التعلم بالاستقصاء، التفكير الناقد، ...)",
  "bloom": "${bloomType}",
  "importance": "لماذا هذه الاستراتيجية مناسبة لهذا الدرس؟ (2-3 جمل)",
  "goals": [
    "هدف 1 محدد وقابل للقياس",
    "هدف 2 محدد وقابل للقياس",
    "هدف 3 محدد وقابل للقياس"
  ],
  "steps": [
    "خطوة 1 عملية وواضحة",
    "خطوة 2 عملية وواضحة",
    "خطوة 3 عملية وواضحة",
    "خطوة 4 عملية وواضحة",
    "خطوة 5 عملية وواضحة"
  ],
  "examples": [
    "مثال تطبيقي 1",
    "مثال تطبيقي 2",
    "مثال تطبيقي 3"
  ],
  "materials": "المواد والأدوات المطلوبة (جملة واحدة)",
  "assessment": "كيف نقيّم نجاح الاستراتيجية؟ (2-3 جمل)",
  "diff_support": "للطلاب الذين يحتاجون دعم إضافي",
  "diff_core": "للطلاب في المستوى المتوسط",
  "diff_challenge": "للطلاب المتفوقين",
  "expected_impact": "الأثر المتوقع على تعلم الطلاب (2-3 جمل)",
  "citations": [
    {
      "title": "مرجع تربوي 1 (اختياري)",
      "benefit": "الفائدة من هذا المرجع"
    },
    {
      "title": "مرجع تربوي 2 (اختياري)",
      "benefit": "الفائدة من هذا المرجع"
    }
  ]
}

JSON فقط. لا تضف أي نص خارج الـJSON.
`.trim();
}

/* ===== Handler ===== */
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
    if (!gate.ok)
      return { statusCode: gate.status, headers: CORS, body: gate.error };

    // اشتراك نشط
    const active = await isActiveMembership(gate.user?.sub, gate.user?.email);
    if (!active) {
      return {
        statusCode: 402,
        headers: CORS,
        body: "Membership is not active (trial expired or not activated).",
      };
    }

    // مفاتيح البيئة
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY)
      return { statusCode: 500, headers: CORS, body: "Missing GEMINI_API_KEY" };

    // ✅ المدخلات من Frontend
    const {
      stage, // "primary-lower", "primary-upper", "middle", "secondary"
      subject, // "الرياضيات", "العلوم", ...
      bloomType, // "remember", "understand", "apply", ...
      lesson, // نص الدرس
      preferred, // تفضيل المعلم (اختياري)
      variant, // للتنويع
    } = safeJson(event.body, {}) || {};

    // التحقق من المدخلات الأساسية
    if (!stage || !subject) {
      return {
        statusCode: 400,
        headers: CORS,
        body: "Missing required fields: stage, subject",
      };
    }

    // تحويل stage → age
    const age = STAGE_TO_AGE[stage] || "p2";
    const ageLabelStr = AGE_LABEL[age] || stage;

    // تنظيف المدخلات
    const S = {
      stage: stage,
      subject: cut(subject || "—", 100),
      bloomType: bloomType || "understand",
      lesson: cut(lesson || "—", 200),
      preferred: cut(preferred || "", 200),
      variant: String(variant || Date.now()),
    };

    const prompt = buildPrompt(
      S.stage,
      S.subject,
      S.bloomType,
      S.lesson,
      S.preferred,
      ageLabelStr,
      S.variant
    );

    // موديلات × محاولات + إصلاح ذاتي
    let final = null,
      finalRaw = "",
      usedModel = "";
    for (const model of MODELS) {
      let p = prompt;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const resp = await callGeminiOnce(model, API_KEY, p);
          finalRaw = resp.rawText || finalRaw;

          if (resp.ok && resp.data) {
            final = resp.data;
            usedModel = model;
            break;
          }

          // إصلاح: نعيد إرسال الرد السابق ونطلب JSON صالح
          p = `${prompt}

الاستجابة السابقة غير صالحة/ناقصة. هذا نصّك:
<<<
${(resp.rawText || "").slice(0, 4000)}
<<<
أعيدي الآن **JSON واحدًا صالحًا** يطابق القالب أعلاه فقط.`;
          await sleep(BACKOFF_MS * (attempt + 1));
        } catch (e) {
          await sleep(BACKOFF_MS * (attempt + 1));
        }
      }
      if (final) break;
    }

    // إن فشل التوليد بالكامل
    if (!final) {
      return {
        statusCode: 200,
        headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          debug: "incomplete",
          rawText: finalRaw || "",
          message: "Model returned incomplete JSON after retries",
        }),
      };
    }

    // ✅ تهيئة المخرجات بشكل Frontend
    const sa = (a) => (Array.isArray(a) ? a.filter(Boolean) : []);
    const body = {
      strategy_name: final.strategy_name || "—",
      bloom: final.bloom || S.bloomType,
      importance: final.importance || "",
      goals: sa(final.goals),
      steps: sa(final.steps),
      examples: sa(final.examples),
      materials: final.materials || "",
      assessment: final.assessment || "",
      diff_support: final.diff_support || "",
      diff_core: final.diff_core || "",
      diff_challenge: final.diff_challenge || "",
      expected_impact: final.expected_impact || "",
      citations: sa(final.citations),
      _meta: { model: usedModel },
    };

    // تتبّع
    const ua = event.headers["user-agent"] || null;
    const ref = event.headers["referer"] || event.headers["referrer"] || null;
    const ip =
      event.headers["x-nf-client-connection-ip"] ||
      event.headers["x-forwarded-for"]?.split(",")[0] ||
      null;
    supaLogToolUsage(gate.user, {
      ...S,
      model: usedModel,
      ua,
      ip,
      path: ref,
    }).catch(() => {});

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    };
  } catch (err) {
    const msg = err?.stack || err?.message || String(err);
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" },
      body: `Server error: ${msg}`,
    };
  }
};
