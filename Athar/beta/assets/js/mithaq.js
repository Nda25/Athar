// assets/js/mithaq.js

(function () {
  const subjEl = document.getElementById("subj");
  const topicEl = document.getElementById("topic");
  const stageEl = document.getElementById("stage");

  const genBtn = document.getElementById("gen");
  const copyBtn = document.getElementById("copy");
  const printBtn = document.getElementById("print");

  const outBox = document.getElementById("out");
  const cardsBox = document.getElementById("cards");
  const toastEl = document.getElementById("toast");

  function showToast(msg) {
    if (!toastEl) {
      alert(msg);
      return;
    }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 2500);
  }

  function categoryLabel(code) {
    switch (code) {
      case "deen":
        return "ربط بالدين";
      case "watan":
        return "ربط بالوطن";
      case "subject":
        return "ربط بمادة أخرى";
      case "life":
        return "ربط بالحياة الواقعية";
      case "world":
        return "ربط بالدول الأخرى والعالم";
      default:
        return code || "";
    }
  }

  function renderCards(cards) {
    cardsBox.innerHTML = "";
    if (!Array.isArray(cards) || !cards.length) {
      outBox.style.display = "none";
      copyBtn.disabled = true;
      printBtn.disabled = true;
      return;
    }

    const frag = document.createDocumentFragment();
    for (const card of cards) {
      const wrap = document.createElement("div");
      wrap.className = "mini-card";

      const cat = document.createElement("div");
      cat.className = "badge";
      cat.textContent = categoryLabel(card.category);

      const title = document.createElement("h3");
      title.className = "mini-title";
      title.textContent = card.title || "";

      const brief = document.createElement("p");
      brief.className = "mini-brief";
      brief.textContent = card.brief || "";

      const idea = document.createElement("p");
      idea.className = "mini-idea";
      idea.textContent = card.idea || "";

      wrap.appendChild(cat);
      wrap.appendChild(title);
      wrap.appendChild(brief);
      wrap.appendChild(idea);

      frag.appendChild(wrap);
    }

    cardsBox.appendChild(frag);
    outBox.style.display = "block";
    copyBtn.disabled = false;
    printBtn.disabled = false;
  }

  async function generate() {
    const subject = (subjEl.value || "").trim();
    const topic = (topicEl.value || "").trim();
    const stage = stageEl.value || "h";

    if (!subject) {
      showToast("اكتبي اسم المادة أولًا.");
      subjEl.focus();
      return;
    }
    if (!topic) {
      showToast("اكتبي موضوع الدرس.");
      topicEl.focus();
      return;
    }

    genBtn.disabled = true;
    genBtn.textContent = "جاري التوليد…";
    copyBtn.disabled = true;
    printBtn.disabled = true;

    try {
      const body = { subject, topic, stage };

      let res;
      if (window.auth && typeof window.auth.fetchWithAuth === "function") {
        res = await window.auth.fetchWithAuth(
          "/.netlify/functions/gemini-mithaq",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          }
        );
      } else {
        res = await fetch("/.netlify/functions/gemini-mithaq", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      const data = await res.json().catch(() => ({}));

      if (data.ok && Array.isArray(data.cards)) {
        renderCards(data.cards);
        showToast("تم توليد بطاقات الربط.");
      } else if (data.parsed && Array.isArray(data.parsed.cards)) {
        renderCards(data.parsed.cards);
        showToast("تم توليد بطاقات (مع بعض الإصلاح).");
      } else {
        renderCards([]);
        console.error("mithaq debug:", data);
        showToast("تعذر توليد البطاقات، حاولي مرة أخرى.");
      }
    } catch (err) {
      console.error(err);
      renderCards([]);
      showToast("حدث خطأ غير متوقع.");
    } finally {
      genBtn.disabled = false;
      genBtn.textContent = "ولّدي بطاقات الربط";
    }
  }

  function collectTextForCopy() {
    const cards = cardsBox.querySelectorAll(".mini-card");
    const chunks = [];
    cards.forEach((card, idx) => {
      const cat = card.querySelector(".badge")?.textContent || "";
      const title = card.querySelector(".mini-title")?.textContent || "";
      const brief = card.querySelector(".mini-brief")?.textContent || "";
      const idea = card.querySelector(".mini-idea")?.textContent || "";

      chunks.push(
        `بطاقة ${idx + 1} — ${cat}\n` +
          `العنوان: ${title}\n` +
          `فكرة الربط: ${brief}\n` +
          `طريقة الربط داخل الشرح: ${idea}`
      );
    });
    return chunks.join("\n\n--------------------\n\n");
  }

  async function copyAll() {
    const txt = collectTextForCopy();
    if (!txt) {
      showToast("لا توجد بطاقات لنسخها.");
      return;
    }
    try {
      await navigator.clipboard.writeText(txt);
      showToast("تم نسخ جميع البطاقات.");
    } catch {
      showToast("تعذر النسخ، انسخي يدويًا.");
    }
  }

  function printAll() {
    const txt = collectTextForCopy();
    if (!txt) {
      showToast("لا توجد بطاقات للطباعة.");
      return;
    }
    const w = window.open("", "_blank");
    if (!w) return;

    w.document.write(`
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8" />
        <title>طباعة — ميثاق</title>
        <style>
          body { font-family: "Cairo", system-ui, sans-serif; padding: 24px; line-height: 1.8; }
          h1 { text-align: center; margin-bottom: 24px; }
          pre { white-space: pre-wrap; direction: rtl; }
        </style>
      </head>
      <body>
        <h1>بطاقات الربط — ميثــاق</h1>
        <pre>${txt.replace(/</g, "&lt;")}</pre>
        <script>window.print();<\/script>
      </body>
      </html>
    `);
    w.document.close();
  }

  if (genBtn) genBtn.addEventListener("click", generate);
  if (copyBtn) copyBtn.addEventListener("click", copyAll);
  if (printBtn) printBtn.addEventListener("click", printAll);
})();
