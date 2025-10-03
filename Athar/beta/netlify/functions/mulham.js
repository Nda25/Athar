// مُلهم: توليد أنشطة (حركي/جماعي/فردي) + وصف مختصر + خطوات + تذكرة خروج + الأثر المتوقع
// يدعم: بدون أدوات (zero-prep) + تكييف منخفض التحفيز + فروق فردية + بدائل (variant)
// + حارس اشتراك (active) من Supabase — الحماية كما هي، مع تحسينات في الصرامة والمخرجات

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createClient } = require("@supabase/supabase-js");
const { requireUser } = require("./_auth.js");

// ===== Supabase client (Service Role) =====
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

// ===== فحص حالة العضوية (يفضّل v_user_status ثم memberships) =====
async function isActiveMembership(user_sub, email) {
  try {
    const { data, error } = await supabase
      .from("v_user_status")
      .select("active")
      .or(`user_sub.eq.${user_sub},email.eq.${(email||"").toLowerCase()}`)
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
    else if (email) q = q.eq("email", (email||"").toLowerCase());
    else return false;

    const { data: rows } = await q;
    const row = rows?.[0];
    const exp = row?.end_at || row?.expires_at;
    return exp ? new Date(exp) > new Date() : false;
  } catch (_) {
    return false;
  }
}

// ===== Hash بسيط لإنتاج فهرس ثابت (لتنويع الاختيار من الأنشطة) =====
function hashInt(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return Math.abs(h >>> 0);
}

