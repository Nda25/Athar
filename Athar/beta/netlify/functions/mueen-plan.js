// netlify/functions/mueen-plan.js
// مُعين — خطة أسبوعية لعدة دروس:
// - لا نخلط درسين في نفس اليوم.
// - نستخرج أهداف + مفردات لكل درس قدر الإمكان من مناهج السعودية 2025–2026.
// - ٥ أيام (الأحد–الخميس) مع أهداف، مفردات، نتائج، وواجب منزلي.

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createClient } = require("@supabase/supabase-js");
const { requireUser } = require("./_auth.js");

// Supabase (Service Role)
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

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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
        user_sub: user?.sub || null,
        user_email: user?.email || null,
        meta: { ...(meta || {}), ok: !!ok },
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

    // Auth0
    const gate = await requireUser(event);
    if (!gate.ok) {
      return {
        statusCode: gate.status || 401,
        headers: CORS,
        body: gate.error || "Unauthorized",
      };
    }
    const user = gate.user || {};

    // عضوية
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
    const lessonsInput = Array.isArray(p.lessons)
      ? uniq(p.lessons).slice(0, 5)
      : [];

    if (!subject) {
      return { statusCode: 400, headers: CORS, body: "Missing subject" };
    }

    const lessons =
      lessonsInput.length > 0 ? lessonsInput : ["الدرس الأول"]; // fallback بسيط

    const meta = { subject, grade, count, lessons };

    // برومبت — عدة دروس، لا خلط في اليوم الواحد
    const lessonsList = lessons
      .map((name, idx) => `${idx + 1}) ${name}`)
      .join("\n");

    const prompt = `
أنت مخطِّط تعليمي سعودي خبير في مناهج السعودية الحديثة (1447 هـ / 2025–2026 م).
مهمتك مساعدة معلم على بناء خطة أسبوعية لعدة دروس من نفس المادة.

المادة / المجال العام: "${subject}"
الصف / المرحلة: "${grade || "غير محدد"}"
عدد الحصص / الدروس هذا الأسبوع: ${count}
أسماء الدروس كما أدخلها المعلم (استخدم هذه الأسماء حرفيًا قدر الإمكان):
${lessonsList}

التعليمات الأساسية:
- لا تضف دروسًا جديدة غير هذه الدروس.
- استند قدر الإمكان إلى مناهج السعودية 2025–2026 عند صياغة الأهداف والمفردات، مع قبول التقدير التربوي المعقول عند الحاجة.
- المطلوب:
  1) Canon لكل درس (أهداف + مفردات).
  2) خطة أسبوعية من ٥ أيام (الأحد–الخميس) توزّع هذه الدروس على الأيام، بحيث:
     • كل يوم مخصَّص لدرس واحد فقط (لا تخلط درسين في نفس اليوم).
     • يمكن للدرس الواحد أن يأخذ أكثر من يوم (تمهيد، عرض، تطبيق، تقويم).
     • غطِّ أهداف جميع الدروس خلال الأسبوع قدر الإمكان.

[الخطوة A — Canon لكل درس]
لكل درس من الدروس المذكورة أعلاه:
- استخرج من 2 إلى 5 أهداف تعلمية أساسية (قصيرة، واضحة، مناسبة للمستوى).
- استخرج من 3 إلى 8 مفردات أساسية جديدة في هذا الدرس.
مثال هيكل عنصر واحد:
{ "lesson":"اسم الدرس كما في القائمة", "objectives":[...], "vocab":[...] }

[الخطوة B — خطة أسبوعية ٥ أيام]
- اعتبر أن الأسبوع يتكون من ٥ أيام ثابتة (الأحد–الخميس).
- لكل يوم:
  * اربطه باسم درس واحد فقط من الدروس الواردة في القائمة أعلاه.
  * لا تخلط أكثر من درس في نفس اليوم.
  * اختر 1–2 هدف فقط من أهداف هذا الدرس لهذا اليوم.
  * اختر مفردات (vocab) من مفردات نفس الدرس (لا تضف كلمات غريبة من درس آخر).
  * اكتب "outcomes" نتيجة تعلم متوقعة مختصرة، مرتبطة بأهداف اليوم.
  * اكتب "homework" واجبًا منزليًا بسيطًا يدعم ما تم في اليوم.

أرجع **JSON واحد فقط** بالشكل التالي حرفيًا:
{
  "meta": {
    "subject": "...",
    "grade": "...",
    "count": ${count},
    "lessons": [ ${lessons.map((l) => `"${l}"`).join(", ")} ]
  },
  "canon": [
    { "lesson": "اسم الدرس 1", "objectives": ["..."], "vocab": ["..."] },
    { "lesson": "اسم الدرس 2", "objectives": ["..."], "vocab": ["..."] }
  ],
  "days": [
    {
      "day_index": 0,
      "lesson": "اسم أحد الدروس حرفيًا من القائمة",
      "goals": ["هدف 1", "هدف 2"],
      "vocab": ["مفردة 1", "مفردة 2"],
      "outcomes": "نتيجة تعلم متوقعة مختصرة.",
      "homework": "واجب منزلي بسيط."
    },
    {
      "day_index": 1,
      "lesson": "...",
      "goals": [...],
      "vocab": [...],
      "outcomes": "...",
      "homework": "..."
    },
    {
      "day_index": 2,
      "lesson": "...",
      "goals": [...],
      "vocab": [...],
      "outcomes": "...",
      "homework": "..."
    },
    {
      "day_index": 3,
      "lesson": "...",
      "goals": [...],
      "vocab": [...],
      "outcomes": "...",
      "homework": "..."
    },
    {
      "day_index": 4,
      "lesson": "...",
      "goals": [...],
      "vocab": [...],
      "outcomes": "...",
      "homework": "..."
    }
  ]
}

- لا تضف أي نص خارج هذا الكائن JSON.
`.trim();

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
      void logUsage(user, meta, false);
      return { statusCode: 502, headers: CORS, body: "Empty response" };
    }

    raw = raw.replace(/```json|```/g, "").trim();

    let j;
    try {
      j = JSON.parse(raw);
    } catch (e) {
      void logUsage(user, meta, false);
      return {
        statusCode: 502,
        headers: CORS,
        body: "Bad JSON from model",
      };
    }

    // ===== Post-processing صارم =====
    const canonIn = Array.isArray(j?.canon) ? j.canon : [];
    const canon = canonIn.map((c, idx) => {
      const name =
        String(c?.lesson || c?.lessonTitle || lessons[idx] || lessons[0]).trim();
      return {
        lesson: name,
        objectives: uniq(c?.objectives).slice(0, 5),
        vocab: uniq(c?.vocab).slice(0, 8),
      };
    });

    // map lesson name -> canon
    const byLesson = {};
    canon.forEach((c) => {
      const key = c.lesson.toLowerCase();
      byLesson[key] = c;
    });

    let days = Array.isArray(j?.days) ? j.days : [];
    if (days.length < 5) {
      while (days.length < 5) days.push({});
    } else if (days.length > 5) {
      days = days.slice(0, 5);
    }

    const safeDays = days.map((d, i) => {
      // حدد اسم الدرس لهذا اليوم
      let lessonName = String(d.lesson || "").trim();
      let normalized = lessonName.toLowerCase();

      if (!lessonName || !byLesson[normalized]) {
        // حاول المطابقة مع قائمة الدروس المدخلة
        const fromIdx = Number.isFinite(d.lesson_index)
          ? Number(d.lesson_index)
          : -1;

        if (fromIdx >= 0 && fromIdx < lessons.length) {
          lessonName = lessons[fromIdx];
        } else {
          // توزيع بسيط حسب اليوم
          const idx = Math.min(i, lessons.length - 1);
          lessonName = lessons[idx];
        }
        normalized = lessonName.toLowerCase();
      }

      const canonForLesson = byLesson[normalized] || canon[0] || {
        objectives: [],
        vocab: [],
      };

      const goals = uniq(Array.isArray(d.goals) ? d.goals : []).slice(0, 2);
      const vocabRaw = uniq(Array.isArray(d.vocab) ? d.vocab : []).slice(0, 5);
      const vocab = vocabRaw.filter((v) =>
        canonForLesson.vocab.includes(v)
      ); // subset فقط

      const outcomes = String(d.outcomes || "").trim();
      const homework = String(d.homework || "").trim();

      return {
        day_index: i,
        lesson: lessonName,
        goals,
        vocab,
        outcomes,
        homework,
      };
    });

    const payload = {
      meta: {
        subject: j?.meta?.subject || subject,
        grade: j?.meta?.grade || grade || "غير محدد",
        count: Number(j?.meta?.count) || count,
        lessons: Array.isArray(j?.meta?.lessons) && j.meta.lessons.length
          ? j.meta.lessons
          : lessons,
      },
      canon,
      days: safeDays,
    };

    void logUsage(user, payload.meta, true);

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
