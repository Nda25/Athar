// netlify/functions/mulham.js
// ================================================================
// مُلهم: أنشطة قصيرة (حركي/جماعي/فردي) + وصف + خطوات + تذكرة خروج + أثر
// - حماية Auth0 (requireUser)
// - فحص عضوية Supabase
// - Gemini عبر REST مع responseSchema + محاولات + إصلاح ذاتي
// - فلترة صارمة للملاءمة العمرية + منع التكرار
// - إخراج: { meta, sets:{movement,group,individual}, tips }
// ================================================================

const { createClient } = require("@supabase/supabase-js");
const { requireUser }  = require("./_auth.js");

// ===== Supabase (Service Role) =====
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

// ===== الاشتراك نشط؟ (v_user_status -> memberships) =====
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
  } catch (_) { return false; }
}

// ===== Helpers =====
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const stripFences = (s="") =>
  String(s).replace(/^\s*```json/i,"").replace(/^\s*```/i,"").replace(/```$/,"").trim();

function hashInt(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return Math.abs(h >>> 0);
}

const AGE_LABEL = { p1:"ابتدائي دُنيا", p2:"ابتدائي عُليا", m:"متوسط", h:"ثانوي" };

// ===== قواعد الملاءمة العمرية =====
const AGE_RULES = {
  p1: {
    banned: [
      "نقاش فلسفي","برهان رياضي معقّد","تجارب كيميائية خطرة","مواد حارقة","لهب","كحول",
      "نقاش سياسي","محتوى عنيف","قفز عشوائي طويل","عدو مستمر","مسرحية طويلة"
    ],
    prefer: ["قصة قصيرة","بطاقات مصوّرة","حركة بسيطة آمنة","تصنيف/مطابقة","لعب أدوار مبسّط","تلوين/طي ورق"]
  },
  p2: {
    banned: [
      "مبرهنة معقّدة","تجارب خطرة","مواد حارقة","لهب","كحول",
      "نقاش فلسفي عميق","قفز عشوائي طويل","سباقات عالية الشدة","إرهاق بدني"
    ],
    prefer: ["مشاهدة/استكشاف قصير","تمثيل مبسّط","لوحات لاصقة","خريطة مفاهيم سهلة","قياس بسيط آمن"]
  },
  m: {
    banned: [
      "مواد خطرة","لهب","كحول","مفرقعات","محتوى غير لائق",
      "رقص جماعي","مطاردة","ركض عشوائي","قفز عشوائي"
    ],
    prefer: ["تجربة آمنة صغيرة","محاكاة","تحقيق مصغّر","نقاش موجّه بأسئلة محددة","تفكير نقدي بمحددات"]
  },
  h: {
    banned: [
      "رقص","مطاردة","ركض عشوائي","قفز عشوائي","ألعاب طفولية بحتة",
      "مواد خطرة","لهب","أحماض مركّزة","محتوى غير لائق"
    ],
    prefer: ["تحليل حالة","محاكاة علمية","عرض قصير مبني بيانات","تجربة آمنة منخفضة المخاطر","ورقة عمل تطبيقية"]
  }
};

function textContainsAny(text, arr){
  const t = (text||"").toLowerCase();
  return arr.some(w => t.includes(w.toLowerCase()));
}

// ===== Normalizers =====
function arr(x){ return Array.isArray(x) ? x.filter(Boolean).slice(0,10) : []; }
function txt(x){ return (typeof x === "string" ? x.trim() : "") || ""; }

function normalizeActivity(a = {}, TIME = 20) {
  const dur = typeof a.duration === "number" && a.duration > 0
    ? Math.round(a.duration)
    : Math.max(5, Math.min(20, Math.round(TIME/2)));
  return {
    ideaHook:        txt(a.title || a.ideaHook),
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

// مناسب للعمر؟
function isAgeSuitable(age, act){
  const rules = AGE_RULES[age] || AGE_RULES.h;
  const hay = [
    act.title, act.summary, act.description, act.notes,
    ...(Array.isArray(act.steps) ? act.steps : []),
    ...(Array.isArray(act.materials) ? act.materials : [])
  ].filter(Boolean).join(" | ");
  if (textContainsAny(hay, rules.banned)) return false;
  return true; // نسمح؛ المفضلات تُوجّه البرومبت، لكن لا نُلزم
}

// منع التكرار عبر (title+steps)
function dedupKey(act){
  const title = String(act.title||"").trim();
  const firstStep = Array.isArray(act.steps)&&act.steps[0]? String(act.steps[0]).trim() : "";
  return (title + "|" + firstStep).toLowerCase();
}

// ===== Schema (يوجّه Gemini) =====
const responseSchema = {
  type: "OBJECT",
  required: ["meta","categories","tips"],
  properties: {
    meta: {
      type: "OBJECT",
      properties: {
        subject: { type:"STRING" },
        topic:   { type:"STRING" },
        time:    { type:"NUMBER" },
        bloom:   { type:"STRING" },
        age:     { type:"STRING" },
        variant: { type:"STRING" }
      }
    },
    categories: {
      type: "ARRAY",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "OBJECT",
        required: ["name","activities"],
        properties: {
          name: { type:"STRING" }, // "أنشطة صفّية حركية" / "جماعية" / "فردية"
          activities: {
            type:"ARRAY",
            minItems: 2,
            maxItems: 3,
            items: {
              type: "OBJECT",
              required: ["title","summary","duration","steps","exit","impact"],
              properties: {
                title:   { type:"STRING" },
                summary: { type:"STRING" },
                duration:{ type:"NUMBER" },
                materials:{ type:"ARRAY", items:{ type:"STRING" } },
                steps:   { type:"ARRAY", items:{ type:"STRING" } },
                exit:    { type:"STRING" },
                impact:  { type:"STRING" },
                zeroPrep:{ type:"BOOLEAN" },
                lowMotivation:{ type:"STRING" },
                differentiation:{ type:"STRING" },
                notes:   { type:"STRING" }
              }
            }
          }
        }
      }
    },
    tips: { type:"ARRAY", items:{ type:"STRING" }, minItems:1, maxItems:10 }
  }
};

// ===== Gemini REST caller =====
async function callGeminiOnce({ apiKey, model, TIMEOUT_MS, prompt }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("timeout")), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema,
          candidateCount: 1,
          maxOutputTokens: 2048,
          temperature: 0.8,
          topK: 64,
          topP: 0.9
        }
      }),
      signal: controller.signal
    });

    const txt = await res.text();
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status; err.body = txt.slice(0,800);
      throw err;
    }

    let outer;
    try { outer = JSON.parse(txt); }
    catch { return { ok:false, rawText: txt, data: null }; }

    const raw = stripFences(outer?.candidates?.[0]?.content?.parts?.[0]?.text ?? "");
    let data;
    try { data = JSON.parse(raw); }
    catch { return { ok:false, rawText: raw, data: null }; }

    if (!data || !Array.isArray(data.categories)) {
      return { ok:false, rawText: raw, data: null };
    }
    return { ok:true, rawText: raw, data };
  } finally {
    clearTimeout(timer);
  }
}

exports.handler = async (event) => {
  try {
    // CORS
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: CORS_HEADERS, body: "" };
    }
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: CORS_HEADERS, body: "Method Not Allowed" };
    }

    // حماية المستخدم
    const gate = await requireUser(event);
    if (!gate.ok) return { statusCode: gate.status, headers: CORS_HEADERS, body: gate.error };

    // اشتراك نشط؟
    const ok = await isActiveMembership(gate.user?.sub, gate.user?.email);
    if (!ok) {
      return {
        statusCode: 402,
        headers: CORS_HEADERS,
        body: "Membership is not active (trial expired or not activated)."
      };
    }

    // إعدادات
    const API_KEY     = process.env.GEMINI_API_KEY;
    if (!API_KEY) return { statusCode: 500, headers: CORS_HEADERS, body: "Missing GEMINI_API_KEY" };

    const PRIMARY     = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    const FALLBACKS   = (process.env.GEMINI_FALLBACKS || "gemini-1.5-flash-8b,gemini-1.5-flash-latest,gemini-1.5-pro")
                          .split(",").map(s=>s.trim()).filter(Boolean);
    const MODELS      = [PRIMARY, ...FALLBACKS];

    const TIMEOUT_MS  = +(process.env.TIMEOUT_MS || 23000);
    const MAX_RETRIES = +(process.env.RETRIES || 2);
    const BACKOFF_MS  = +(process.env.BACKOFF_MS || 700);

    // طلب
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

    const TIME = Math.min(60, Math.max(5, Number(time)||20));
    const SUBJ = String(subject||"").slice(0,120);
    const TOP  = String(topic||SUBJ||"").slice(0,160);
    const ageLabel = AGE_LABEL[age] || "ابتدائي عُليا";

    // قيود للبرومبت (تتضمن منع أنشطة غير مناسبة حسب العمر)
    const constraints = [];
    if (noTools) constraints.push("جميع الأنشطة Zero-prep (بدون قص/لصق/بطاقات/أدوات).");
    constraints.push(`الزمن الإجمالي ~ ${TIME} دقيقة؛ كل نشاط ضمن السقف.`);
    constraints.push(`بلوم: ${bloom}. المرحلة: ${ageLabel}. لغة عربية سليمة وجُمَل قصيرة.`);
    constraints.push("سلامة وأمان — لا مواد خطرة/لهب/أحماض/محتوى غير لائق.");
    constraints.push("الخطوات إجراءات تنفيذية مباشرة (لا 'ناقشوا/تخيلوا/فكّروا' كتعليمات).");
    constraints.push("تنويع بين (حركي/تعاوني/فردي) دون تكرار الفكرة.");
    constraints.push("سياقات من واقع الطالب في السعودية + مهارات القرن 21 + رؤية 2030.");

    const rules = AGE_RULES[age] || AGE_RULES.h;
    const bannedHint = rules.banned.length ? `تجنّب تمامًا العناصر التالية: ${rules.banned.join("، ")}.` : "";
    const preferHint = rules.prefer.length ? `يفضّل أن تتجه الأنشطة ناحية: ${rules.prefer.join("، ")}.` : "";

    const adaptations = [];
    if (adaptLow)  adaptations.push("تكيف منخفض التحفيز: مهام قصيرة جدًا، تعزيز فوري، فواصل حركة اختيارية.");
    if (adaptDiff) adaptations.push("فروق فردية: مستويات أداء (سهل/متوسط/متقدم) أو منتجات بديلة.");

    const seedNote = `بذرة التنويع: ${variant || "base"}`;

    const prompt = `
أنت مصمم تعلّم خبير في الأنشطة الصفّية القصيرة المبتكرة.
انتج حزمة أنشطة ضمن ثلاث فئات ثابتة:
1) أنشطة صفّية حركية، 2) أنشطة صفّية جماعية، 3) أنشطة صفّية فردية.
لكل فئة قدّم **٢ إلى ٣** أنشطة قوية ومختلفة.
المجال: "${SUBJ}"، الموضوع: "${TOP}".

