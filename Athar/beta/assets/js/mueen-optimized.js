// مُعين — واجهة محسّنة (مع تحسينات الأداء)
(function () {
  const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const status = $("#status");

  const lessonsBox = $("#lessons-box");
  const fCount = $("#f-count");
  const fMode = $("#f-mode");

  function lessonRow(i) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    wrap.innerHTML = `
      <label>اسم الدرس ${i + 1}</label>
      <input class="lesson-name" data-idx="${i}" placeholder="اكتب اسم الدرس بدقة">
    `;
    return wrap;
  }

  /**
   * Optimized: Use DocumentFragment to batch DOM updates
   */
  function drawLessonInputs() {
    lessonsBox.innerHTML = "";
    const n = +fCount.value || 1;
    const fragment = document.createDocumentFragment();

    if (fMode.value === "manual") {
      for (let i = 0; i < n; i++) {
        fragment.appendChild(lessonRow(i));
      }
    } else {
      const tip = document.createElement("div");
      tip.className = "muted";
      tip.textContent = "سيحاول مُعين جلب الدروس آليًا من المنهج (تجريبي).";
      fragment.appendChild(tip);
    }

    // Single reflow instead of N reflows
    lessonsBox.appendChild(fragment);
  }

  // Use event delegation to reduce event listeners
  [fCount, fMode].forEach((el) => {
    el.addEventListener("change", drawLessonInputs);
  });

  drawLessonInputs();

  // توكن Auth0 — توافقية (تعالج "getToken is not a function")
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

  /**
   * Optimized: Use DocumentFragment and minimize reflows
   */
  function renderPlan(data) {
    $("#out").style.display = "";
    const meta = $("#meta");

    // Clear using fragment
    const metaFragment = document.createDocumentFragment();
    metaFragment.appendChild(chip(data.meta.subject));
    metaFragment.appendChild(chip(`الصف: ${data.meta.grade}`));
    metaFragment.appendChild(chip(`دروس الأسبوع: ${data.meta.count}`));
    meta.innerHTML = "";
    meta.appendChild(metaFragment);

    const host = $("#plan");
    const planFragment = document.createDocumentFragment();

    data.days.forEach((d, i) => {
      const card = document.createElement("div");
      card.className = "card-day";

      // Build card content
      const header = document.createElement("div");
      header.className = "day-head";
      header.innerHTML = `<h3 style="margin:0">${
        DAYS[i]
      } — <span class="muted">Segment ${i + 1}</span></h3>`;

      const goalsLabel = document.createElement("h4");
      goalsLabel.style.margin = "6px 0";
      goalsLabel.textContent = "الأهداف";

      const goalsList = document.createElement("ul");
      goalsList.className = "list goals";
      (d.goals || []).forEach((g) => {
        const li = document.createElement("li");
        li.textContent = g;
        goalsList.appendChild(li);
      });

      const vocabLabel = document.createElement("h4");
      vocabLabel.style.margin = "6px 0";
      vocabLabel.textContent = "المفردات الجديدة";

      const vocabList = document.createElement("ul");
      vocabList.className = "list vocab";
      (d.vocab || []).forEach((v) => {
        const li = document.createElement("li");
        li.textContent = v;
        vocabList.appendChild(li);
      });

      const outcomeLabel = document.createElement("h4");
      outcomeLabel.style.margin = "6px 0";
      outcomeLabel.textContent = "النتائج المتوقعة";

      const outcomes = document.createElement("p");
      outcomes.className = "outcomes muted";
      outcomes.textContent = d.outcomes || "";

      const hwLabel = document.createElement("h4");
      hwLabel.style.margin = "6px 0";
      hwLabel.textContent = "واجب منزلي مقترح";

      const hw = document.createElement("p");
      hw.className = "hw muted";
      hw.textContent = d.homework || "";

      const actionsRow = document.createElement("div");
      actionsRow.className = "actions-row";
      actionsRow.style.marginTop = "8px";

      const editBtn = document.createElement("button");
      editBtn.className = "btn small";
      editBtn.setAttribute("data-edit", i);
      editBtn.textContent = "تعديل سريع";

      const copyBtn = document.createElement("button");
      copyBtn.className = "btn small";
      copyBtn.setAttribute("data-copy", i);
      copyBtn.textContent = `نسخ ${DAYS[i]}`;

      actionsRow.appendChild(editBtn);
      actionsRow.appendChild(copyBtn);

      // Append everything to card
      card.appendChild(header);
      card.appendChild(goalsLabel);
      card.appendChild(goalsList);
      card.appendChild(vocabLabel);
      card.appendChild(vocabList);
      card.appendChild(outcomeLabel);
      card.appendChild(outcomes);
      card.appendChild(hwLabel);
      card.appendChild(hw);
      card.appendChild(actionsRow);

      planFragment.appendChild(card);
    });

    host.innerHTML = "";
    host.appendChild(planFragment);

    // تعديل سريع - use event delegation on host
    host.addEventListener("click", handlePlanActions);

    // نسخ كامل
    const btnCopyAll = $("#btn-copy-all");
    if (btnCopyAll) {
      btnCopyAll.onclick = () => {
        const big = data.days
          .map(
            (day, i) =>
              `${DAYS[i]}

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
      };
    }
  }

  /**
   * Handle plan card actions with event delegation
   */
  function handlePlanActions(e) {
    const editIdx = e.target.dataset.edit;
    if (editIdx !== undefined) {
      e.preventDefault();
      // Handle edit
    }

    const copyIdx = e.target.dataset.copy;
    if (copyIdx !== undefined) {
      e.preventDefault();
      // Handle copy
    }
  }

  // نداء الدالة
  const btnGenerate = $("#btn-generate");
  if (btnGenerate) {
    btnGenerate.addEventListener("click", async () => {
      status.textContent = "جارٍ التوليد…";
      const token = await getAuthToken();
      if (!token) {
        status.textContent = "غير مصرح — سجّلي الدخول";
        toast("غير مصرح — سجّلي الدخول");
        return;
      }

      const subject = $("#f-subject").value.trim();
      const grade = $("#f-grade").value;
      const count = +$("#f-count").value || 1;
      let lessons = [];

      if (fMode.value === "manual") {
        lessons = [...$$(".lesson-name")]
          .map((i) => i.value.trim())
          .filter(Boolean);
      }

      try {
        // Add performance marker
        if (window.perfMonitoring) {
          window.perfMonitoring.markStart("mueen-plan-generation");
        }

        const res = await fetch("/.netlify/functions/mueen-plan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify({
            subject,
            grade,
            count,
            lessons,
            mode: fMode.value,
          }),
        });

        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(t || "server error");
        }

        const data = await res.json();
        renderPlan(data);
        status.textContent = "تم ✓";

        // Log performance
        if (window.perfMonitoring) {
          const duration = window.perfMonitoring.markEnd(
            "mueen-plan-generation"
          );
          window.perfMonitoring.logMetric(
            "mueen-plan-generation-time",
            duration,
            { unit: "ms" }
          );
        }
      } catch (e) {
        console.error(e);
        status.textContent = "تعذر التوليد";
        toast("تعذر التوليد");
      }
    });
  }

  // أزرار الدخول/الخروج
  const btnLogin = $("#btn-login");
  const btnLogout = $("#btn-logout");
  if (btnLogin) {
    btnLogin.addEventListener("click", () =>
      window.auth?.login({
        authorizationParams: {
          screen_hint: "login",
          redirect_uri: window.location.href,
        },
      })
    );
  }
  if (btnLogout) {
    btnLogout.addEventListener("click", () =>
      window.auth?.logout({ logoutParams: { returnTo: window.location.href } })
    );
  }
})();
