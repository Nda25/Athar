// ==========================================
// 1. تعريف الثوابت والمتغيرات العامة
// ==========================================
const STAGES = {
  p1: "ابتدائي دُنيا",
  p2: "ابتدائي عُليا",
  m: "متوسط",
  h: "ثانوي",
};
const SEEN_KEY = "ethraa_seen_v1";

// جلب عناصر DOM مرة واحدة لتحسين الأداء
const DOM = {
  subj: document.getElementById("subj"),
  stage: document.getElementById("stage"),
  focus: document.getElementById("focus"),
  cardsWrap: document.getElementById("cards"),
  nearbyWrap: document.getElementById("nearby"),
  nearbyBox: document.getElementById("nearbyBox"),
  out: document.getElementById("out"),
  copyBtn: document.getElementById("copy"),
  printBtn: document.getElementById("print"),
  toast: document.getElementById("toast"),
  genBtn: document.getElementById("gen"),
};

// إدارة الجلسة (عدم التكرار) باستخدام Set
const seenSet = new Set(
  (() => {
    try {
      return JSON.parse(sessionStorage.getItem(SEEN_KEY) || "[]");
    } catch {
      return [];
    }
  })()
);

// ==========================================
// 2. دوال مساعدة (Utility Functions)
// ==========================================

// دالة لعرض التنبيهات (Toast)
const toast = (msg) => {
  DOM.toast.textContent = msg;
  DOM.toast.classList.add("show");
  setTimeout(() => DOM.toast.classList.remove("show"), 1200);
};

// تنظيف النصوص من Markdown والرموز الزائدة
const clean = (t) =>
  String(t || "")
    .replace(/\*\*?|##+|^\s*-\s*/gm, "")
    .trim();

// إنشاء HTML للوسوم
const chip = (t) => `<span class="tag">${t}</span>`;

// إنشاء بصمة فريدة للبطاقة (Hash)
const sigOf = (card) => {
  const s = ((card?.title || "") + "|" + (card?.idea || "")).toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return String(h);
};

// حفظ البطاقات المرئية في الجلسة
const saveSeen = () => {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seenSet]));
  } catch (_) {}
};

// بيانات الميتا للتحليلات
const ethraaMeta = () => ({
  subject: (DOM.subj?.value || "").trim() || null,
  stage: DOM.stage?.value || null,
  focus: DOM.focus?.value || null,
});

// دالة تسجيل الاستخدام (Logging)
const logUsage = async (action) => {
  if (typeof supaLogToolUsage === "function") {
    try {
      await supaLogToolUsage(action, ethraaMeta());
    } catch (_) {}
  }
};

// ==========================================
// 3. الوظائف الرئيسية (Core Logic)
// ==========================================

// عرض الهيكل العظمي (Loading Skeleton)
const showSkeleton = (n = 4) => {
  DOM.cardsWrap.innerHTML = '<div class="skeleton"></div>'.repeat(n);
  DOM.nearbyBox.style.display = "none";
  DOM.nearbyWrap.innerHTML = "";
};

// جلب البيانات من الخادم
const fetchEthraa = async (subject, stage, focus) => {
  if (!window.auth) {
    toast("خطأ: المصادقة غير جاهزة");
    throw new Error("Auth0 client not ready");
  }

  try {
    const accessToken = await window.auth.getTokenSilently();
    const res = await fetch("/.netlify/functions/gemini-ethraa", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ subject, stage, focus }),
    });

    if (!res.ok) {
      if (res.status === 401) toast("خطأ 401: التوكن غير صالح.");
      throw new Error("fn_error");
    }
    return res.json();
  } catch (e) {
    console.error("Error fetching data", e);
    if (e.message !== "fn_error") toast("خطأ في الاتصال، حاول مجدداً");
    throw e;
  }
};

