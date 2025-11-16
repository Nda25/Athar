// assets/js/mithaq.js

// ==========================================
// 1. تعريف الثوابت والمتغيرات العامة
// ==========================================
const MITHAQ_STAGES = {
  p1: "ابتدائي دُنيا",
  p2: "ابتدائي عُليا",
  m: "متوسط",
  h: "ثانوي",
};
const MITHAQ_SEEN_KEY = "mithaq_seen_v1";

// جلب عناصر DOM مرة واحدة
const MITHAQ_DOM = {
  subj: document.getElementById("subj"),
  topic: document.getElementById("topic"),
  stage: document.getElementById("stage"),
  cardsWrap: document.getElementById("cards"),
  out: document.getElementById("out"),
  copyBtn: document.getElementById("copy"),
  printBtn: document.getElementById("print"),
  toast: document.getElementById("toast"),
  genBtn: document.getElementById("gen"),
};

// إدارة الجلسة (عدم التكرار) باستخدام Set
const mithaqSeenSet = new Set(
  (() => {
    try {
      return JSON.parse(sessionStorage.getItem(MITHAQ_SEEN_KEY) || "[]");
    } catch {
      return [];
    }
  })()
);

// ==========================================
// 2. دوال مساعدة
// ==========================================

const mithaqToast = (msg) => {
  if (!MITHAQ_DOM.toast) {
    alert(msg);
    return;
  }
  MITHAQ_DOM.toast.textContent = msg;
  MITHAQ_DOM.toast.classList.add("show");
  setTimeout(() => MITHAQ_DOM.toast.classList.remove("show"), 1200);
};

// تنظيف النص من Markdown والرموز
const mithaqClean = (t) =>
  String(t || "")
    .replace(/\*\*?|##+|^\s*-\s*/gm, "")
    .trim();

// وسم/شيب بسيط
const mithaqChip = (t) => `<span class="tag">${t}</span>`;

// بصمة فريدة للبطاقة
const mithaqSigOf = (card) => {
  const s =
    ((card?.category || "") +
      "|" +
      (card?.title || "") +
      "|" +
      (card?.idea || "")).toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return String(h);
};

const mithaqSaveSeen = () => {
  try {
    sessionStorage.setItem(MITHAQ_SEEN_KEY, JSON.stringify([...mithaqSeenSet]));
  } catch (_) {}
};

// بيانات الميتا للتحليلات
const mithaqMeta = () => ({
  subject: (MITHAQ_DOM.subj?.value || "").trim() || null,
  topic: (MITHAQ_DOM.topic?.value || "").trim() || null,
  stage: MITHAQ_DOM.stage?.value || null,
});

// دالة تسجيل الاستخدام (Logging)
const mithaqLogUsage = async (action) => {
  if (typeof supaLogToolUsage === "function") {
    try {
      await supaLogToolUsage(action, mithaqMeta());
    } catch (_) {}
  }
};

// ==========================================
// 3. الوظائف الرئيسية
// ==========================================

// عرض الهيكل العظمي (Skeleton)
const mithaqShowSkeleton = (n = 4) => {
  MITHAQ_DOM.cardsWrap.innerHTML = '<div class="skeleton"></div>'.repeat(n);
};

// استدعاء Function من الخادم
const fetchMithaq = async (subject, topic, stage) => {
  if (!window.auth) {
    mithaqToast("خطأ: المصادقة غير جاهزة");
    throw new Error("Auth0 client not ready");
  }

  try {
    const accessToken = await window.auth.getTokenSilently();
    const res = await fetch("/.netlify/functions/gemini-mithaq", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ subject, topic, stage }),
    });

    if (!res.ok) {
      if (res.status === 401) mithaqToast("خطأ 401: التوكن غير صالح.");
      throw new Error("fn_error");
    }
    return res.json();
  } catch (e) {
    console.error("Error fetching mithaq", e);
    if (e.message !== "fn_error") mithaqToast("خطأ في الاتصال، حاولي مجدداً");
    throw e;
  }
};

