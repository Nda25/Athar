// netlify/functions/strategy.js
exports.handler = async (event) => {
  // السماح فقط بـ POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // قراءة الـ JSON بأمان
  let payload = {};
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: "Bad JSON body" }; }

  const { subject, bloomType, lesson } = payload;

  // مفاتيح وإعدادات من البيئة (يمكن تغييرها من لوحة نتلايفي)
  const API_KEY     = process.env.GEMINI_API_KEY;
  const MODEL       = process.env.GEMINI_MODEL || "gemini-1.5-flash"; // سريع وثابت
  const TIMEOUT_MS  = +(process.env.TIMEOUT_MS || 23000);             // 23 ثانية
  const RETRIES     = +(process.env.RETRIES || 2);                     // محاولتان إضافيتان
  const BACKOFF_MS  = +(process.env.BACKOFF_MS || 700);               // 700ms, ثم ×2

  if (!API_KEY) {
    return { statusCode: 500, body: "Missing GEMINI_API_KEY" };
  }

  // بناء البرومبت (مطابق لكودك)
  const typePart   = (bloomType && bloomType !== "الكل") ? `(تصنيف بلوم: "${bloomType}")` : "";
  const lessonPart = lesson ? `ومناسبة لدرس "${lesson}"` : "";
  const prompt =
`أنا معلمة ثانوي. أريد استراتيجية تدريس لمادة ${subject} ${typePart} ${lessonPart}.
اكتبي بطاقة استراتيجية عملية بصيغة JSON بالمفاتيح الآتية:
strategy_name (نص)، bloom (نص)، importance (نص واحد)، materials (نص واحد)،
goals (مصفوفة نصوص 3–6 عناصر)، steps (مصفوفة خطوات مرقمة 4–8)،
examples (مصفوفة 2–4)، assessment (نص قصير)،
diff_support (نص)، diff_core (نص)، diff_challenge (نص)،
expected_impact (نص قصير يصف الأثر المتوقع من تطبيق الاستراتيجية على الطلاب)،
citations (مصفوفة كائنات {title, benefit} حيث title هو اسم المصدر و benefit هو شرح موجز لفائدة المصدر للمعلمة).
اللغة: عربية فصحى واضحة، مختصرة ولكن دقيقة، بدون مقدمات إنشائية.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

  // جسم الطلب (مطابق لكودك مع نفس الاستجابة المتوقعة)
  const reqBody = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          strategy_name: { type: "STRING" },
          bloom:         { type: "STRING" },
          importance:    { type: "STRING" },
          materials:     { type: "STRING" },
          goals:         { type: "ARRAY", items: { type: "STRING" } },
          steps:         { type: "ARRAY", items: { type: "STRING" } },
          examples:      { type: "ARRAY", items: { type: "STRING" } },
          assessment:    { type: "STRING" },
          diff_support:  { type: "STRING" },
          diff_core:     { type: "STRING" },
          diff_challenge:{ type: "STRING" },
          expected_impact:{type:"STRING"},
          citations:     { type: "ARRAY", items: { type: "OBJECT", properties: {
            title:   { type: "STRING" },
            benefit: { type: "STRING" }
          }}}
        }
      }
    }
  };

  // دالة مساعدة: نوم بسيط
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // استدعاء API مع timeout
  async function callOnce() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("timeout")), TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(reqBody),
        signal: controller.signal
      });

      const text = await res.text(); // نقرأ كنص أولاً لأي حال
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`);
        err.status = res.status;
        err.body = text;
        throw err;
      }

      // نحاول تحويل النص لJSON
      let json;
      try { json = JSON.parse(text); }
      catch (e) {
        const err = new Error("Bad JSON from API");
        err.status = 502;
        err.body = text.slice(0, 300);
        throw err;
      }

      const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

      let data;
      try { data = JSON.parse(raw); }
      catch {
        const err = new Error("Bad model JSON");
        err.status = 502;
        err.body = raw.slice(0, 300);
        throw err;
      }

      if (!data?.strategy_name) {
        const err = new Error("Incomplete response from model");
        err.status = 502;
        throw err;
      }

      data._meta = { subject, bloomType: bloomType || "", lesson: lesson || "" };
      return data;

    } finally {
      clearTimeout(timer);
    }
  }

  // إعادة محاولات تلقائية للأخطاء القابلة لإعادة المحاولة
  let attempt = 0;
  while (true) {
    try {
      const data = await callOnce();
      return {
        statusCode: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify(data)
      };
    } catch (err) {
      attempt++;
      const status = err.status || 0;
      const isTimeout = /timeout|AbortError/i.test(String(err?.message));
      const retriable = isTimeout || [429,500,502,503,504].includes(status);

      if (retriable && attempt <= RETRIES) {
        // backoff متزايد: 700ms، ثم 1400ms ...
        await sleep(BACKOFF_MS * attempt);
        continue;
      }

      // لو انقطع بسبب مهلة نُعيد 504 لتكون واضحة
      if (isTimeout) {
        return { statusCode: 504, body: "Gateway Timeout: model did not respond in time" };
      }

      // غير ذلك نُرجع حالة الخادم/نص الخطأ إن وجد
      const code = status || 500;
      const body = err.body || String(err.message || err);
      return { statusCode: code, body };
    }
  }
};