// رسم البطاقات في الواجهة
const renderCards = (container, cards, subject, stage) => {
  container.innerHTML = "";
  if (!cards?.length) return;

  // إنشاء العناصر دفعة واحدة (DocumentFragment) لتحسين الأداء
  const fragment = document.createDocumentFragment();

  cards.forEach((c) => {
    const title = clean(c.title) || "— بطاقة —";
    const brief = clean(c.brief) || "—";
    const idea = clean(c.idea) || "—";
    const sourceHTML = c.source
      ? `<div class="muted" style="font-size:.82rem;margin-top:6px">مصدر/مرجع: <a href="${c.source}" target="_blank" rel="noopener" style="text-decoration:underline">${c.source}</a></div>`
      : "";
    const staleHTML =
      c.freshness === "general"
        ? `<div class="muted" style="font-size:.82rem; margin-top:6px">عام</div>`
        : "";

    const card = document.createElement("div");
    card.className = "idea";
    card.innerHTML = `
      <h4>• ${title}</h4>
      <p class="muted"><strong>لماذا؟</strong> ${brief}</p>
      <p><strong>اقتراح:</strong> ${idea}</p>
      ${sourceHTML} ${staleHTML}
      <div class="tags">
        ${chip(subject)} ${chip(STAGES[stage] || stage)} ${chip("إثراء")}
      </div>`;
    fragment.appendChild(card);
  });

  container.appendChild(fragment);
};

// ==========================================
// 4. تهيئة الأحداث (Event Listeners)
// ==========================================

// عند تحميل الصفحة
window.addEventListener("load", () => {
  if (typeof supaEnsureUserProfile === "function") {
    try {
      supaEnsureUserProfile();
    } catch (_) {}
  }
});

// عند النقر على زر التوليد
DOM.genBtn.addEventListener("click", async () => {
  const s = (DOM.subj.value || "").trim();
  const st = DOM.stage.value;
  const fc = DOM.focus.value;

  if (!s) return toast("اكتبي المادة أولًا");

  DOM.out.style.display = "block";
  showSkeleton();
  DOM.copyBtn.disabled = true;
  DOM.printBtn.disabled = true;

  try {
    const { ok, cards = [], nearby, _meta = {} } = await fetchEthraa(s, st, fc);

    // تصفية البطاقات المكررة
    const uniqCards = cards.filter((c) => {
      const sig = sigOf(c);
      if (seenSet.has(sig)) return false;
      seenSet.add(sig);
      return true;
    });
    saveSeen();

    // عرض النتائج
    renderCards(DOM.cardsWrap, uniqCards.length ? uniqCards : cards, s, st);

    // عرض المقترحات القريبة إذا وجدت
    const hasNearby = _meta.all_stale && Array.isArray(nearby) && nearby.length;
    DOM.nearbyBox.style.display = hasNearby ? "block" : "none";
    if (hasNearby) renderCards(DOM.nearbyWrap, nearby, s, st);
    else DOM.nearbyWrap.innerHTML = "";

    // تحديث حالة الأزرار
    const hasResults = DOM.cardsWrap.children.length > 0;
    DOM.copyBtn.disabled = !hasResults;
    DOM.printBtn.disabled = !hasResults;

    toast(ok ? "تم ✨" : "عُرض بديل");
    logUsage("ethraa_generate");
  } catch (e) {
    console.error(e);
    DOM.cardsWrap.innerHTML =
      '<div class="muted">تعذّر جلب الإثراء الآن.</div>';
  }
});

// زر النسخ
DOM.copyBtn.addEventListener("click", async () => {
  const text = [...document.querySelectorAll(".idea")]
    .map((d) => d.innerText)
    .join("\n\n— — —\n\n");
  await navigator.clipboard.writeText(text);
  toast("تم النسخ ✅");
  logUsage("ethraa_copy");
});

// زر الطباعة
DOM.printBtn.addEventListener("click", async () => {
  window.print();
  logUsage("ethraa_print");
});