${constraints.map(s => "- " + s).join("\n")}
- ${bannedHint}
- ${preferHint}
${adaptations.length ? "\nالتكييفات المطلوبة:\n" + adaptations.map(s=>"- "+s).join("\n") : ""}

${seedNote}

أجب **فقط** بصيغة JSON المطابقة للمخطط (schema) المرفق، وامنع العبارات المفتوحة داخل "steps" — اجعلها **إجراءات تنفيذية مباشرة**.
`.trim();

    // محاولات: موديلات × محاولات مع إصلاح ذاتي
    let final = null;
    let finalRaw = "";
    let usedModel = "";

    function repairPrompt(prevRaw) {
      return `${prompt}

الرد السابق كان ناقصًا/غير صالح أو احتوى عناصر غير مناسبة للعمر. هذا هو النص:
<<<
${prevRaw}
<<<
أعيد الآن **JSON واحدًا مطابقًا للمخطط** (meta + categories + tips) بلا أي نص خارج JSON، مع الالتزام التام بالملاءمة العمرية ومنع التكرار.`;
    }

    for (const model of MODELS) {
      let currentPrompt = prompt;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const resp = await callGeminiOnce({
            apiKey: API_KEY,
            model,
            TIMEOUT_MS,
            prompt: currentPrompt
          });
          finalRaw = resp.rawText || finalRaw;

          if (resp.ok && resp.data && Array.isArray(resp.data.categories)) {
            final = resp.data; usedModel = model; break;
          }

          // إصلاح
          currentPrompt = repairPrompt(resp.rawText || "");
          await sleep(BACKOFF_MS * (attempt + 1));
        } catch (err) {
          const status = err.status || 0;
          const isTimeout = /timeout|AbortError/i.test(String(err?.message));
          const retriable = isTimeout || [429,500,502,503,504].includes(status);
          if (retriable && attempt < MAX_RETRIES) {
            await sleep(BACKOFF_MS * (attempt + 1));
            continue;
          }
          break; // بدّل موديل
        }
      }
      if (final) break;
    }

    if (!final) {
      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, "Content-Type":"application/json; charset=utf-8" },
        body: JSON.stringify({
          debug: "incomplete",
          parsed: null,
          rawText: finalRaw || "",
          message: "Model returned incomplete JSON after retries"
        })
      };
    }

    // ==== بناء sets مع منع التكرار والفلترة العمرية ====
    const seedStr = `${variant}|${TOP}|${age}|${bloom}|${TIME}`;
    const idxSeed = hashInt(seedStr);

    function pickFirstSuitable(cat, usedKeys) {
      const acts = Array.isArray(cat?.activities) ? cat.activities : [];
      for (let i = 0; i < acts.length; i++) {
        const act = acts[i];
        const key = dedupKey(act);
        if (usedKeys.has(key)) continue;
        if (!isAgeSuitable(age, act)) continue;
        usedKeys.add(key);
        return normalizeActivity(act, TIME);
      }
      return {}; // لا مناسب
    }

    const used = new Set();
    const sets = { movement:{}, group:{}, individual:{} };

    const cats = Array.isArray(final.categories) ? final.categories : [];
    // محاولة بحسب أسماء الفئات
    for (const cat of cats) {
      const name = (cat.name || "").toLowerCase();
      if (name.includes("حرك")) {
        sets.movement = pickFirstSuitable(cat, used);
      } else if (name.includes("جمع")) {
        sets.group = pickFirstSuitable(cat, used);
      } else if (name.includes("فرد")) {
        sets.individual = pickFirstSuitable(cat, used);
      }
    }
    // تعبئة النواقص من بقية القوائم
    for (const fillKey of ["movement","group","individual"]) {
      if (sets[fillKey]?.ideaHook) continue;
      for (const cat of cats) {
        const cand = pickFirstSuitable(cat, used);
        if (cand && cand.ideaHook) { sets[fillKey] = cand; break; }
      }
    }

    // لو بقيت خانة فارغة تمامًا، نضع نشاطًا آمنًا افتراضيًا مناسبًا للعمر
    function safeFallback(title, desc){
      return {
        ideaHook: title,
        desc,
        duration: Math.max(5, Math.min(20, Math.round(TIME/2))),
        materials: [],
        steps: ["قدّم التوجيه الافتتاحي في دقيقة","نفّذ المهمة المباشرة بخطوتين","ختم سريع وملاحظة تقويمية"],
        exitTicket: "اكتب جملة تُلخّص فكرة النشاط (30–60 ثانية).",
        expectedImpact: "رفع المشاركة وتحقيق هدف الدرس بصورة عملية.",
        diff: { lowMotivation:"جُمل أقصر وخيار بديل بسيط.", differentiation:"مستويات أداء (سهل/متوسط/متقدم)." }
      };
    }

    if (!sets.movement?.ideaHook) {
      sets.movement = safeFallback(
        age === "h" ? "تحليل صورة/رسم بياني واقف (وقفة معرض)" : "جولة ملصقات هادئة",
        "نشاط واقف بسيط وآمن، ملائم للعمر، يضمن حركة خفيفة بلا مطاردة/قفز."
      );
    }
    if (!sets.group?.ideaHook) {
      sets.group = safeFallback(
        "لغز جماعي قصير بالبطاقات",
        "تعاون موجّه بخطوات واضحة ونتاج ملموس."
      );
    }
    if (!sets.individual?.ideaHook) {
      sets.individual = safeFallback(
        "ورقة تطبيق مصغّرة",
        "إنجاز فردي سريع يقيس الفهم بوضوح."
      );
    }

    const tips = Array.isArray(final.tips) ? final.tips.filter(Boolean).slice(0,10) : [];

    const meta = {
      subject: SUBJ,
      topic:   TOP,
      time:    TIME,
      bloom,
      age,
      variant: variant || "",
      adaptLow, adaptDiff,
      _model: usedModel
    };

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type":"application/json; charset=utf-8" },
      body: JSON.stringify({ meta, sets, tips })
    };

  } catch (err) {
    console.error("Mulham error:", err);
    const msg = (err && err.stack) ? err.stack : (err?.message || String(err));
    return { statusCode: 500, headers: CORS_HEADERS, body: `Mulham function failed: ${msg}` };
  }
};
