document.addEventListener("DOMContentLoaded", () => {
  // ========= البيانات =========
  const SUBJECTS = {
    "primary-lower": [
      "اللغة العربية",
      "الرياضيات",
      "العلوم",
      "مهارات رقمية",
      "اللغة الإنجليزية",
      "الدراسات الإسلامية",
      "التربية الفنية",
      "التربية البدنية والدفاع عن النفس",
      "مهارات حياتية وأسرية",
    ],
    "primary-upper": [
      "اللغة العربية",
      "الرياضيات",
      "العلوم",
      "المهارات الرقمية",
      "اللغة الإنجليزية",
      "الدراسات الإجتماعية",
      "الدراسات الإسلامية",
      "التفكير الناقد",
      "التربية الفنية",
      "التربية البدنية والدفاع عن النفس",
    ],
    middle: [
      "اللغة العربية",
      "الرياضيات",
      "العلوم",
      "اللغة الإنجليزية",
      "الدراسات الإجتماعية",
      "الدراسات الإسلامية",
      "التفكير الناقد والمنطق",
      "مهارات رقمية",
      "التربية الفنية",
      "التربية البدنية والدفاع عن النفس",
    ],
    secondary: [
      "الفيزياء",
      "الكيمياء",
      "الأحياء",
      "الرياضيات",
      "اللغة العربية",
      "اللغة الإنجليزية",
      "التاريخ",
      "الدراسات الإسلامية",
      "مهارات رقمية",
      "علم الأرض والفضاء",
      "التفكير الناقد",
    ],
  };

  // ========= عناصر الواجهة =========
  const $ = (s) => document.querySelector(s);
  const stageSel = $("#stage");
  const subjectSel = $("#subject");
  const bloomSel = $("#type"); // مهم: id الصحيح
  const lessonInp = $("#lesson");
  const prefSel = $("#preferred"); // جديد
  const goBtn = $("#go");
  const regenBtn = $("#regen");
  const statusEl = $("#status");

  // تعبئة المواد عند تغيير المرحلة
  stageSel.addEventListener("change", () => {
    const s = stageSel.value;
    subjectSel.innerHTML =
      '<option value="" selected disabled>اختر المادة</option>';
    (SUBJECTS[s] || []).forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      subjectSel.appendChild(opt);
    });
    subjectSel.disabled = !(SUBJECTS[s] && SUBJECTS[s].length);
  });

  const readStageLabel = (v) =>
    ({
      "primary-lower": "ابتدائي — دنيا",
      "primary-upper": "ابتدائي — عليا",
      middle: "متوسط",
      secondary: "ثانوي",
    }[v] || v);
  const safe = (s) =>
    String(s || "").replace(
      /[<>&]/g,
      (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[ch])
    );
  const listTo = (ul, arr) => {
    if (!ul) return;
    const a = Array.isArray(arr) ? arr : [];
    ul.innerHTML = a.map((x) => `<li>${safe(x)}</li>`).join("");
  };

  function setLoading(on) {
    if (on) {
      goBtn.dataset._label = goBtn.textContent;
      goBtn.textContent = "قيد الإبداع … ✨";
      goBtn.disabled = true;
      regenBtn.disabled = true;
    } else {
      goBtn.textContent = goBtn.dataset._label || "✨ساعدني على الإبداع";
      goBtn.disabled = false;
      regenBtn.disabled = false;
    }
  }

  // ========= الاتصال بالخادم =========
  async function callStrategy(payload) {
    let token = null;
    try {
      if (window.auth?.getTokenSilently) {
        token = await window.auth.getTokenSilently();
      }
    } catch (e) {
      console.warn("Failed to get token:", e);
    }

    if (!token) {
      throw new Error("يرجى تسجيل الدخول أولاً");
    }

    const res = await fetch("/.netlify/functions/strategy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`رد غير متوقع من الخادم:\n${text}`);
    }
    return data;
  }

  // ========= طباعة الناتج =========
  function paintOutput(data, meta) {
    $("#title").textContent = data.strategy_name || "—";

    const chips = [];
    if (meta.stage) chips.push(meta.stageLabel || meta.stage);
    if (meta.subject) chips.push(meta.subject);
    if (data.bloom || meta.bloomType) chips.push(data.bloom || meta.bloomType);
    if (meta.lesson) chips.push("الدرس: " + meta.lesson);
    $("#chips").innerHTML = chips
      .map((t) => `<span class="chip">${t}</span>`)
      .join("");

    $("#importance").textContent = data.importance || "—";
    $("#materials").textContent = data.materials || "—";
    $("#assessment").textContent = data.assessment || "—";
    $("#impact").textContent = data.expected_impact || "—";

    const diffUl = $("#diff");
    diffUl.innerHTML = "";
    [
      ["دعم: ", data.diff_support],
      ["أساسي: ", data.diff_core],
      ["تحدّي: ", data.diff_challenge],
    ].forEach(([k, v]) => {
      if (v) {
        const li = document.createElement("li");
        li.textContent = k + v;
        diffUl.appendChild(li);
      }
    });

    listTo($("#goals"), data.goals);
    listTo($("#steps"), data.steps);
    listTo($("#examples"), data.examples);

    const citesUl = $("#cites");
    citesUl.innerHTML = "";
    (data.citations || []).forEach((c) => {
      if (!c || !c.title) return;
      const li = document.createElement("li");
      li.innerHTML = `<strong>${safe(c.title)}</strong>${
        c.benefit
          ? `<p class="muted" style="margin:4px 0 0">${safe(c.benefit)}</p>`
          : ""
      }`;
      citesUl.appendChild(li);
    });

    $("#out").style.display = "block";
    $("#err").style.display = "none";
    $("#regen").style.display = "inline-flex";
  }

  // ——— حاجز تكرار ———
  const SEEN_KEY = "muntaq_seen_v1";
  const loadSeen = () => {
    try {
      return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) || "[]"));
    } catch (_) {
      return new Set();
    }
  };
  const saveSeen = (set) => {
    try {
      sessionStorage.setItem(SEEN_KEY, JSON.stringify([...set]));
    } catch (_) {}
  };
  const signatureOf = (d) => {
    const parts = [
      d?.strategy_name || "",
      (d?.goals || [])[0] || "",
      (d?.steps || [])[0] || "",
      (d?.steps || [])[1] || "",
      (d?.examples || [])[0] || "",
    ]
      .join("||")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    let h = 0;
    for (let i = 0; i < parts.length; i++) {
      h = (h << 5) - h + parts.charCodeAt(i);
      h |= 0;
    }
    return String(h);
  };

  // ========= التوليد =========
  async function generate(variant = null, _retry = 0) {
    const stage = stageSel.value;
    const subject = subjectSel.value;
    const bloom = bloomSel.value;
    const lesson = (lessonInp.value || "").trim();
    const preferred = (prefSel.value || "").trim(); // جديد

    if (!stage || !subject) {
      $("#err").style.display = "block";
      return;
    }
    $("#err").style.display = "none";
    $("#dbg").style.display = "none"; // إخفاء صندوق التشخيص السابق
    statusEl.textContent = "جاري تحويل شغفك إلى استراتيجية ملموسة …✨";
    setLoading(true);

    try {
      // ← هنا نرسل preferred للباكند (بدون أي تغيير في شكل الإخراج)
      const data = await callStrategy({
        stage,
        subject,
        bloomType: bloom,
        lesson,
        variant: variant || Math.floor(Math.random() * 1e9),
        preferred, // قد يكون فارغًا — وهذا مقبول
      });

      const meta = {
        stage,
        stageLabel: readStageLabel(stage),
        subject,
        bloomType: bloom,
        lesson,
      };

      // رد تشخيصي؟
      if (data && data.debug === "incomplete") {
        if (data.parsed && typeof data.parsed === "object") {
          paintOutput(data.parsed, meta);
        }
        const dbg = $("#dbg"),
          raw = $("#dbg-raw");
        if (dbg && raw) {
          raw.textContent = data.rawText || "(لا يوجد نص خام)";
          dbg.style.display = "block";
        }
        statusEl.textContent = "تم (تشخيص) ✨";
        return;
      }

      // رد مكتمل
      const seen = loadSeen();
      const sig = signatureOf(data);
      if (seen.has(sig) && _retry < 3) {
        return await generate(
          Date.now() + Math.floor(Math.random() * 1e6),
          _retry + 1
        );
      }
      seen.add(sig);
      saveSeen(seen);

      paintOutput(data, meta);
      statusEl.textContent = "تـــم ✨";
    } catch (err) {
      console.error(err);
      statusEl.textContent = err.message || "تعذّر التوليد.";
    } finally {
      setLoading(false);
    }
  }

  // أزرار
  goBtn.addEventListener("click", () => generate(null));
  regenBtn.addEventListener("click", () => generate(Date.now()));

  // نسخ
  $("#copy")?.addEventListener("click", async () => {
    const text = $("#out").innerText;
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      alert("تم النسخ ✓");
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        alert("تم النسخ ✓");
      } finally {
        document.body.removeChild(ta);
      }
    }
  });
});