// ===== CORS مبسّط لطلبات POST =====
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: CORS_HEADERS, body: "" };
    }
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: CORS_HEADERS, body: "Method Not Allowed" };
    }

    // 0) التحقق من المستخدم (JWT من Auth0)
    const gate = await requireUser(event);
    if (!gate.ok) return { statusCode: gate.status, headers: CORS_HEADERS, body: gate.error };

    // 0.1) قفل حسب الاشتراك (لا توليد إن لم يكن Active)
    const ok = await isActiveMembership(gate.user?.sub, gate.user?.email);
    if (!ok) {
      return {
        statusCode: 402,
        headers: CORS_HEADERS,
        body: "Membership is not active (trial expired or not activated)."
      };
    }

    // 1) مفاتيح البيئة (Gemini)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is missing");
      return { statusCode: 500, headers: CORS_HEADERS, body: "Missing GEMINI_API_KEY" };
    }

    // 2) جسم الطلب
    let payload = {};
    try { payload = JSON.parse(event.body || "{}"); }
    catch { return { statusCode: 400, headers: CORS_HEADERS, body: "Bad JSON body" }; }

    const {
      subject = "",
      topic   = "",
      time    = 20,
      bloom   = "understand",
      age     = "p2",
      noTools = false,
      adaptLow  = false,
      adaptDiff = false,
      variant = ""
    } = payload;

    // تحقق خفيف
    const TIME = Math.min(60, Math.max(5, Number(time)||20));
    const SUBJ = String(subject||"").slice(0,120);
    const TOP  = String(topic||SUBJ||"").slice(0,160);

    const AGE_LABEL = { p1:"ابتدائي دُنيا", p2:"ابتدائي عُليا", m:"متوسط", h:"ثانوي" };
    const ageLabel = AGE_LABEL[age] || "ابتدائي عُليا";

    // 3) برومبت صارم (رؤية 2030 + مهارات القرن 21 + مناهج 2025)
    const constraints = [];
    if (noTools) constraints.push("يجب أن تكون كل الأنشطة Zero-prep (بدون قص/لصق/بطاقات/أدوات).");
    constraints.push(`الزمن المتاح إجماليًا ~ ${TIME} دقيقة؛ اجعل كل نشاط قابلاً للتنفيذ داخل هذا السقف.`);
    constraints.push(`مستوى بلوم المستهدف: ${bloom}. المرحلة الدراسية: ${ageLabel}.`);
    constraints.push("استخدم لغة عربية سليمة وعبارات قصيرة مناسبة تمامًا للفئة العمرية.");
    constraints.push("راعِ السلامة والأمان وعدم الحاجة لأدوات خطرة.");
    constraints.push("أدرج خطوات عملية واضحة، ومعايير نجاح ضمنية في كل نشاط، وأسئلة قصيرة صحيحة لغويًا في تذكرة الخروج.");
    constraints.push("نوّع بين التفاعل الحركي/التعاوني/الفردي دون تكرار الفكرة.");
    constraints.push("اربط المعنى بسياقات من واقع الطالب في السعودية وبما ينسجم مع مهارات القرن 21 ورؤية 2030.");

    const adaptations = [];
    if (adaptLow)  adaptations.push("تكيف منخفض التحفيز: مهام قصيرة جدًا، تعزيز فوري، خيارات بسيطة، فواصل حركة.");
    if (adaptDiff) adaptations.push("فروق فردية: مستويات أداء (سهل/متوسط/متقدم) أو منتجات بديلة.");

    const seedNote = `بذرة التنويع: ${variant || "base"}`;

    const prompt = `
أنت مصمم تعلمي خبير في الأنشطة الصفّية القصيرة المبتكرة.
أنتج حزمة أنشطة ضمن ثلاث فئات:
1) أنشطة صفّية حركية، 2) أنشطة صفّية جماعية، 3) أنشطة صفّية فردية.
لكل فئة قدّم **٢ إلى ٣** أنشطة قوية ومختلفة.
المجال: "${SUBJ}"، الموضوع: "${TOP}".

${constraints.map(s => "- " + s).join("\n")}
${adaptations.length ? "\nالتكييفات المطلوبة:\n" + adaptations.map(s=>"- "+s).join("\n") : ""}

${seedNote}

أجب **فقط** بصيغة JSON مطابقة تمامًا للمخطط التالي:
{
  "meta": { "subject": "...", "topic": "...", "time": 20, "bloom": "...", "age": "...", "variant": "..." },
  "categories": [
    { "name": "أنشطة صفّية حركية",
      "activities": [
        {
          "title": "...",
          "summary": "سبب تربوي موجز وقيمة تعليمية",
          "duration": 8,
          "materials": ["(إن لزم)"],
          "steps": ["خطوة دقيقة 1", "خطوة دقيقة 2", "خطوة دقيقة 3"],
          "exit": "سؤال/مهمة خروج دقيقة واحدة بصياغة عربية سليمة",
          "impact": "أثر متوقّع مرتبط بالهدف والمهارة",
          "zeroPrep": true,
          "lowMotivation": "تكييف للتحفيز المنخفض (إن طُلب)",
          "differentiation": "فكرة مستويات أو بدائل (إن طُلب)",
          "notes": "ملاحظة صفية سريعة"
        }
      ]
    },
    { "name": "أنشطة صفّية جماعية", "activities": [...] },
    { "name": "أنشطة صفّية فردية", "activities": [...] }
  ],
  "tips": ["تلميح عملي قصير", "تلميح آخر"]
}
بدون أي نص خارج JSON.
`.trim();

    // 4) Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-flash-flash" });

    const req = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        candidateCount: 1,
        maxOutputTokens: 2048,
        temperature: 0.85,
        topK: 64,
        topP: 0.9
      }
    };

    const result = await model.generateContent(req);

    // 5) JSON parsing
    const text =
      (typeof result?.response?.text === "function" ? result.response.text() : "") ||
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "";

    if (!text) {
      console.error("Empty response from model", result);
      return { statusCode: 502, headers: CORS_HEADERS, body: "Empty response from model" };
    }

    let data;
    try { data = JSON.parse(text); }
    catch {
      const cleaned = text.replace(/```json|```/g, "").trim();
      try { data = JSON.parse(cleaned); }
      catch (e) {
        console.error("Model returned non-JSON:", cleaned.slice(0, 400));
        return { statusCode: 500, headers: CORS_HEADERS, body: "Model returned non-JSON response" };
      }
    }

    if (!data || !Array.isArray(data.categories)) {
      console.error("Invalid JSON shape", data);
      return { statusCode: 500, headers: CORS_HEADERS, body: "Invalid JSON shape" };
    }

    // ===== اختيار نشاط مختلف لكل فئة بناء على hash من المعطيات =====
    function normalizeActivity(a = {}) {
      const dur = typeof a.duration === "number" && a.duration > 0
        ? a.duration
        : Math.max(5, Math.min(20, Math.round(TIME / 2)));

      const arr = (x) => Array.isArray(x) ? x.filter(Boolean).slice(0,10) : [];
      const txt = (x) => (typeof x === "string" ? x.trim() : "") || "";

      return {
        ideaHook:        txt(a.ideaHook || a.title),
        desc:            txt(a.summary  || a.description),
        duration:        dur,
        materials:       arr(a.materials),
        steps:           arr(a.steps),
        exitTicket:      txt(a.exit  || a.exitTicket),
        expectedImpact:  txt(a.impact || a.expectedImpact),
        diff: {
          lowMotivation:   txt(a.lowMotivation || a.diff_low),
          differentiation: txt(a.differentiation || a.diff_levels)
        }
      };
    }

    const seedStr = `${variant}|${TOP}|${age}|${bloom}|${TIME}`;
    const idxSeed = hashInt(seedStr);

    function pickActivity(cat) {
      const acts = Array.isArray(cat?.activities) ? cat.activities : [];
      if (acts.length === 0) return {};
      const idx = idxSeed % acts.length;
      return normalizeActivity(acts[idx]);
    }

    const sets = { movement:{}, group:{}, individual:{} };

    for (const cat of (data.categories || [])) {
      const name = (cat.name || "").toLowerCase();
      if (name.includes("حرك")) {
        sets.movement = pickActivity(cat);
      } else if (name.includes("جمع")) {
        sets.group = pickActivity(cat);
      } else if (name.includes("فرد")) {
        sets.individual = pickActivity(cat);
      }
    }

    const cats = data.categories || [];
    if (!sets.movement.ideaHook && cats[0]) sets.movement  = pickActivity(cats[0]);
    if (!sets.group.ideaHook     && cats[1]) sets.group     = pickActivity(cats[1]);
    if (!sets.individual.ideaHook&& cats[2]) sets.individual= pickActivity(cats[2]);

    const tips = Array.isArray(data.tips) ? data.tips.filter(Boolean).slice(0,10) : [];

    const meta = {
      subject: SUBJ,
      topic:   TOP,
      time: TIME, bloom, age, variant: variant || "",
      adaptLow, adaptDiff
    };

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ meta, sets, tips })
    };

  } catch (err) {
    console.error("Mulham error:", err);
    const msg = (err && err.stack) ? err.stack : (err?.message || String(err));
    return { statusCode: 500, headers: CORS_HEADERS, body: `Mulham function failed: ${msg}` };
  }
};
