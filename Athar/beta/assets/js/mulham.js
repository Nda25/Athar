// ===== أدوات واجهة =====
window.$ = window.$ || ((s) => document.querySelector(s));
const liFill = (ul, items) => {
  ul.innerHTML = "";
  (items || []).forEach((t) => {
    const li = document.createElement("li");
    li.textContent = t;
    ul.appendChild(li);
  });
};
const olFill = (ol, items) => {
  ol.innerHTML = "";
  (items || []).forEach((t) => {
    const li = document.createElement("li");
    li.textContent = t;
    ol.appendChild(li);
  });
};

// upsert مستخدم للربط مع Supabase
window.addEventListener("load", () => {
  if (typeof supaEnsureUserProfile === "function") {
    try {
      supaEnsureUserProfile();
    } catch (_) {}
  }
});

// توست
(function () {
  const box = document.getElementById("toast");
  if (!box) return;
  window.toast = (msg, ms = 1600) => {
    box.textContent = msg;
    box.style.display = "block";
    clearTimeout(window.__t);
    window.__t = setTimeout(() => (box.style.display = "none"), ms);
  };
})();

// أوتو-حفظ
document.addEventListener("DOMContentLoaded", () => {
  bindAutoSave("mulham", "#mulham-form");
});

function mulhamMeta() {
  const get = (id) => document.getElementById(id);
  return {
    subject: (get("s-subj")?.value || "").trim() || null,
    topic: (get("s-topic")?.value || "").trim() || null,
    time: Number(get("s-time")?.value || 0) || null,
    bloom: get("s-bloom")?.value || null,
    age: get("s-age")?.value || null,
    noTools: !!get("s-noTools")?.checked,
    adaptLow: !!get("s-adaptLow")?.checked,
    adaptDiff: !!get("s-adaptDiff")?.checked,
  };
}

// ====== انتظار auth إن تأخر تحميله ======
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitAuth() {
  for (let i = 0; i < 60 && !window.auth; i++) {
    await wait(100);
  }
}

// === جلب التوكن بشكل متحمّل لكل الأسماء (getToken | getAccessTokenSilently | getTokenSilently) ===
async function callMulham(body) {
  await waitAuth();
  if (!window.auth) {
    throw new Error("نظام الدخول غير جاهز، أعيدي تحميل الصفحة.");
  }

  const getTokenFn =
    window.auth.getToken?.bind(window.auth) ||
    window.auth.getAccessTokenSilently?.bind(window.auth) ||
    window.auth.getTokenSilently?.bind(window.auth);

  if (!getTokenFn) {
    await window.auth.login?.({
      authorizationParams: {
        screen_hint: "login",
        redirect_uri: window.location.href,
      },
    });
    throw new Error("الرجاء تسجيل الدخول أولًا.");
  }

  const token = await getTokenFn({ audience: "https://api.athar" });

  const res = await fetch("/.netlify/functions/mulham", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error("غير مصرح — سجّلي الدخول");
    if (res.status === 402)
      throw new Error("الاشتراك غير نشط — فضلاً فعّلي اشتراكك");
    if (res.status === 403) throw new Error("لا تملكين صلاحية الوصول");
    const t = await res.text().catch(() => "");
    throw new Error(t || "Mulham function failed");
  }
  return res.json();
}

function readParams(withVariant = false) {
  const subject = $("#s-subj").value.trim() || "";
  const topic = $("#s-topic").value.trim() || subject;
  const time = +$("#s-time").value || 20;
  const bloom = $("#s-bloom").value || "understand";
  const age = $("#s-age").value || "p2";
  const noTools = !!$("#s-noTools").checked;
  const adaptLow = !!$("#s-adaptLow").checked;
  const adaptDiff = !!$("#s-adaptDiff").checked;
  const variant = String(Date.now()) + (withVariant ? "_more" : "_base");
  return {
    subject,
    topic,
    time,
    bloom,
    age,
    noTools,
    adaptLow,
    adaptDiff,
    variant,
  };
}

function renderSet(prefix, set, showDiff) {
  $(`#${prefix}-idea`).innerHTML = `<strong>مدخل الفكرة:</strong> ${
    set.ideaHook || "—"
  }`;
  $(`#${prefix}-desc`).textContent = set.desc || "—";
  $(`#${prefix}-dur`).textContent = `المدة: ${set.duration ?? "—"} د`;
  liFill($(`#${prefix}-mats`), set.materials || []);
  olFill($(`#${prefix}-steps`), set.steps || []);
  $(`#${prefix}-exit`).textContent = set.exitTicket || "—";
  $(`#${prefix}-impact`).textContent = set.expectedImpact || "—";

  const diffEl = $(`#${prefix}-diff`);
  if (showDiff && (set.diff?.lowMotivation || set.diff?.differentiation)) {
    diffEl.style.display = "";
    diffEl.innerHTML = `
        ${
          set.diff?.lowMotivation
            ? `<div><strong>للتحفيز المنخفض:</strong> ${set.diff.lowMotivation}</div>`
            : ""
        }
        ${
          set.diff?.differentiation
            ? `<div style="margin-top:6px"><strong>فروق فردية:</strong> ${set.diff.differentiation}</div>`
            : ""
        }
      `;
  } else {
    diffEl.style.display = "none";
    diffEl.innerHTML = "";
  }
}

