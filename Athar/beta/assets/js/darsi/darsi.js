/* ===== قواميس ومعينات محلية (للاستدلال وشوية وظائف مساعدة) ===== */
const BLOOM_VERBS = {
  remember: ["يعدّد", "يسمّي", "يذكر", "يتعرّف"],
  understand: ["يشرح", "يلخّص", "يعطي مثالًا", "يفسّر", "يصنّف"],
  apply: ["يستخدم", "يوظّف", "يحلّ", "ينفّذ"],
  analyze: ["يفكّك", "يقارن", "يستنتج", "يربط", "يصنّف بعمق"],
  evaluate: ["يبرّر", "ينقد", "يحكم", "يقوّم"],
  create: ["يصمّم", "يركّب", "يبتكر", "يؤلف"],
};
const BLOOM_HINTS = {
  analyze: ["حلّل", "حلل", "قارن", "فرّق", "استنتج", "صنّف", "رتّب"],
  evaluate: ["قيّم", "برّر", "انقد", "احكم", "قوّم"],
  create: ["صمّم", "ابتكر", "ركّب", "ألّف", "خطّط"],
  apply: ["طبّق", "وظّف", "استخدم", "حلّ", "نفّذ"],
  understand: ["اشرح", "لخّص", "مثال", "فسّر", "عرّف"],
  remember: ["اذكر", "عدّد", "سمِّ", "تعرّف"],
};
const AGE_NAME = {
  p1: "ابتدائي دُنيا",
  p2: "ابتدائي عُليا",
  m: "متوسط",
  h: "ثانوي",
};

function pick(a) {
  return a[Math.floor(Math.random() * a.length)] || "";
}
function bullets(el, arr) {
  el.innerHTML = "";
  (arr || []).filter(Boolean).forEach((t) => {
    const li = document.createElement("li");
    li.textContent = t;
    el.appendChild(li);
  });
}
function toastMsg(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1200);
}

/* ===== تبديل “نمط الإدخال” ===== */
const modeSel = document.getElementById("f-mode");
const modeTopic = document.getElementById("mode-topic");
const modeText = document.getElementById("mode-text");
modeSel.addEventListener("change", () => {
  const isText = modeSel.value === "text";
  modeText.style.display = isText ? "" : "none";
  modeTopic.style.display = isText ? "none" : "";
});

/* ===== عناصر DOM ===== */
const fAge = document.getElementById("f-age");
const fDur = document.getElementById("f-duration");
const fMain = document.getElementById("f-bloom-main");
const fSup = document.getElementById("f-bloom-support");
const fGoal = document.getElementById("f-goal-count");
const fNotes = document.getElementById("f-notes");
const inputsWrap = document.getElementById("inputs");

const btnAnalyze = document.getElementById("btn-analyze");
const btnGen = document.getElementById("btn-generate");
const btnCopy = document.getElementById("btn-copy-full");
const btnClass = document.getElementById("btn-classroom");
const btnTeams = document.getElementById("btn-teams");
const btnPrint = document.getElementById("btn-print");
const toggleInputs = document.getElementById("toggleInputs");
const toggleInputs2 = document.getElementById("toggleInputs2");

const outSummary = document.getElementById("out-summary");
const outGrid = document.getElementById("out-grid");
const outOneMin = document.getElementById("out-onemin");
const outGoals = document.getElementById("out-goals");
const outLadder = document.getElementById("out-ladder");
const postActions = document.getElementById("post-actions");

const pillMain = document.getElementById("pill-main");
const pillSup = document.getElementById("pill-sup");
const pillAge = document.getElementById("pill-age");

let CURRENT = {
  subject: "",
  topic: "",
  main: "understand",
  sup: "",
  age: "p2",
  duration: 45,
  goals: [],
  success: "",
  activities: [],
  assessment: [],
  structure: [],
  oneMin: "",
  notes: "",
  adaptMsg: "",
};
// نشغّل الربط بعد تحميل السكربتات (Supabase/Auth0) أكيد
window.addEventListener("load", () => {
  if (typeof supaEnsureUserProfile === "function") {
    supaEnsureUserProfile().catch(() => {});
  }
});

