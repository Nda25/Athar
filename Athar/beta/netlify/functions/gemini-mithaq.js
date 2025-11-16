// netlify/functions/gemini-mithaq.js
// ================================================================
// "ميثــاق" — بطاقات ربط للدروس:
// - ربط بالدين / بالوطن / بمادة أخرى / بالحياة الواقعية / بالدول الأخرى
// - حماية Auth0 (requireUser)
// - تتبّع الاستخدام (log-tool-usage)
// - محاولات متعددة + fallback بين الموديلات + إصلاح ذاتي
// - إخراج JSON صارم متوافق مع واجهة mithaq.js
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
  p1: "ابتدائي دنيا: لغة شديدة البساطة، أمثلة من حياة الطفل اليومية، وربط مباشر بقيم عامة.",
  p2: "ابتدائي عليا: أمثلة ملموسة وربط بقيم دينية ووطنية بسيطة ومواقف حياتية قريبة.",
  m:  "متوسط: ربط أوضح بالمفاهيم المجردة، وقصص واقعية، وروابط بين المواد والدول.",
  h:  "ثانوي: دقة مختصرة وروابط أعمق بالدين والوطن والحياة الواقعية والعالم.",
};
const stageLabel = (c) =>
  ({ p1: "ابتدائي دنيا", p2: "ابتدائي عليا", m: "متوسط", h: "ثانوي" }[c] ||
    c ||
    "ثانوي");

const CATEGORY_CODES = ["deen", "watan", "subject", "life", "world"];

// ——— تقليم + إزالة تكرار (5..10) ———
function clampCards(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  const seen = new Set();

  for (const it of arr) {
    const category = String(it?.category || "").trim().toLowerCase();
    const title = String(it?.title || "").trim();
    const brief = String(it?.brief || "").trim();
    const idea = String(it?.idea || "").trim();

    if (!category || !title || !brief || !idea) continue;
    if (!CATEGORY_CODES.includes(category)) continue;

    const key = category + "|" + title.toLowerCase() + "|" + idea.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ category, title, brief, idea });
    if (out.length >= 10) break;
  }

  // نحتاج على الأقل 5 بطاقات
  return out.length >= 5 ? out : [];
}

const isStrict = (d) => Array.isArray(d?.cards) && d.cards.length >= 5;
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
    return {
      statusCode: auth?.status || 401,
      body: auth?.error || "Unauthorized",
    };
  }

  // قراءة جسم الطلب
  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Bad JSON body" };
  }

  const { subject, topic, stage = "h" } = payload || {};
  if (!subject) return { statusCode: 400, body: "Missing subject" };
  if (!topic) return { statusCode: 400, body: "Missing topic" };

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

  // مخطط الاستجابة (يوجّه Gemini)
  const responseSchema = {
    type: "OBJECT",
    required: ["cards"],
    properties: {
      cards: {
        type: "ARRAY",
        minItems: 5,
        maxItems: 10,
        items: {
          type: "OBJECT",
          required: ["category", "title", "brief", "idea"],
          properties: {
            category: {
              type: "STRING",
              description:
                "قيمة واحدة من: deen, watan, subject, life, world",
            },
            title: { type: "STRING" },
            brief: { type: "STRING" },
            idea: { type: "STRING" },
          },
        },
      },
    },
  };

  // برومبت نظام: JSON فقط + معنى الحقول
  const BASE_SYSTEM = `
أنتِ أداة "ميثــاق" لمعلمي ومدرّسات المملكة العربية السعودية.
مهمتك توليد **بطاقات ربط** للدروس، وليست أنشطة أو تجارب كاملة.

أرجعي **كائن JSON واحد فقط** بهذا الشكل:

{
  "cards": [
    {
      "category": "deen",
      "title": "...",
      "brief": "...",
      "idea": "..."
    }
  ]
}

- لا تكتبي أي نص خارج JSON.
- "category" يجب أن تكون واحدة فقط من القيم التالية:
  - "deen"    : ربط بالدين (قيم عامة، آيات أو أحاديث مشهورة، بلا دخول في فتاوى أو تفاصيل فقهية).
  - "watan"   : ربط بالوطن (المملكة العربية السعودية): رؤية 2030، المشاريع الوطنية، الإصلاحات التعليمية، القيم الوطنية.
  - "subject" : ربط بمادة أخرى من مناهج السعودية للعام 1447هـ / 2025–2026م، مثل الرياضيات، الكيمياء، الأحياء، اللغة العربية، الدراسات الاجتماعية، المهارات الحياتية، المهارات الرقمية… حسب ما يناسب الموضوع.
  - "life"    : ربط بالحياة الواقعية واليوميات (مواقف من حياة الطلاب والطالبات، الأسرة، المجتمع).
  - "world"   : ربط بالدول الأخرى والعالم (تجارب دول، قصص نجاح علمية، أمثلة من دول مختلفة).
- "title": عنوان قصير جذّاب يوضّح نوع الربط.
- "brief": شرح مختصر يوضّح فكرة الربط ولماذا هو مناسب تربويًا لهذا الدرس.
- "idea": نص أو صياغة قصيرة **جاهزة** يمكن أن يقولها المعلم أو يكتبها ليربط الدرس بهذه الجهة.
  - ليست تجربة أو نشاط طويل.
  - يمكن أن تكون جملة افتتاحية، تعليق، أو سؤال بسيط يدعو للتفكير.
- راعي المرحلة: ${STAGE_HINT[stage] || "ثانوي: ربط أعمق بالمفاهيم مع أمثلة واقعية ووطنية وعالمية."}
`.trim();

  // طلب واحد: نريد كل أنواع الربط في دفعة واحدة
  const USER_PROMPT = `
أريد بطاقات ربط لدرس في مادة "${subject}" للمرحلة (${stageLabel(
    stage
  )}) بعنوان "${topic}".

هدف "ميثاق" هو شدّ وثاق الدرس بروابط متنوعة:
- ربط بالدين (deen)
- ربط بالوطن السعودي (watan)
- ربط بمادة أخرى من مناهج السعودية (subject)
- ربط بالحياة الواقعية (life)
- ربط بالدول الأخرى والعالم (world)

المطلوب:
- أخرِجي 5–10 بطاقات.
- احرصي أن يوجد **على الأقل بطاقة واحدة** لكل نوع من الأنواع الخمسة.
- يمكن تكرار بعض الأنواع إذا كان هناك أفكار قوية إضافية.
- التزمي بالقيم المسموح بها في "category".
`.trim();

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
            {
              role: "user",
              parts: [{ text: `${BASE_SYSTEM}\n\n${promptText}` }],
            },
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
أعيدي الآن **نفس البنية** (JSON واحد) وبطاقات صالحة (5–10 على الأقل) بلا أي نص خارج JSON.
`.trim();

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
          tool_name: "mithaq",
          user_email: auth?.user?.email || null,
          meta: { subject, topic, stage, count },
        }),
      });
    } catch (_) {
      // تجاهل هادئ
    }
  }

  // الحلقة: موديلات × محاولات (نفس الآلية)
  let finalStrict = null;
  let finalSoft = null;
  let finalRaw = "";
  let usedModel = "";

  for (const model of MODELS) {
    let prompt = USER_PROMPT;

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
        break; // جرّب موديل آخر
      }
    }

    if (finalStrict) break;
  }

  if (finalStrict) {
    await logUsage(finalStrict.cards.length);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        cards: finalStrict.cards,
        _meta: { model: usedModel, subject, topic, stage },
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
          _meta: { model: usedModel, subject, topic, stage },
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
