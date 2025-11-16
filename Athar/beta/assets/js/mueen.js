// مُعين — واجهة جديدة (عدّة دروس، كل يوم لدرس واحد)
(function () {
  const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const DOM = {
    subject: $("#f-subject"),
    grade: $("#f-grade"),
    count: $("#f-count"),
    lessonsBox: $("#lessons-box"),
    status: $("#status"),
    out: $("#out"),
    meta: $("#meta"),
    plan: $("#plan"),
    copyAllBtn: $("#btn-copy-all"),
    genBtn: $("#btn-generate"),
    toast: $("#toast"),
  };

  let currentPlan = null;

  // توست بسيط
  function toast(msg, ms = 1600) {
    if (!DOM.toast) return;
    DOM.toast.textContent = msg;
    DOM.toast.classList.add("show");
    clearTimeout(window.__mueenToastTimer);
    window.__mueenToastTimer = setTimeout(
      () => DOM.toast.classList.remove("show"),
      ms
    );
  }
  window.toast = window.toast || toast;

  // خانات أسماء الدروس حسب العدد
  function lessonRow(i) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    wrap.innerHTML = `
      <label>اسم الدرس ${i + 1}</label>
      <input class="lesson-name" data-idx="${i}" placeholder="اكتبي اسم الدرس كما في المنهج">
    `;
    return wrap;
  }

  function drawLessonInputs() {
    DOM.lessonsBox.innerHTML = "";
    const n = Number(DOM.count.value) || 1;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      frag.appendChild(lessonRow(i));
    }
    DOM.lessonsBox.appendChild(frag);
  }

  // توكن Auth0
  async function getAuthToken() {
    if (!window.auth) return null;
    try {
      if (typeof window.auth.getTokenSilently === "function") {
        return await window.auth.getTokenSilently({
          authorizationParams: { audience: "https://api.n-athar" },
        });
      }
      if (typeof window.auth.getToken === "function") {
        return await window.auth.getToken({ audience: "https://api.n-athar" });
      }
    } catch (e) {
      try {
        if (typeof window.auth.getTokenWithPopup === "function") {
          return await window.auth.getTokenWithPopup({
            authorizationParams: { audience: "https://api.n-athar" },
          });
        }
      } catch (_) {}
    }
    return null;
  }

  function chip(txt) {
    const c = document.createElement("span");
    c.className = "chip";
    c.textContent = txt;
    return c;
  }

  // رسم الخطة
  function renderPlan(data) {
    currentPlan = data;
    DOM.out.style.display = "block";

    // الميتا
    DOM.meta.innerHTML = "";
    const metaFrag = document.createDocumentFragment();
    metaFrag.appendChild(chip(data.meta.subject));
    metaFrag.appendChild(chip(`الصف: ${data.meta.grade}`));
    metaFrag.appendChild(chip(`عدد الدروس: ${data.meta.count}`));
    if (Array.isArray(data.meta.lessons)) {
      metaFrag.appendChild(
        chip(`الدروس: ${data.meta.lessons.join(" | ")}`)
      );
    }
    DOM.meta.appendChild(metaFrag);

    // الأيام
    DOM.plan.innerHTML = "";
    const planFrag = document.createDocumentFragment();

    (data.days || []).forEach((d, i) => {
      const card = document.createElement("div");
      card.className = "card-day";

      const header = document.createElement("div");
      header.className = "day-head";
      const lessonName = d.lesson ? ` — «${d.lesson}»` : "";
      header.innerHTML = `<h3 style="margin:0">${DAYS[i]}${lessonName}</h3>`;
      card.appendChild(header);

      const goalsLabel = document.createElement("h4");
      goalsLabel.style.margin = "6px 0";
      goalsLabel.textContent = "الأهداف";
      card.appendChild(goalsLabel);

      const goalsList = document.createElement("ul");
      goalsList.className = "list goals";
      (d.goals || []).forEach((g) => {
        const li = document.createElement("li");
        li.textContent = g;
        goalsList.appendChild(li);
      });
      card.appendChild(goalsList);

      const vocabLabel = document.createElement("h4");
      vocabLabel.style.margin = "6px 0";
      vocabLabel.textContent = "المفردات الجديدة";
      card.appendChild(vocabLabel);

      const vocabList = document.createElement("ul");
      vocabList.className = "list vocab";
      (d.vocab || []).forEach((v) => {
        const li = document.createElement("li");
        li.textContent = v;
        vocabList.appendChild(li);
      });
      card.appendChild(vocabList);

      const outcomeLabel = document.createElement("h4");
      outcomeLabel.style.margin = "6px 0";
      outcomeLabel.textContent = "النتائج المتوقعة";
      card.appendChild(outcomeLabel);

      const outcomes = document.createElement("p");
      outcomes.className = "outcomes muted";
      outcomes.textContent = d.outcomes || "";
      card.appendChild(outcomes);

      const hwLabel = document.createElement("h4");
      hwLabel.style.margin = "6px 0";
      hwLabel.textContent = "واجب منزلي مقترح";
      card.appendChild(hwLabel);

      const hw = document.createElement("p");
      hw.className = "hw muted";
      hw.textContent = d.homework || "";
      card.appendChild(hw);

      const actionsRow = document.createElement("div");
      actionsRow.className = "actions-row";
      actionsRow.style.marginTop = "8px";

      const editBtn = document.createElement("button");
      editBtn.className = "btn small";
      editBtn.dataset.edit = String(i);
      editBtn.textContent = "تعديل سريع";

      const copyBtn = document.createElement("button");
      copyBtn.className = "btn small";
      copyBtn.dataset.copy = String(i);
      copyBtn.textContent = `نسخ ${DAYS[i]}`;

      actionsRow.appendChild(editBtn);
      actionsRow.appendChild(copyBtn);
      card.appendChild(actionsRow);

      planFrag.appendChild(card);
    });

    DOM.plan.appendChild(planFrag);
    DOM.copyAllBtn.disabled = !(data.days && data.days.length);
  }

  // كليك داخل الخطة (تعديل / نسخ يوم)
  function handlePlanClick(e) {
    if (!currentPlan) return;
    const target = e.target;
    const editIdx = target.dataset.edit;
    const copyIdx = target.dataset.copy;

    if (editIdx !== undefined) {
      const i = Number(editIdx);
      const day = currentPlan.days[i];
      if (!day) return;

      const g = prompt(
        `عدّلي الأهداف ليوم ${DAYS[i]} (سطر لكل هدف):`,
        (day.goals || []).join("\n")
      );
      if (g != null) {
        day.goals = g
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
      }

      const v = prompt(
        `عدّلي المفردات ليوم ${DAYS[i]} (سطر لكل مفردة):`,
        (day.vocab || []).join("\n")
      );
      if (v != null) {
        day.vocab = v
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
      }

      renderPlan(currentPlan);
      return;
    }

    if (copyIdx !== undefined) {
      const j = Number(copyIdx);
      const day = currentPlan.days[j];
      if (!day) return;

      const txt = `${DAYS[j]} — ${currentPlan.meta.subject} (${currentPlan.meta.grade})${day.lesson ? " — «" + day.lesson + "»" : ""}

الأهداف:
- ${(day.goals || []).join("\n- ")}

المفردات الجديدة:
- ${(day.vocab || []).join("\n- ")}

النتائج المتوقعة:
${day.outcomes || ""}

واجب منزلي:
${day.homework || ""}
`;
      navigator.clipboard.writeText(txt);
      toast("نُسخ يوم " + DAYS[j] + " ✓");
    }
  }

  // نسخ الخطة كاملة
  function copyAll() {
    if (!currentPlan) return;
    const big = currentPlan.days
      .map(
        (day, i) => `${DAYS[i]}${day.lesson ? " — «" + day.lesson + "»" : ""}

الأهداف:
- ${(day.goals || []).join("\n- ")}

المفردات:
- ${(day.vocab || []).join("\n- ")}

النتائج المتوقعة:
${day.outcomes || ""}

الواجب:
${day.homework || ""}
`
      )
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(big);
    toast("نسخ الخطة كاملة ✓");
  }

  // استدعاء الـ Function
  async function generatePlan() {
    const subject = (DOM.subject.value || "").trim();
    const grade = DOM.grade.value;
    const count = Number(DOM.count.value) || 1;
    const lessons = [...$$(".lesson-name")]
      .map((i) => i.value.trim())
      .filter(Boolean);

    if (!subject) {
      toast("اكتبي مادة الدرس أولًا");
      DOM.subject.focus();
      return;
    }
    if (!lessons.length) {
      toast("اكتبي أسماء الدروس أولًا");
      const first = $(".lesson-name");
      if (first) first.focus();
      return;
    }

    DOM.status.textContent = "جارٍ التوليد…";
    DOM.genBtn.disabled = true;
    DOM.copyAllBtn.disabled = true;

    const token = await getAuthToken();
    if (!token) {
      DOM.status.textContent = "غير مصرح — سجّلي الدخول";
      toast("غير مصرح — سجّلي الدخول");
      DOM.genBtn.disabled = false;
      return;
    }

    try {
      const res = await fetch("/.netlify/functions/mueen-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ subject, grade, count, lessons }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || "server error");
      }

      const data = await res.json();
      renderPlan(data);
      DOM.status.textContent = "تم ✓";
    } catch (e) {
      console.error(e);
      DOM.status.textContent = "تعذر التوليد";
      toast("تعذر التوليد");
    } finally {
      DOM.genBtn.disabled = false;
    }
  }

  // init
  function init() {
    drawLessonInputs();
    DOM.count.addEventListener("change", drawLessonInputs);
    if (DOM.genBtn) DOM.genBtn.addEventListener("click", generatePlan);
    if (DOM.copyAllBtn) DOM.copyAllBtn.addEventListener("click", copyAll);
    if (DOM.plan) DOM.plan.addEventListener("click", handlePlanClick);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
