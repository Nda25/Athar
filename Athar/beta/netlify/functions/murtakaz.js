// netlify/functions/murtakaz.js
// Node 18+ (Netlify default). لا تحتاجين حزمة خارجية: نستخدم fetch مباشرة على REST API.

export const handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: 'Missing GEMINI_API_KEY' };
    }

    const {
      mode = 'topic',          // 'topic' | 'text'
      subject = '',
      topic = '',
      sourceText = '',         // في حال mode='text'
      age = 'p2',              // p1 | p2 | m | h
      duration = 45,
      bloomMain = 'understand',
      bloomSupport = '',
      goalCount = 2,
      notes = '',
      level = 'mixed',         // mixed | low | high
      adapt = false            // true | false
    } = JSON.parse(event.body || '{}');

    // خريطة أسماء بالعربي
    const AGE_NAME = { p1:'ابتدائي دُنيا', p2:'ابتدائي عُليا', m:'متوسط', h:'ثانوي' };
    const BLOOM_AR = {
      remember:'تذكّر', understand:'فهم', apply:'تطبيق',
      analyze:'تحليل', evaluate:'تقويم', create:'إبداع'
    };

    // لو نمط "نص للتحليل" ولم يصل topic، خذي أول سطر عنوانًا
    const resolvedTopic = topic?.trim() || (sourceText.split(/[.!؟\n]/)[0].slice(0,60) + '…');

    // تعليمات دقيقة لجمناي + مخطط JSON
    const systemPrompt = `
أنت خبير تصميم تعليمي. أريد خطة دقيقة وملائمة للموضوع والفئة العمرية، مع أنشطة متدرجة حسب بلوم.
أعيدي إخراجك بصيغة JSON **فقط** وفق المخطط التالي، من دون شرح خارجي ومن دون أسطر زائدة:

{
  "title": "string - عنوان موجز للدرس (يشمل الموضوع)",
  "goals": ["string", ...]               // بين 1-3 حسب goalCount، أفعالها متسقة مع مستوى بلوم الأساسي
  "success": "string",                    // معيار نجاح قابل للملاحظة
  "structure": ["قبل: ...", "أثناء: ...", "بعد: ..."],  // دقيقة لكل جزء مستندة إلى duration
  "activities": ["string", ...],          // 3-4 أنشطة مخصصة للموضوع، مذكور فيها الفعل (بلوم)
  "assessment": ["س١ ...", "س٢ ...", "س٣ ..."], // متدرج (سهل/متوسط/متقدم) ومربوط بالموضوع
  "diff": ["دعم: ...", "إثراء: ...", "مرونة العرض: ..."], // تمايز واقعي
  "oneMin": "string",                     // خطة الدقيقة الواحدة متصلة بالموضوع
  "ageLabel": "string",                   // اسم الفئة بالعربية
  "mainBloomLabel": "string",             // اسم مستوى بلوم الأساسي بالعربية
  "supportBloomLabel": "string"           // إن وجد
}

شروط صارمة:
- اجعلي كل بند مرتبطًا مباشرة بموضوع الدرس: "${resolvedTopic}"، والمادة: "${subject}".
- اجعلي اللغة عربية فصيحة مبسطة، موجهة للفئة: "${AGE_NAME[age] || age}".
- استعملي أفعالًا مناسبة لمستوى بلوم الأساسي "${BLOOM_AR[bloomMain] || bloomMain}" (والداعم إن وُجد "${BLOOM_AR[bloomSupport] || bloomSupport}").
- قسّمي الوقت منطقيًا وفق مدة الحصة ${duration} دقيقة.
- اجتنبي العمومية؛ أعطِ أمثلة وأنشطة مرتبطة بالمحتوى نفسه.
- إن كان هناك ملاحظة للمعلم: "${notes}"، فخذيها بالحسبان.
- لا تضعي أي شرح خارج JSON ولا علامات تنسيق برمجية.
`;

    // بناء الـ prompt للـ API
    const contents = [
      {
        role: 'user',
        parts: [
          { text: systemPrompt },
          { text: `المدخلات:\n- النمط: ${mode}\n- النص للتحليل: ${sourceText ? sourceText.slice(0, 2000) : '(لا يوجد)'}\n- مستوى بلوم (أساسي): ${bloomMain}\n- مستوى بلوم (داعم): ${bloomSupport || '(بدون)'}\n- عدد الأهداف: ${goalCount}\n- تقدير مستوى الصف: ${level}\n- تعلّم تكيفي: ${adapt ? 'مفعّل' : 'غير مفعّل'}` }
        ]
      }
    ];

    // نداء REST لجمناي (1.5-pro مناسب للأفكار المركبة)
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=' + encodeURIComponent(apiKey);
    const payload = {
      contents,
      generationConfig: {
        temperature: 0.8,     // تنويع معقول
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1200
      }
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const errTxt = await resp.text();
      return { statusCode: resp.status, body: `Gemini error: ${errTxt}` };
    }

    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // تنظيف وفك JSON (لو أحاطته ```)
    const asJson = text
      .replace(/```json/gi,'')
      .replace(/```/g,'')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(asJson);
    } catch (e) {
      // محاولة أخيرة: قص أي أسطر قبل/بعد قوس JSON
      const first = asJson.indexOf('{');
      const last  = asJson.lastIndexOf('}');
      parsed = JSON.parse(asJson.slice(first, last+1));
    }

    // ضبط الحدود والحقول الافتراضية
    const clipArr = (a, n) => Array.isArray(a) ? a.slice(0, n) : [];
    parsed.goals      = clipArr(parsed.goals, Math.max(1, Math.min(3, +goalCount || 2)));
    parsed.structure  = clipArr(parsed.structure, 3);
    parsed.activities = clipArr(parsed.activities, 4);
    parsed.assessment = clipArr(parsed.assessment, 3);
    parsed.diff       = clipArr(parsed.diff, 3);

    // إعادة بعض الميتاداتا كي ترسمي الشرائط/الحبوب
    parsed.meta = {
      subject,
      topic: resolvedTopic,
      age,
      ageLabel: parsed.ageLabel || (AGE_NAME[age] || age),
      mainBloom: bloomMain,
      supportBloom: bloomSupport || '',
      mainBloomLabel: parsed.mainBloomLabel || (BLOOM_AR[bloomMain] || bloomMain),
      supportBloomLabel: parsed.supportBloomLabel || (bloomSupport ? (BLOOM_AR[bloomSupport] || bloomSupport) : '')
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type':'application/json; charset=utf-8' },
      body: JSON.stringify(parsed)
    };
  } catch (err) {
    return { statusCode: 500, body: 'Server error: ' + (err?.message || err) };
  }
};