function renderAll(data) {
  const meta = data.meta || {};
  const metaBox = $("#meta");
  metaBox.innerHTML = "";
  const ageMap = {
    p1: "ابتدائي دُنيا",
    p2: "ابتدائي عُليا",
    m: "متوسط",
    h: "ثانوي",
  };
  const chips = [
    meta.subject,
    meta.topic,
    `مرحلة: ${ageMap[meta.age] || meta.age || "—"}`,
    `بلوم: ${meta.bloom || "—"}`,
    `زمن: ${meta.time || meta.timeMins || "—"} د`,
  ];
  chips.forEach((v) => {
    if (v && String(v).trim() !== "") {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = v;
      metaBox.appendChild(chip);
    }
  });

  const showDiff = !!(meta.adaptLow || meta.adaptDiff);

  renderSet("mv", data.sets?.movement || {}, showDiff);
  renderSet("gr", data.sets?.group || {}, showDiff);
  renderSet("in", data.sets?.individual || {}, showDiff);

  liFill($("#tips"), data.tips || []);
  $("#out").style.display = "";
}

async function generate(withVariant = false) {
  const goBtn = document.getElementById("go");
  const moreBtn = document.getElementById("more");
  const busyBtn = withVariant ? moreBtn : goBtn;

  try {
    busyBtn.disabled = true;
    const oldText = busyBtn.textContent;
    busyBtn.textContent = "جارٍ التفكير…";

    const params = readParams(withVariant);
    const data = await callMulham(params);
    renderAll(data);

    toast(withVariant ? "تم توليد أنشطة أخرى ✨" : "تم توليد الأنشطة ✨");

    if (typeof supaLogToolUsage === "function") {
      const tag = withVariant ? "mulham_more" : "mulham_generate";
      try {
        await supaLogToolUsage(tag, mulhamMeta());
      } catch (_) {}
    }

    busyBtn.textContent = oldText;
    busyBtn.disabled = false;
  } catch (e) {
    console.error(e);
    toast(e?.message || "تعذّر التوليد، حاولي ثانية.");
    if (busyBtn) {
      busyBtn.textContent = withVariant ? "أنشطة أخرى" : "ولّد الأنشطة";
      busyBtn.disabled = false;
    }
  }
}

document.getElementById("go").addEventListener("click", () => generate(false));
document.getElementById("more").addEventListener("click", () => generate(true));

document.getElementById("copy").addEventListener("click", async () => {
  const grab = (sel) => $(sel)?.innerText?.trim() || "—";
  const pack = (sel) =>
    [...document.querySelectorAll(sel + " li")]
      .map((li) => "- " + li.innerText)
      .join("\n") || "—";

  const txt = `[مُلهم — ${new Date().toLocaleString()}]
${$("#meta").innerText}

[حركي]
${grab("#mv-idea")}
${grab("#mv-desc")}
مواد:
${pack("#mv-mats")}
خطوات:
${pack("#mv-steps")}
تذكرة خروج: ${grab("#mv-exit")}
الأثر المتوقع: ${grab("#mv-impact")}

[جماعي]
${grab("#gr-idea")}
${grab("#gr-desc")}
مواد:
${pack("#gr-mats")}
خطوات:
${pack("#gr-steps")}
تذكرة خروج: ${grab("#gr-exit")}
الأثر المتوقع: ${grab("#gr-impact")}

[فردي]
${grab("#in-idea")}
${grab("#in-desc")}
مواد:
${pack("#in-mats")}
خطوات:
${pack("#in-steps")}
تذكرة خروج: ${grab("#in-exit")}
الأثر المتوقع: ${grab("#in-impact")}

[تلميحات]
${pack("#tips")}
`;

  await navigator.clipboard.writeText(txt);
  toast("تم النسخ ✅");

  if (typeof supaLogToolUsage === "function") {
    try {
      await supaLogToolUsage("mulham_copy", mulhamMeta());
    } catch (_) {}
  }
});

document.getElementById("print").addEventListener("click", async () => {
  document.body.classList.add("print-mode");
  setTimeout(() => {
    window.print();
    setTimeout(() => document.body.classList.remove("print-mode"), 400);
  }, 60);

  if (typeof supaLogToolUsage === "function") {
    try {
      await supaLogToolUsage("mulham_print", mulhamMeta());
    } catch (_) {}
  }
});
