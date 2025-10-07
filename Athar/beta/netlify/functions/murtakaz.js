// netlify/functions/murtakaz.js
// مرتكز — توليد مخطط درس مختصر (موضوع/نص) مع حماية كاملة + تتبّع
// نسخة متوافقة مع mulham/strategy: CORS مرن + فواصل أمان + فfallbacks + إصلاح ذاتي

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createClient } = require("@supabase/supabase-js");
const { requireUser } = require("./_auth.js");

/* ====== CORS (مرن) ====== */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/* ====== Supabase ====== */
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

/* ====== أدوات عامة ====== */
function safeJson(str, fallback = null) {
  try { return JSON.parse(str || "null") ?? fallback; } catch { return fallback; }
}
const cut = (s, n) => (s || "").slice(0, n);
const AGE_LABEL = { p1: "ابتدائي دُنيا", p2: "ابتدائي عُليا", m: "متوسط", h: "ثانوي" };
const dhow = (v) => (v == null ? "—" : String(v));
const stripFences = (s = "") =>
  String(s).replace(/^\s*```json\b/i, "").replace(/^\s*```/i, "").replace(/```$/i, "").trim();

/* ====== إعدادات Gemini / موديلات آمنة + محاولات ====== */
const SAFE_MODELS = new Set([
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
]);

function pickModelList() {
  const primary = (process.env.GEMINI_MODEL || "gemini-1.5-flash").trim();
  const fallbacks = (process.env.GEMINI_FALLBACKS || "gemini-1.5-pro,gemini-1.5-flash-8b")
    .split(",").map(s => s.trim()).filter(Boolean);
  const all = [primary, ...fallbacks].filter(m => SAFE_MODELS.has(m));
  return all.length ? all : ["gemini-1.5-flash", "gemini-1.5-pro"];
}
const MODELS = pickModelList();

const TIMEOUT_MS  = +(process.env.TIMEOUT_MS || 23000);
const MAX_RETRIES = +(process.env.RETRIES || 2);
const BACKOFF_MS  = +(process.env.BACKOFF_MS || 700);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ====== Call Gemini (مرة واحدة) ====== */
async function callGeminiOnce(model, apiKey, promptText){
  const genAI = new GoogleGenerativeAI(apiKey);
  const m = genAI.getGenerativeModel({ model });

  // مهلة منطقية
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(new Error("timeout")), TIMEOUT_MS);

  try {
    const res = await m.generateContent({
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      generationConfig: {
        responseMimeType: "application/json",
        candidateCount: 1,
        maxOutputTokens: 2048,
        temperature: 0.6,
      },
    });

    const raw =
      (typeof res?.response?.text === "function" ? res.response.text() : "") ||
      res?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "";

    if (!raw) return { ok:false, rawText:"", data:null };

    const txt = stripFences(raw);
    try {
      const data = JSON.parse(txt);
      return { ok:true, rawText: txt, data };
    } catch {
      const m = txt.match(/\{[\s\S]*\}$/m) || txt.match(/\{[\s\S]*\}/m);
      if (m) {
        try { return { ok:true, rawText: m[0], data: JSON.parse(m[0]) }; }
        catch { /* ignore */ }
      }
      return { ok:false, rawText: txt, data:null };
    }
  } finally {
    clearTimeout(t);
  }
}

/* ====== Prompt ====== */
function buildPrompt(S, pre, during, post, ageLabelStr){
  return `
أنت مخطط دروس ذكي بالعربية لمدارس السعودية (مناهج 2025+).
- أخرج **JSON واحد فقط** (لا نص خارجه).
- ناسِب الأهداف والأنشطة والتقويم مع Bloom الأساسي: "${dhow(S.bloomMain)}" (+ "${dhow(S.bloomSupport)}" إن وجد).
- الأنشطة عملية قابلة للتنفيذ خلال ${S.duration} دقيقة، منظمة "قبل/أثناء/بعد" بمدد: ${pre}/${during}/${post}.
- المخرجات قصيرة وواضحة ومناسبة لعمر "${ageLabelStr}" وبيئة الصف السعودي.
- إن وُضع mode="text" فاستخرج موضوعًا مناسبًا من النص ووافق الأهداف معه.
- لو "variant" موجود نوّع جذريًا في العنوان والتنظيم.

أجب بهذا القالب حصراً:
{
  "meta": {
    "topic": "عنوان مختصر مبتكر ومحدد",
    "age": "${dhow(S.age)}",
    "ageLabel": "${ageLabelStr}",
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
}

/* ====== HANDLER ====== */
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
      return { statusCode: 402, headers: CORS, body: "Membership is not active (trial expired or not activated)." };
    }

    // مفاتيح البيئة
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) return { statusCode: 500, headers: CORS, body: "Missing GEMINI_API_KEY" };

    // المدخلات
    const {
      mode, subject, topic, sourceText, age, duration,
      bloomMain, bloomSupport, goalCount, notes, level, adapt, variant
    } = safeJson(event.body, {}) || {};

    const S = {
      mode: (mode || "topic"),
      subject: cut(subject || "—", 100),
      topic: cut(topic || "—", 140),
      sourceText: cut(sourceText || "", +(process.env.MAX_TEXT_CHARS || 1200)),
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

    const pre = Math.min(10, Math.max(3, Math.round(S.duration * 0.20)));
    const during = Math.max(15, Math.round(S.duration * 0.55));
    const post = Math.max(5, Math.round(S.duration * 0.25));
    const ageLabelStr = AGE_LABEL[S.age] || S.age || "—";

    const prompt = buildPrompt(S, pre, during, post, ageLabelStr);

    // حلقات: موديلات × محاولات (مع إصلاح ذاتي)
    let final = null, finalRaw = "", usedModel = "";
    for (const model of MODELS) {
      let p = prompt;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const resp = await callGeminiOnce(model, API_KEY, p);
          finalRaw = resp.rawText || finalRaw;

          if (resp.ok && resp.data) { final = resp.data; usedModel = model; break; }

          // إصلاح: أرسل النص السابق واطلب إعادة بصيغة JSON الصحيحة
          p = `${prompt}

الاستجابة السابقة غير صالحة/ناقصة. هذا نصّك:
<<<
${(resp.rawText || "").slice(0, 4000)}
<<<
أعيدي الإرسال الآن كـ **JSON واحد صالح** يطابق القالب أعلاه فقط.`;
          await sleep(BACKOFF_MS * (attempt + 1));
        } catch (e) {
          const msg = String(e?.message || e);
          const retriable = /timeout|429|500|502|503|504/i.test(msg);
          if (retriable && attempt < MAX_RETRIES) {
            await sleep(BACKOFF_MS * (attempt + 1));
            continue;
          }
          // أخطاء غير قابلة للاسترجاع (مثل 401/403/404 لموديل خاطئ) — انتقل لموديل آخر
          break;
        }
      }
      if (final) break;
    }

    if (!final) {
      // نُرجع debug ودّيًا (الواجهة تعرضه كتحذير)
      return {
        statusCode: 200,
        headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          debug: "incomplete",
          rawText: finalRaw || "",
          message: "Model returned incomplete JSON after retries"
        })
      };
    }

    // تهيئة المخرجات للواجهة
    const sa = (a) => Array.isArray(a) ? a.filter(Boolean) : [];
    const body = {
      meta: final.meta || {
        topic: S.topic || "—",
        age: S.age || "",
        ageLabel: ageLabelStr,
        mainBloomLabel: S.bloomMain || "",
        supportBloomLabel: S.bloomSupport || ""
      },
      goals: sa(final.goals),
      success: final.success || "",
      structure: sa(final.structure),
      activities: sa(final.activities),
      assessment: sa(final.assessment),
      diff: sa(final.diff),
      oneMin: final.oneMin || "",
      _meta: { model: usedModel }
    };

    // تتبّع
    const ua = event.headers["user-agent"] || null;
    const ref = event.headers["referer"] || event.headers["referrer"] || null;
    const ip =
      event.headers["x-nf-client-connection-ip"] ||
      (event.headers["x-forwarded-for"]?.split(",")[0] || null);
    supaLogToolUsage(gate.user, { ...S, model: usedModel, ua, ip, path: ref }).catch(()=>{});

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body)
    };

  } catch (err) {
    console.error("murtakaz error:", err);
    const msg = (err && err.message) ? err.message : String(err);
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" },
      body: `Server error: ${msg}`
    };
  }
};