// — لالتقاط بيانات الحالة وإرسالها كـ meta
function metaSnapshot() {
  return {
    mode: document.getElementById("f-mode").value,
    subject: (document.getElementById("f-subject")?.value || "").trim() || null,
    topic: (document.getElementById("f-topic")?.value || "").trim() || null,
    age: document.getElementById("f-age").value,
    duration: +document.getElementById("f-duration").value || null,
    bloom_main: document.getElementById("f-bloom-main").value,
    bloom_support: document.getElementById("f-bloom-support").value || null,
    goal_count: +document.getElementById("f-goal-count").value || null,
    adapt: document.getElementById("f-adapt").value === "on",
  };
}

/* ===== إظهار/إخفاء المدخلات ===== */
function toggleInputsView() {
  inputsWrap.classList.toggle("collapsed");
  const collapsed = inputsWrap.classList.contains("collapsed");
  toggleInputs.textContent = collapsed ? "إظهار المدخلات" : "إخفاء المدخلات";
  if (toggleInputs2)
    toggleInputs2.textContent = collapsed ? "إظهار مدخلاتي" : "إخفاء مدخلاتي";
}
toggleInputs.addEventListener("click", toggleInputsView);
if (toggleInputs2) toggleInputs2.addEventListener("click", toggleInputsView);

/* ===== تحليل المحتوى (استدلال بلوم من نص) ===== */
function inferBloomFrom(text) {
  text = (text || "").replace(/[^\u0600-\u06FF\s]/g, " ");
  const rank = [
    "create",
    "evaluate",
    "analyze",
    "apply",
    "understand",
    "remember",
  ];
  for (const lvl of rank) {
    if ((BLOOM_HINTS[lvl] || []).some((k) => text.includes(k))) return lvl;
  }
  return "understand";
}
btnAnalyze.addEventListener("click", async () => {
  const mode = document.getElementById("f-mode").value;
  if (mode !== "text") {
    toastMsg("اختر: نص للتحليل أولًا");
    return;
  }
  const text = document.getElementById("f-text").value || "";
  if (!text.trim()) {
    toastMsg("الصقي فقرة للتحليل");
    return;
  }

  const inferred = inferBloomFrom(text);
  fMain.value = inferred;
  toastMsg(`تم الاستدلال على مستوى بلوم: ${inferred}`);

  // تتبّع التحليل
  if (typeof supaLogToolUsage === "function") {
    try {
      await supaLogToolUsage("murtakaz_analyze", {
        ...metaSnapshot(),
        inferred,
      });
    } catch (_) {}
  }
});

