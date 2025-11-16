// مُعين — خطة أسبوعية لعدة دروس، كل يوم لدرس واحد فقط
// نفس روح ميثاق/إثراء: Auth0 + استدعاء Function جاهز

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
    canonBox: $("#canon"),
    canonGoals: $("#canon-goals"),
    canonVocab: $("#canon-vocab"),
    plan: $("#plan"),
    genBtn: $("#btn-generate"),
    copyAllBtn: $("#btn-copy-all"),
    toast: $("#toast"),
  };

  let currentPlan = null;

  /* ===== Toast بسيط ===== */
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

  /* ===== رسم خانات الدروس حسب العدد ===== */
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

  /* ===== ميتا للاستخدام ===== */
  function metaForLog() {
    return {
      subject: (DOM.subject.value || "").trim() || null,
      grade: DOM.grade.value || null,
      count: DOM.count.value || null,
    };
  }

  async function logUsage(action, extra) {
    if (typeof supaLogToolUsage === "function") {
      try {
        await supaLogToolUsage(action, {
          tool: "mueen",
          ...(metaForLog() || {}),
          ...(extra || {}),
        });
      } catch (_) {}
    }
  }

  /* ===== استدعاء Function من السيرفر ===== */
  async function fetchPlan(subject, grade, count, lessons) {
    if (!window.auth) {
      toast("خطأ: المصادقة غير جاهزة");
      throw new Error("Auth0 client not ready");
    }

    let accessToken;
    try {
      accessToken = await window.auth.getTokenSilently();
    } catch (e) {
      console.error("getTokenSilently error", e);
      toast("خطأ في التحقق من الدخول، أعيدي المحاولة");
      throw e;
    }

    try {
      const res = await fetch("/.netlify/functions/mueen-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ subject, grade, count, lessons }),
      });

      if (res.status === 402) {
        toast("الاشتراك غير مُفعّل — راجعي صفحة الاشتراكات");
        throw new Error("membership_inactive");
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("mueen-plan error:", res.status, txt);
        toast("تعذر جلب الخطة، حاولي لاحقًا");
        throw new Error("fn_error");
      }

      return await res.json();
    } catch (e) {
      if (e.message !== "membership_inactive" && e.message !== "fn_error") {
        console.error("Network/other error:", e);
        toast("خطأ في الاتصال، حاولي مجددًا");
      }
      throw e;
    }
  }

  function createChip(txt) {
    const c = document.createElement("span");
    c.className = "chip";
    c.textContent = txt;
    return c;
  }

  /* ===== عرض Canon (أهداف + مفردات كل درس) ===== */
  function renderCanon(canon) {
    let list = [];
    if (Array.isArray(canon)) list = canon;
    else if (canon && typeof canon === "object") list = [canon];

    if (!list.length) {
      DOM.canonBox.style.display = "none";
      DOM.canonGoals.innerHTML = "";
      DOM.canonVocab.innerHTML = "";
      return;
    }

    DOM.canonBox.style.display = "block";

    DOM.canonGoals.innerHTML = "";
    DOM.canonVocab.innerHTML = "";

    list.forEach((c) => {
      const lessonName = c.lesson || c.lessonTitle || "الدرس";

      (c.objectives || []).forEach((g) => {
        const li = document.createElement("li");
        li.textContent = `«${lessonName}» — ${g}`;
        DOM.canonGoals.appendChild(li);
      });

      (c.vocab || []).forEach((v) => {
        const li = document.createElement("li");
        li.textContent = `«${lessonName}» — ${v}`;
        DOM.canonVocab.appendChild(li);
      });
    });
  }

  /* ===== عرض الخطة ===== */
  function renderPlan(data) {
    currentPlan = data || null;
    if (!data) return;

    DOM.out.style.display = "block";

    // meta
    DOM.meta.innerHTML = "";
    const fragMeta = document.createDocumentFragment();
    fragMeta.appendChild(createChip(data.meta.subject));
    fragMeta.appendChild(createChip(`الصف: ${data.meta.grade}`));
    fragMeta.appendChild(
      createChip(`عدد الدروس هذا الأسبوع: ${data.meta.count}`)
    );
    if (Array.isArray(data.meta.lessons)) {
      fragMeta.appendChild(
        createChip(`الدروس: ${data.meta.lessons.join(" | ")}`)
      );
    }
    DOM.meta.appendChild(fragMeta);

    // canon
    renderCanon(data.canon || []);

    // الأيام
    DOM.plan.innerHTML = "";
    const frag = document.createDocumentFragment();

    (data.days || []).forEach((d, i) => {
      const card = document.createElement("div");
      card.className = "card-day";

      const header = document.createElement("div");
      header.className = "day-head";
      const lessonLabel = d.lesson ? ` — «${d.lesson}»` : "";
      header.innerHTML = `<h3 style="margin:0">${DAYS[i]}${lessonLabel}</h3>`;
      card.appendChild(header);

      // الأهداف
      const goalsTitle = document.createElement("h4");
      goalsTitle.style.margin = "6px 0";
      goalsTitle.textContent = "الأهداف";
      card.appendChild(goalsTitle);

      const goalsList = document.createElement("ul");
      goalsList.className = "list goals";
      (d.goals || []).forEach((g) => {
        const li = document.createElement("li");
        li.textContent = g;
        goalsList.appendChild(li);
      });
      card.appendChild(goalsList);

      // المفردات
      const vocabTitle = document.createElement("h4");
      vocabTitle.style.margin = "6px 0";
      vocabTitle.textContent = "المفردات الجديدة";
      card.appendChild(vocabTitle);

      const vocabList = document.createElement("ul");
      vocabList.className = "list vocab";
      (d.vocab || []).forEach((v) => {
        const li = document.createElement("li");
        li.textContent = v;
        vocabList.appendChild(li);
      });
      card.appendChild(vocabList);

      // النتائج المتوقعة
      const outTitle = document.createElement("h4");
      outTitle.style.margin = "6px 0";
      outTitle.textContent = "النتائج المتوقعة";
      card.appendChild(outTitle);

      const outP = document.createElement("p");
      outP.className = "outcomes muted";
      outP.textContent = d.outcomes || "";
      card.appendChild(outP);

      // الواجب
      const hwTitle = document.createElement("h4");
      hwTitle.style.margin = "6px 0";
      hwTitle.textContent = "واجب منزلي مقترح";
      card.appendChild(hwTitle);

      const hwP = document.createElement("p");
      hwP.className = "hw muted";
      hwP.textContent = d.homework || "";
      card.appendChild(hwP);

      // أزرار اليوم
      const actionsRow = document.createElement("div");
      actionsRow.className = "actions-row";
      actionsRow.style.marginTop = "8px";

      const btnEdit = document.createElement("button");
      btnEdit.className = "btn small";
      btnEdit.dataset.edit = String(i);
      btnEdit.textContent = "تعديل سريع";

      const btnCopy = document.createElement("button");
      btnCopy.className = "btn small";
      btnCopy.dataset.copy = String(i);
      btnCopy.textContent = `نسخ ${DAYS[i]}`;

      actionsRow.appendChild(btnEdit);
      actionsRow.appendChild(btnCopy);
      card.appendChild(actionsRow);

      frag.appendChild(card);
    });

    DOM.plan.appendChild(frag);
    DOM.copyAllBtn.disabled = !(data.days && data.days.length);
  }

  /* ===== تعامل مع أزرار اليوم ===== */
  function handlePlanClick(e) {
    if (!currentPlan) return;
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    const editIdx = target.dataset.edit;
    const copyIdx = target.dataset.copy;

    // تعديل سريع
    if (editIdx !== undefined) {
      const i = Number(editIdx);
      if (!Number.isFinite(i)) return;
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

    // نسخ اليوم
    if (copyIdx !== undefined) {
      const j = Number(copyIdx);
      if (!Number.isFinite(j)) return;
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
      logUsage("mueen_copy_day", { day: DAYS[j], lesson: day.lesson || null });
    }
  }

  /* ===== نسخ الخطة كاملة ===== */
  function copyAll() {
    if (!currentPlan) return;
    const blocks = currentPlan.days.map((day, i) => {
      return `${DAYS[i]}${day.lesson ? " — «" + day.lesson + "»" : ""}

الأهداف:
- ${(day.goals || []).join("\n- ")}

المفردات:
- ${(day.vocab || []).join("\n- ")}

النتائج المتوقعة:
${day.outcomes || ""}

الواجب:
${day.homework || ""}
`;
    });

    const big = blocks.join("\n\n---\n\n");
    navigator.clipboard.writeText(big);
    toast("نسخ الخطة كاملة ✓");
    logUsage("mueen_copy_all");
  }

  /* ===== توليد الخطة ===== */
  async function onGenerate() {
    const subject = (DOM.subject.value || "").trim();
    const grade = DOM.grade.value;
    const count = Number(DOM.count.value) || 1;
    const lessons = [...$$(".lesson-name")]
      .map((i) => i.value.trim())
      .filter(Boolean);

    if (!subject) {
      toast("اكتبي مادة الدرس / مجاله أولًا");
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

    try {
      const data = await fetchPlan(subject, grade, count, lessons);
      renderPlan(data);
      DOM.status.textContent = "تم ✓";
      await logUsage("mueen_generate", { ok: true });
    } catch (e) {
      console.error(e);
      if (DOM.status.textContent === "جارٍ التوليد…") {
        DOM.status.textContent = "تعذر التوليد";
      }
      await logUsage("mueen_generate", {
        ok: false,
        error: String(e?.message || e),
      });
    } finally {
      DOM.genBtn.disabled = false;
    }
  }

  /* ===== init ===== */
  function init() {
    drawLessonInputs();
    DOM.count.addEventListener("change", drawLessonInputs);
    if (DOM.genBtn) DOM.genBtn.addEventListener("click", onGenerate);
    if (DOM.copyAllBtn)
      DOM.copyAllBtn.addEventListener("click", copyAll);
    if (DOM.plan) DOM.plan.addEventListener("click", handlePlanClick);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
