// netlify/functions/gemini-ethraa.js
// ================================================================
// توليد "بطاقات إثراء" بمحتوى صحيح وجاهز للتنفيذ
// - حماية Auth0 (requireUser)
// - تتبّع الاستخدام (log-tool-usage)
// - محاولات متعددة + fallback بين الموديلات + إصلاح ذاتي
// - إخراج JSON صارم متوافق مع الواجهة
// ================================================================

const { requireUser } = require("./_auth.js");

// ——— أدوات مساعدة مشتركة ———
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripFences = (s = "") =>
  String(s)
    .replace(/^\s*```json/i, "")
    .replace(/^\s*```/i, "")
    .replace(/```$/i, "")
    .trim();

const STAGE_HINT = {
  p1: "ابتدائي دنيا: لغة شديدة البساطة وأنشطة حسية قصيرة (5–7 دقائق).",
  p2: "ابتدائي عليا: أمثلة ملموسة وتمثيلات بصرية مختصرة (6–8 دقائق).",
  m:  "متوسط: خطوات مباشرة ومصطلحات مبسطة وتمهيد للمجرد (7–9 دقائق).",
  h:  "ثانوي: دقة علمية مختصرة وتطبيقات واقعية (8–10 دقائق).",
};
const stageLabel = (c) =>
  ({ p1: "ابتدائي دنيا", p2: "ابتدائي عليا", m: "متوسط", h: "ثانوي" }[c] ||
    c ||
    "ثانوي");

// ——— تقليم + إزالة تكرار (3..6) ———
function clampCards(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  const seen = new Set();
  for (const it of arr) {
    const title = String(it?.title || "").trim();
    const idea = String(it?.idea || "").trim();
    const brief = String(it?.brief || "").trim();
    if (!title || !idea || !brief) continue;
    const key = (title + "|" + idea).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      title,
      brief,
      idea, // أوامر تنفيذية مختصرة
      source: String(it?.source || "").trim(), // اختياري
      evidence_date: String(it?.evidence_date || "").trim(), // اختياري
    });
    if (out.length >= 6) break;
  }
  return out.length >= 3 ? out : [];
}

const isStrict = (d) => Array.isArray(d?.cards) && d.cards.length >= 3;
const isSoft = (d) => Array.isArray(d?.cards) && d.cards.length >= 1;

// ——— المعالج الرئيسي مع حماية ———
exports.handler = async (event) => {
  // POST فقط
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // تحقق المستخدم (Auth0)
  const auth = await requireUser(event);
  if (!auth?.ok) {
    return { statusCode: auth?.status || 401, body: auth?.error || "Unauthorized" };
  }

  // قراءة جسم الطلب
  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Bad JSON body" };
  }

  const { subject, stage = "h", focus = "auto", lesson } = payload || {};
  if (!subject) return { statusCode: 400, body: "Missing subject" };

  // متغيرات البيئة
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) return { statusCode: 500, body: "Missing GEMINI_API_KEY" };

  const PRIMARY = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const FALLBACKS = (process.env.GEMINI_FALLBACKS ||
    "gemini-1.5-flash-8b,gemini-1.5-flash-latest,gemini-1.5-pro")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const MODELS = [PRIMARY, ...FALLBACKS];

  const TIMEOUT_MS = +(process.env.TIMEOUT_MS || 23000);
  const MAX_RETRIES = +(process.env.RETRIES || 2);
  const BACKOFF_MS = +(process.env.BACKOFF_MS || 700);

  // نافذة زمنية للمستجدات
  const now = new Date();
  const since = `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now.getDate()).padStart(2, "0")}`;

  // مخطط الاستجابة (يوجّه Gemini)
  const responseSchema = {
    type: "OBJECT",
    required: ["cards"],
    properties: {
      cards: {
        type: "ARRAY",
        minItems: 3,
        maxItems: 6,
        items: {
          type: "OBJECT",
          required: ["title", "brief", "idea"],
          properties: {
            title: { type: "STRING" },
            brief: { type: "STRING" },
            idea: { type: "STRING" },
            source: { type: "STRING" }, // اختياري
            evidence_date: { type: "STRING" }, // اختياري YYYY-MM-DD
          },
        },
      },
    },
  };

  // برومبت نظام: JSON فقط + أسلوب التنفيذ
  const BASE_SYSTEM = `
أنتِ مساعدة إثرائية للمعلمين بالعربية. أرجعي **كائن JSON واحد فقط**:
{
 "cards":[
   {"title":"...", "brief":"...", "idea":"...", "source":"", "evidence_date":""}
 ]
}
- أعيدي 3–6 بطاقات غير مكررة.
- "idea": خطوات تنفيذية مباشرة (أوامر عملية موجزة 1–5 خطوات)، بدون أسئلة مفتوحة من نوع "ناقشي/تخيلي/فكري".
- راعي المرحلة: ${STAGE_HINT[stage] || "ثانوي: دقة مختصرة وتطبيق واقعي."}
- إن تعذر المصدر الحديث: اتركي "source" و"evidence_date" فارغين ("").
- لا تكتبي أي نص خارج JSON.
`.trim();

  // قوالب الطلب حسب تركيز الإثراء
  const Q_LATEST = `
بطاقات عن **أحدث المستجدات** المبسطة في "${subject}" منذ ${since}.
لكل بطاقة:
- "title": حقيقة/نتيجة محددة موجزة.
- "brief": لماذا هذه المعلومة صحيحة ومهمة تربويًا.
- "idea": عرض/تجربة/نشاط قصير **جاهز للتنفيذ** (بدون حوارات مفتوحة).
${lesson ? `- اربطي إن أمكن بدرس "${lesson}".` : ""}
`.trim();

  const Q_MYTH = `