/* ===== نداء Gemini عبر Netlify Function (مع Bearer) ===== */
btnGen.addEventListener("click", async () => {
  const mode = document.getElementById("f-mode").value; // 'topic' | 'text'
  const subject =
    (document.getElementById("f-subject")?.value || "").trim() || "—";
  const topic = (document.getElementById("f-topic")?.value || "").trim();
  const sourceText = (document.getElementById("f-text")?.value || "").trim();

  const age = fAge.value;
  const duration = +fDur.value || 45;
  const bloomMain = fMain.value;
  const bloomSupport = fSup.value || "";
  const goalCount = +fGoal.value || 2;
  const notes = fNotes.value.trim();
  const adapt = document.getElementById("f-adapt").value === "on";

  // تحقّق سريع
  if (mode === "topic" && !topic) {
    toastMsg("اكتبي الموضوع…");
    return;
  }
  if (mode === "text" && !sourceText) {
    toastMsg("الصقي نصًا للتحليل…");
    return;
  }

  // حالة انتظار
  btnGen.disabled = true;
  btnGen.dataset._label = btnGen.textContent;
  btnGen.textContent = "نولّد خطة ذكية… ✨";

  try {
    // الحصول على التوكن
    let token = null;
    try {
      token = await getAuthToken();
    } catch (e) {
      console.error(e);
      toastMsg("يجب تسجيل الدخول أولًا");
      btnGen.disabled = false;
      btnGen.textContent = btnGen.dataset._label || "ولّد لي الخطة ✨";
      return;
    }

    const res = await fetch("/.netlify/functions/murtakaz", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        mode,
        subject,
        topic,
        sourceText,
        age,
        duration,
        bloomMain,
        bloomSupport,
        goalCount,
        notes,
        level: document.getElementById("f-level").value,
        adapt,
        // إجبار التنويع التام دون تغيير الواجهة
        variant: Date.now(),
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || "HTTP " + res.status);
    }
    const R = await res.json();

    // تخزين حالي (لنفس أزرار النسخ/الطباعة)
    CURRENT = {
      subject,
      topic: R.meta?.topic || topic,
      main: bloomMain,
      sup: bloomSupport,
      age,
      duration,
      goals: R.goals || [],
      success: R.success || "",
      activities: R.activities || [],
      assessment: R.assessment || [],
      structure: R.structure || [],
      oneMin: R.oneMin || "",
      notes,
    };

    // رسم الواجهة
    document.getElementById(
      "out-head"
    ).textContent = `المادة: ${subject} — الموضوع: "${CURRENT.topic}" — الزمن: ${duration} دقيقة`;

    bullets(document.getElementById("out-bullets"), [
      notes ? `ملاحظة المعلم: ${notes}` : null,
      bloomSupport
        ? "دمج مستويين من بلوم (أساسي + داعم)."
        : "تركيز على مستوى بلوم أساسي واحد.",
    ]);

    const outAdapt = document.getElementById("out-adapt");
    outAdapt.style.display = "none";
    outAdapt.textContent = "";
    pillMain.textContent =
      "بلوم (أساسي): " + (R.meta?.mainBloomLabel || CURRENT.main);
    if (bloomSupport) {
      pillSup.style.display = "inline-block";
      pillSup.textContent =
        "بلوم (+2): " + (R.meta?.supportBloomLabel || bloomSupport);
    } else {
      pillSup.style.display = "none";
    }
    pillAge.textContent = "العمر: " + (R.meta?.ageLabel || R.meta?.age || age);

    bullets(document.getElementById("out-structure"), CURRENT.structure);
    bullets(document.getElementById("out-activities"), CURRENT.activities);
    bullets(document.getElementById("out-assessment"), CURRENT.assessment);
    bullets(document.getElementById("out-diff"), R.diff || []);

    document.getElementById("oneMinText").textContent = CURRENT.oneMin;
    document.getElementById("goalsTitleOut").textContent = CURRENT.topic;

    const gl = document.getElementById("goalsList");
    gl.innerHTML = "";
    (CURRENT.goals || []).forEach((g) => {
      const li = document.createElement("li");
      li.textContent = g;
      gl.appendChild(li);
    });
    document.getElementById("successOut").textContent = R.success || "";

    // سلّم تقدير مبسّط (يستفيد من النجاح)
    const ladder = document.getElementById("ladderWrap");
    ladder.innerHTML = `
          <div class="step">
            <div class="tag ok">أتقن ✔︎</div>
            <div>${
              R.success || "يطبق المفهوم بدقة في مثال جديد دون مساعدة."
            }</div>
          </div>
          <div class="step">
            <div class="tag mid">متوسط ◉</div>
            <div>يفهم الفكرة الأساسية ويحتاج توجيهًا بسيطًا عند التطبيق.</div>
          </div>
          <div class="step">
            <div class="tag need">بحاجة دعم ✳︎</div>
            <div>يواجه صعوبة — قدّمي مثالًا إضافيًا أو تبسيطًا.</div>
          </div>
        `;

    // إظهار الأقسام
    outSummary.style.display = "";
    outGrid.style.display = "";
    outGoals.style.display = "";
    outOneMin.style.display = "";
    outLadder.style.display = "";
    postActions.style.display = "";

    // طيّ المدخلات إن كانت مفتوحة
    if (!inputsWrap.classList.contains("collapsed")) {
      inputsWrap.classList.add("collapsed");
      toggleInputs.textContent = "إظهار المدخلات";
      if (toggleInputs2) toggleInputs2.textContent = "إظهار مدخلاتي";
    }

    toastMsg("تم توليد خطة ذكية 🎉");

    // تتبّع: توليد خطة
    if (typeof supaLogToolUsage === "function") {
      try {
        await supaLogToolUsage("murtakaz_generate", metaSnapshot());
      } catch (_) {}
    }

    window.scrollTo({
      top: outSummary.offsetTop - 10,
      behavior: "smooth",
    });
  } catch (err) {
    console.error(err);
    toastMsg("تعذّر توليد الخطة. تحقّقي من المفتاح أو أعيدي المحاولة.");
  } finally {
    btnGen.disabled = false;
    btnGen.textContent = btnGen.dataset._label || "ولّد لي الخطة ✨";
  }
});

