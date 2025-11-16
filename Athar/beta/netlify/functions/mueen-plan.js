// netlify/functions/mueen-plan.js
// مُعين — تقسيم خطة أسبوعية (٥ أيام) من أهداف الدرس فقط
// - حماية Auth0 (requireUser)
// - تحقق عضوية Supabase
// - استدعاء Gemini لتقدير أهداف الدرس من منهج السعودية (2025-2026) قدر الإمكان
// - Post-processing صارم: ٥ أيام، ١–٢ هدف في اليوم، مفردات Subset، تغطية كل الأهداف

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createClient } = require("@supabase/supabase-js");
const { requireUser } = require("./_auth.js");

// ===== Supabase (Service Role) =====
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

async function isActiveMembership(user_sub, email) {
  try {
    const { data } = await supabase
      .from("v_user_status")
      .select("active")
      .or(`user_sub.eq.${user_sub},email.eq.${(email || "").toLowerCase()}`)
      .limit(1)
      .maybeSingle();
    if (data) return !!data.active;
  } catch (_) {}

  try {
    let q = supabase
      .from("memberships")
      .select("end_at,expires_at")
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

// CORS بسيط
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// مساعدة: إزالة التكرار
const uniq = (arr) =>
  [...new Set((arr || []).map((s) => String(s || "").trim()))].filter(Boolean);

async function logUsage(user, meta, ok) {
  try {
    const base =
      process.env.SITE_BASE_URL || process.env.PUBLIC_BASE_URL || "";
    if (!base) return;
    await fetch(`${base}/.netlify/functions/log-tool-usage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tool_name: "mueen",
        user_email: user?.email || null,
        meta: {
          ...(meta || {}),
          ok: !!ok,
        },
      }),
    });
  } catch (_) {}
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: CORS, body: "" };
    }
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
    }

    // حراسة Auth0
    const gate = await requireUser(event);
    if (!gate.ok) {
      return {
        statusCode: gate.status || 401,
        headers: CORS,
        body: gate.error || "Unauthorized",
      };
    }

    const user = gate.user || {};
    const active = await isActiveMembership(user.sub, user.email);
    if (!active) {
      return {
        statusCode: 402,
        headers: CORS,
        body: "Membership is not active.",
      };
    }

    // مفاتيح Gemini
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return {
        statusCode: 500,
        headers: CORS,
        body: "Missing GEMINI_API_KEY",
      };
    }
    const MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

    // المدخلات
    let p = {};
    try {
      p = JSON.parse(event.body || "{}");
    } catch {
      return { statusCode: 400, headers: CORS, body: "Bad JSON" };
    }

    const subject = String(p.subject || "").trim();
    const grade = String(p.grade || "").trim();
    const count = Math.min(5, Math.max(1, Number(p.count) || 1));

    if (!subject) {
      return { statusCode: 400, headers: CORS, body: "Missing subject" };
    }

    const meta = { subject, grade, count };

    // برومبت — لا نذكره للمعلّم لكنه يوجّه النموذج
    const prompt = `
أنت مخطِّط تعليمي سعودي خبير في مناهج السعودية الحديثة (1447 هـ / 2025–2026 م).
مهمتك مساعدة معلم على بناء خطة أسبوعية لدرس واحد فقط، مقسّم على ٥ أيام (الأحد–الخميس).

المادة / موضوع الدرس: "${subject}"
الصف / المرحلة: "${grade || "غير محدد"}"
عدد الحصص / الدروس هذا الأسبوع: ${count}

التعليمات:

1) لا تؤلف دروسًا أخرى خارج سياق الدرس. اعمل على "درس واحد" فقط، واعتبر أن الأسبوع مخصص لهذا الدرس (تمهيد، عرض، تطبيق، تقويم).
2) استند قدر الإمكان إلى مناهج السعودية (2025–2026) في صياغة الأهداف والمفردات، لكن لو لم تكن واثقًا فصياغة أهداف عامة صحيحة ومناسبة للمادة والصف مقبولة.
3) لا تخلط بين دروس متعددة في اليوم نفسه. كل الخطة مبنية على نفس الدرس.

[الخطوة A — Canon الدرس]
استخرج:
- من 2 إلى 6 أهداف تعلمية أساسية للدرس (قصيرة، بصيغة سلوكية قدر الإمكان).
- من 3 إلى 8 مفردات أساسية جديدة في هذا الدرس.
- لا تضف مفردات من وحدات أخرى لا ترتبط بالدرس.

الناتج لهذه الخطوة:
"canon":{ "lessonTitle":"اسم مقترح مختصر للدرس", "objectives":[...], "vocab":[...] }

[الخطوة B — خطة أسبوعية ٥ أيام]
- قسّم أهداف الدرس الأساسية (canon.objectives) على ٥ أيام (Segment 1..5).
- يجب تغطية جميع الأهداف الأساسية عبر الأيام الخمسة، بلا تكرار ممل.
- في كل يوم:
  * 1–2 هدف كحد أقصى.
  * المفردات (vocab) في هذا اليوم يجب أن تكون subset من canon.vocab فقط (بدون كلمات جديدة).
- الأيام الزائدة (إن كانت الأهداف قليلة) استثمرها في:
  * التثبيت والتطبيق العملي،
  * المختبر أو التجارب (إن كان مناسبًا للمادة)،
  * التقويم البنائي / الختامي،
  مع المحافظة على عدم إدخال مفردات جديدة بعيدة عن الدرس.

لكل يوم أرجع كائنًا بالشكل:
{
  "goals": ["هدف 1", "هدف 2"],
  "vocab": ["مفردة 1", "مفردة 2"],
  "outcomes": "نتيجة تعلم متوقعة مختصرة توافق الأهداف في هذا اليوم.",
  "homework": "واجب منزلي بسيط أو مهمة قصيرة تدعم أهداف اليوم."
}

أرجع في النهاية **JSON واحد فقط** بالشكل التالي حرفيًا:
{
  "meta": { "subject": "...", "grade": "...", "count": ${count}, "lesson": "اسم الدرس المقترح" },
  "canon": { "objectives": [...], "vocab": [...] },
  "days": [
    { "goals": [...], "vocab": [...], "outcomes": "...", "homework": "..." },
    { "goals": [...], "vocab": [...], "outcomes": "...", "homework": "..." },
    { "goals": [...], "vocab": [...], "outcomes": "...", "homework": "..." },
    { "goals": [...], "vocab": [...], "outcomes": "...", "homework": "..." },
    { "goals": [...], "vocab": [...], "outcomes": "...", "homework": "..." }
  ]
}

- لا تضف أي نص خارج هذا الكائن JSON.
`.trim();

    // استدعاء Gemini
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: MODEL });

    const req = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 2048,
        temperature: 0.6,
        topP: 0.9,
        topK: 40,
      },
    };

    const result = await model.generateContent(req);

    let raw =
      (typeof result?.response?.text === "function"
        ? result.response.text()
        : "") ||
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "";

    if (!raw) {
      await logUsage(user, meta, false);
      return { statusCode: 502, headers: CORS, body: "Empty response" };
    }

    // إزالة أسوار ```json لو وجدت
    raw = raw.replace(/```json|```/g, "").trim();

    let j;
    try {
      j = JSON.parse(raw);
    } catch (e) {
      await logUsage(user, meta, false);
      return {
        statusCode: 502,
        headers: CORS,
        body: "Bad JSON from model",
      };
    }

    // ==== Post-processing صارم ====

    const canon = {
      objectives: uniq(j?.canon?.objectives).slice(0, 6),
      vocab: uniq(j?.canon?.vocab).slice(0, 8),
    };

    let days = Array.isArray(j?.days) ? j.days : [];
    if (days.length < 5) {
      // لو أقل من ٥، كمّل مصفوفة الأيام
      while (days.length < 5) days.push({});
    } else if (days.length > 5) {
      days = days.slice(0, 5);
    }

    const safeDays = days.map((d) => {
      const goals = uniq(Array.isArray(d.goals) ? d.goals : []).slice(0, 2);
      const vocab = uniq(Array.isArray(d.vocab) ? d.vocab : []).filter((v) =>
        canon.vocab.includes(v)
      ).slice(0, 3);
      const outcomes = String(d.outcomes || "").trim();
      const homework = String(d.homework || "").trim();
      return { goals, vocab, outcomes, homework };
    });

    // ضمان تغطية كل الأهداف الأساسية على الأقل مرة
    const covered = new Set(safeDays.flatMap((d) => d.goals));
    const remaining = canon.objectives.filter((o) => !covered.has(o));
    let cursor = 0;

    for (let i = 0; i < safeDays.length && cursor < remaining.length; i++) {
      if ((safeDays[i].goals || []).length < 2) {
        safeDays[i].goals.push(remaining[cursor++]);
      }
    }

    // لا مفردات جديدة في يوم بلا أهداف (يوم تثبيت خفيف/تقويم عام)
    for (let i = 0; i < safeDays.length; i++) {
      if (!safeDays[i].goals.length) {
        safeDays[i].vocab = [];
      }
    }

    const payload = {
      meta: {
        subject: j?.meta?.subject || subject,
        grade: j?.meta?.grade || grade || "غير محدد",
        count: Number(j?.meta?.count) || count,
        lesson: j?.meta?.lesson || "",
      },
      canon,
      days: safeDays,
    };

    await logUsage(user, payload.meta, true);

    return {
      statusCode: 200,
      headers: {
        ...CORS,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(payload),
    };
  } catch (e) {
    console.error("mueen-plan error:", e);
    return {
      statusCode: 500,
      headers: CORS,
      body: e?.message || "Server error",
    };
  }
};