const mithaqCategoryLabel = (code) => {
  switch ((code || "").toLowerCase()) {
    case "deen":
      return "ربط بالدين";
    case "watan":
      return "ربط بالوطن";
    case "subject":
      return "ربط بمادة أخرى";
    case "life":
      return "ربط بالحياة الواقعية";
    case "world":
      return "ربط بالدول الأخرى";
    default:
      return "";
  }
};

// رسم البطاقات
const mithaqRenderCards = (container, cards, subject, topic, stage) => {
  container.innerHTML = "";
  if (!cards?.length) return;

  const fragment = document.createDocumentFragment();

  cards.forEach((c) => {
    const title = mithaqClean(c.title) || "— بطاقة ربط —";
    const brief = mithaqClean(c.brief) || "—";
    const idea = mithaqClean(c.idea) || "—";
    const catLabel = mithaqCategoryLabel(c.category);

    const card = document.createElement("div");
    card.className = "idea";
    card.innerHTML = `
      <div class="tags" style="margin-bottom:6px">
        ${catLabel ? mithaqChip(catLabel) : ""}
        ${mithaqChip(subject)}
        ${topic ? mithaqChip(topic) : ""}
        ${mithaqChip(MITHAQ_STAGES[stage] || stage)}
        ${mithaqChip("ميثاق")}
      </div>
      <h4>• ${title}</h4>
      <p class="muted"><strong>فكرة الربط:</strong> ${brief}</p>
      <p><strong>صيغة جاهزة للربط داخل الدرس:</strong> ${idea}</p>
    `;
    fragment.appendChild(card);
  });

  container.appendChild(fragment);
};

// عند تحميل الصفحة
window.addEventListener("load", () => {
  if (typeof supaEnsureUserProfile === "function") {
    try {
      supaEnsureUserProfile();
    } catch (_) {}
  }
});

// زر التوليد
MITHAQ_DOM.genBtn.addEventListener("click", async () => {
  const subject = (MITHAQ_DOM.subj.value || "").trim();
  const topic = (MITHAQ_DOM.topic.value || "").trim();
  const stage = MITHAQ_DOM.stage.value;

  if (!subject) return mithaqToast("اكتبي اسم المادة أولًا.");
  if (!topic) return mithaqToast("اكتبي موضوع الدرس أولًا.");

  MITHAQ_DOM.out.style.display = "block";
  mithaqShowSkeleton();
  MITHAQ_DOM.copyBtn.disabled = true;
  MITHAQ_DOM.printBtn.disabled = true;

  try {
    const { ok, cards = [], _meta = {} } = await fetchMithaq(
      subject,
      topic,
      stage
    );

    // تصفية المكرر
    const uniqCards = cards.filter((c) => {
      const sig = mithaqSigOf(c);
      if (mithaqSeenSet.has(sig)) return false;
      mithaqSeenSet.add(sig);
      return true;
    });
    mithaqSaveSeen();

    const finalCards = uniqCards.length ? uniqCards : cards;
    mithaqRenderCards(MITHAQ_DOM.cardsWrap, finalCards, subject, topic, stage);

    const hasResults = MITHAQ_DOM.cardsWrap.children.length > 0;
    MITHAQ_DOM.copyBtn.disabled = !hasResults;
    MITHAQ_DOM.printBtn.disabled = !hasResults;

    mithaqToast(ok ? "تم توليد بطاقات الربط ✨" : "تم عرض بطاقات بديلة");
    mithaqLogUsage("mithaq_generate");
  } catch (e) {
    console.error(e);
    MITHAQ_DOM.cardsWrap.innerHTML =
      '<div class="muted">تعذّر جلب بطاقات الربط الآن.</div>';
  }
});

// زر النسخ
MITHAQ_DOM.copyBtn.addEventListener("click", async () => {
  const text = [...document.querySelectorAll(".idea")]
    .map((d) => d.innerText)
    .join("\n\n— — —\n\n");
  if (!text.trim()) {
    mithaqToast("لا توجد بطاقات لنسخها.");
    return;
  }
  await navigator.clipboard.writeText(text);
  mithaqToast("تم النسخ ✅");
  mithaqLogUsage("mithaq_copy");
});

// زر الطباعة
MITHAQ_DOM.printBtn.addEventListener("click", async () => {
  window.print();
  mithaqLogUsage("mithaq_print");
});