/* ===== تطبيق التكيّف بناء على الاختبار القبلي ===== */
document.getElementById("btn-adapt-apply").addEventListener("click", () => {
  const inputs = Array.from(
    document.querySelectorAll('#quizWrap input[type="number"]')
  );
  if (!inputs.length) {
    toastMsg("ولّدي الخطة أولاً");
    return;
  }
  const wrong = inputs.map((i) => +i.value || 0);
  const totalWrong = wrong.reduce((a, b) => a + b, 0);

  let focus = "";
  const maxIdx = wrong.indexOf(Math.max(...wrong));
  if (maxIdx === 0) focus = "تعزيز التهيئة والمفاهيم الأساسية (تذكّر/فهم).";
  else if (maxIdx === 1) focus = "تقوية النشاط الرئيسي وفق بلوم الأساسي.";
  else focus = "زيادة مهام التطبيق/التوسيع (المستوى الداعم).";

  CURRENT.adaptMsg = `تكييف تلقائي: ${focus} (إجمالي أخطاء: ${totalWrong}).`;
  const outAdapt = document.getElementById("out-adapt");
  outAdapt.textContent = CURRENT.adaptMsg;
  outAdapt.style.display = "";

  const extra =
    maxIdx === 0
      ? `إضافة أمثلة محسوسة أكثر في التهيئة.`
      : maxIdx === 1
      ? `تقسيم المهمة الرئيسية إلى خطوات أوضح.`
      : `تمرين تطبيقي إضافي بوقت قصير.`;

  const acts = CURRENT.activities.slice();
  acts.push(`🔧 تعديل تكيفي: ${extra}`);
  bullets(document.getElementById("out-activities"), acts);

  toastMsg("تم تطبيق التكيّف ✅");
});

/* ===== نسخ/طباعة/تصدير (مع تتبّع) ===== */
const AGE_LABEL = (k) => AGE_NAME[k] || k;
function exportFullText(S) {
  const lines = [];
  lines.push(`العنوان: ${S.topic} — (${S.subject})`);
  if (S.adaptMsg) lines.push(S.adaptMsg);
  lines.push(`الزمن: ${S.duration} دقيقة — العمر: ${AGE_LABEL(S.age)}`);
  lines.push(`بلوم (أساسي): ${S.main}${S.sup ? " + " + S.sup : ""}`);
  if (S.notes) lines.push(`ملاحظات المعلم: ${S.notes}`);
  lines.push("\nالأهداف:");
  (S.goals || []).forEach((g) => lines.push(`- ${g}`));
  lines.push("\nمخطط الدرس:");
  (S.structure || []).forEach((s) => lines.push(`- ${s}`));
  lines.push("\nأنشطة:");
  (S.activities || []).forEach((a) => lines.push(`- ${a}`));
  lines.push("\nتقويم سريع:");
  (S.assessment || []).forEach((a) => lines.push(`- ${a}`));
  lines.push("\nتمايز:");
  (S.diff || []).forEach((a) => lines.push(`- ${a}`));
  lines.push("\nالدقيقة الواحدة:");
  lines.push(`- ${S.oneMin}`);
  lines.push("\nمعايير النجاح:");
  lines.push(`- ${S.success}`);
  return lines.join("\n");
}
function exportClassroom(S) {
  return [
    `[Google Classroom]
العنوان: ${S.topic} — ${S.subject}`,
    `التعليمات:
- اقرأ/ي الهدف: ${S.goals?.[0] || "-"}.
- نفّذي النشاط الرئيسي ثم أرسلي تذكرة الخروج.`,
    `المواد: (يُحدّد المعلم)`,
    `التاريخ/الوقت: (يُحدّد المعلم)`,
    `التقويم السريع:
1) ${S.assessment?.[0] || "-"}
2) ${S.assessment?.[1] || "-"}
3) ${S.assessment?.[2] || "-"}`,
    `تمايز:
- دعم: ${(S.diff || [])[0] || "-"}
- إثراء: ${(S.diff || [])[1] || "-"}`,
  ].join("\n");
}
function exportTeams(S) {
  return [
    `[Microsoft Teams Assignment]
Title: ${S.topic} — ${S.subject}
Instructions:
- Goals: ${(S.goals || []).join(" | ")}
- Main Activity: ${S.activities?.[1] || "-"}
- Exit Ticket: ${S.assessment?.[0] || "-"}
Rubric: (paste from page)
Due: (set by teacher)`,
  ].join("\n");
}
function copyText(txt) {
  navigator.clipboard.writeText(txt).then(() => toastMsg("تم النسخ ✅"));
}