بطاقات **خرافات شائعة وتصحيحها العلمي** في "${subject}" (${stageLabel(stage)}).
- "title": ابدئي بـ "خرافة:" ثم نص الخرافة الشائع.
- "brief": التصحيح العلمي الصحيح المختصر.
- "idea": خطوات عملية قصيرة تُظهر التصحيح (تجربة آمنة/محاكاة/عرض قصير) **بدون أسئلة مفتوحة**.
`.trim();

  const Q_ODD = `
بطاقات **حقائق مدهشة صحيحة** في "${subject}" تناسب ${stageLabel(stage)}.
- "title": حقيقة واحدة دقيقة.
- "brief": تفسير مبسط صحيح.
- "idea": تنفيذ عملي قصير مباشر يبرهن الحقيقة.
`.trim();

  const Q_IDEAS = `
بطاقات **أفكار إثرائية عملية جاهزة** لمادة "${subject}" تناسب ${stageLabel(stage)}.
- "idea": مواد، تحضير، تنفيذ (خطوات قصيرة قابلة للتطبيق خلال 5–10 دقائق).
`.trim();

  const PIPELINES = {
    latest: [Q_LATEST, Q_MYTH, Q_ODD, Q_IDEAS],
    myth: [Q_MYTH, Q_LATEST, Q_ODD, Q_IDEAS],
    odd: [Q_ODD, Q_LATEST, Q_MYTH, Q_IDEAS],
    ideas: [Q_IDEAS, Q_LATEST, Q_MYTH, Q_ODD],
    auto: [Q_MYTH, Q_LATEST, Q_ODD, Q_IDEAS], // نبدأ بالخرافات بحسب تفضيلك
  };
  const TRIES = PIPELINES[focus] || PIPELINES.auto;

  // استدعاء Gemini مرة واحدة مع timeout + schema
  async function callGeminiOnce(model, promptText) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
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
          contents: [
            { role: "user", parts: [{ text: `${BASE_SYSTEM}\n\n${promptText}` }] },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema,
            candidateCount: 1,
            maxOutputTokens: 1400,
            temperature: 0.55,
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
        return { ok: false, rawText: txt, data: null };
      }

      const raw = stripFences(
        outer?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
      );
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        return { ok: false, rawText: raw, data: null };
      }

      const cleaned = clampCards(data.cards || []);
      return cleaned.length
        ? { ok: true, rawText: raw, data: { cards: cleaned } }
        : { ok: false, rawText: raw, data: { cards: [] } };
    } finally {
      clearTimeout(timer);
    }
  }

  // إصلاح ذاتي
  const repairPrompt = (prevRaw) => `
الرد السابق كان ناقصًا/غير صالح. هذا هو نصّك:
<<<
${prevRaw}
<<<
أعيدي الآن **نفس البنية** (JSON واحد) وبطاقات صالحة (3–6 على الأقل) بلا أي نص خارج JSON.
`.trim();

  // الحلقة: موديلات × قوالب × محاولات
  let finalStrict = null;
  let finalSoft = null;
  let finalRaw = "";
  let usedModel = "";

  for (const model of MODELS) {
    for (const q of TRIES) {
      let prompt = q;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const resp = await callGeminiOnce(model, prompt);
          finalRaw = resp.rawText || finalRaw;

          if (resp.ok && isStrict(resp.data)) {
            finalStrict = resp.data;
            usedModel = model;
            break;
          }
          if (resp.data && isSoft(resp.data)) {
            finalSoft = resp.data;
            usedModel = model;
          }

          // إصلاح
          prompt = repairPrompt(resp.rawText || "");
          await sleep(BACKOFF_MS * (attempt + 1));
        } catch (err) {
          const status = err.status || 0;
          const isTimeout = /timeout|AbortError/i.test(String(err?.message));
          const retriable =
            isTimeout || [429, 500, 502, 503, 504].includes(status);
          if (retriable && attempt < MAX_RETRIES) {
            await sleep(BACKOFF_MS * (attempt + 1));
            continue;
          }
          break; // جرّب قالب/موديل آخر
        }
      }
      if (finalStrict) break;
    }
    if (finalStrict) break;
  }

  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  };

  // تتبّع الاستخدام (لا يُفشل الطلب لو فشل اللوج)
  async function logUsage(count) {
    try {
      const base =
        process.env.SITE_BASE_URL || process.env.PUBLIC_BASE_URL || "";
      if (!base) return;
      await fetch(`${base}/.netlify/functions/log-tool-usage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tool_name: "ethraa",
          user_email: auth?.user?.email || null,
          meta: { subject, stage, focus, lesson: lesson || "", count },
        }),
      });
    } catch (_) {
      // تجاهل هادئ
    }
  }

  // ردود
  if (finalStrict) {
    await logUsage(finalStrict.cards.length);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        cards: finalStrict.cards,
        _meta: { model: usedModel, subject, stage, focus, lesson: lesson || "" },
      }),
    };
  }

  if (finalSoft) {
    await logUsage(finalSoft.cards.length);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        debug: "incomplete",
        parsed: {
          cards: finalSoft.cards,
          _meta: { model: usedModel, subject, stage, focus, lesson: lesson || "" },
        },
        rawText: finalRaw || "",
      }),
    };
  }

  await logUsage(0);
  const failMsg = "Model returned incomplete JSON after retries";
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      debug: "incomplete",
      parsed: null,
      rawText: finalRaw || "",
      message: failMsg,
    }),
  };
};