btnCopy.addEventListener("click", async () => {
  copyText(exportFullText(CURRENT));
  if (typeof supaLogToolUsage === "function") {
    try {
      await supaLogToolUsage("murtakaz_copy_full", metaSnapshot());
    } catch (_) {}
  }
});
btnClass.addEventListener("click", async () => {
  copyText(exportClassroom(CURRENT));
  if (typeof supaLogToolUsage === "function") {
    try {
      await supaLogToolUsage("murtakaz_copy_classroom", metaSnapshot());
    } catch (_) {}
  }
});
btnTeams.addEventListener("click", async () => {
  copyText(exportTeams(CURRENT));
  if (typeof supaLogToolUsage === "function") {
    try {
      await supaLogToolUsage("murtakaz_copy_teams", metaSnapshot());
    } catch (_) {}
  }
});
btnPrint.addEventListener("click", async () => {
  window.print();
  if (typeof supaLogToolUsage === "function") {
    try {
      await supaLogToolUsage("murtakaz_print", metaSnapshot());
    } catch (_) {}
  }
});

// نسخ/طباعة بطاقة الأهداف فقط
function copyGoalsCard() {
  const el = document.getElementById("goalsCard");
  if (!el) return;
  const txt = el.innerText.trim();
  navigator.clipboard
    .writeText(txt)
    .then(() => toastMsg("تم نسخ بطاقة الأهداف ✅"));
}
function printElementById(id, title = "بطاقة الأهداف") {
  const node = document.getElementById(id);
  if (!node) return;
  const w = window.open("", "_blank");
  w.document.open();
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head>
        <meta charset="utf-8"><title>${title}</title>
        <style>
          body{font-family:"Cairo",system-ui,-apple-system,Segoe UI,Roboto; color:#0f172a; margin:20px}
          .box{border:1px solid #93c5fd80; border-radius:12px; padding:14px}
          h3{margin:0 0 6px; font-weight:700}
          ul{margin:0; padding-inline-start:1.2rem}
          strong{font-weight:700}
          @media print{ @page{margin:12mm} }
        </style>
      </head><body>
        <div class="box">${node.innerHTML}</div>
        <script>window.onload=()=>window.print()<\/script>
      </body></html>`);
  w.document.close();
}
document
  .getElementById("btn-goals-copy")
  ?.addEventListener("click", async () => {
    copyGoalsCard();
    if (typeof supaLogToolUsage === "function") {
      try {
        await supaLogToolUsage("murtakaz_goals_copy", metaSnapshot());
      } catch (_) {}
    }
  });
document
  .getElementById("btn-goals-print")
  ?.addEventListener("click", async () => {
    printElementById("goalsCard");
    if (typeof supaLogToolUsage === "function") {
      try {
        await supaLogToolUsage("murtakaz_goals_print", metaSnapshot());
      } catch (_) {}
    }
  });
