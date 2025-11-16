(function () {
  const $ = (sel) => document.querySelector(sel);
  const DB_KEY = "masar";
  const DEFAULT_DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس"];

  // تخزين المتغيرات DOM
  const tbl = $("#tbl");
  const tableWrap = $("#tableWrap");
  const [daysSel, periodsSel, startTime, slotMinsSel, orientSel] = [
    "#days",
    "#periods",
    "#startTime",
    "#slotMins",
    "#orient",
  ].map($);
  const [colorInp, mixInp, borderInp] = [
    "tblColor",
    "tblIntensity",
    "tblBorderIntensity",
  ].map((id) => document.getElementById(id));

  // دمج منطق التخزين
  const userDBOps = {
    get: () => (window.userDB?.get && userDB.get(DB_KEY, {})) || {},
    set: (obj) => window.userDB?.set(DB_KEY, obj || {}),
    merge: (partial) => {
      const current = userDBOps.get();
      userDBOps.set({ ...current, ...partial });
    },
  };

  // ربط المستخدم
  window.addEventListener("load", () => {
    if (typeof supaEnsureUserProfile === "function") {
      try {
        supaEnsureUserProfile();
      } catch (_) {}
    }
  });

  // بيانات التتبع
  const masarMeta = () => {
    const get = (el, def) => el?.value ?? def;
    const meta = userDBOps.get().__meta || {};
    return {
      days: daysSel.value === "sun-wed" ? 4 : 5,
      periods: parseInt(get(periodsSel, meta.periods ?? 7), 10) || 7,
      start_at: get(startTime, meta.startAt ?? "07:00"),
      slot_mins: parseInt(get(slotMinsSel, meta.slotMin ?? 50), 10) || 50,
      orient: get(orientSel, meta.orient ?? "periods-rows"),
      colors_on: !!meta.colorsOn,
    };
  };

  // إدارة الألوان
  const colorManager = {
    getMap: () => userDBOps.get().__colors || {},
    saveMap: (map) => {
      const all = userDBOps.get();
      all.__colors = map;
      userDBOps.set(all);
    },
    getColor: (subj) => {
      if (!subj) return "";
      const map = colorManager.getMap();
      if (!map[subj]) {
        let h = 0;
        for (let i = 0; i < subj.length; i++)
          h = (h * 31 + subj.charCodeAt(i)) % 360;
        map[subj] = `hsl(${h} 70% 88%)`;
        colorManager.saveMap(map);
      }
      return map[subj];
    },
    apply: () => {
      const map = colorManager.getMap();
      tbl.querySelectorAll("td .cell").forEach((cell) => {
        const subj = cell.querySelector('input[name^="subj_"]')?.value.trim();
        cell.style.background =
          window.__colorsOn && subj
            ? map[subj] || colorManager.getColor(subj)
            : "";
      });
    },
  };

  // عمليات الوقت
  const timeOps = {
    toMins: (t) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    },
    toStr: (m) =>
      `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(
        2,
        "0"
      )}`,
    build: (start, slot, count) => {
      const out = [];
      let m = timeOps.toMins(start);
      for (let i = 0; i < count; i++) {
        const from = timeOps.toStr(m);
        m += slot;
        out.push(`${from}—${timeOps.toStr(m)}`);
      }
      return out;
    },
  };

  // إنشاء الخلايا
  const makeCell = (r, c, saved) => {
    const key = `r${r}c${c}`;
    const {
      subj = "",
      class: clsVal = "",
      room: roomVal = "",
    } = saved[key] || {};
    const td = document.createElement("td");

    td.innerHTML = `
      <div class="cell ${!(subj || clsVal || roomVal) ? "empty" : ""}">
        <input placeholder="المادة" value="${subj}" name="subj_${key}">
        <div class="mini">
          <input placeholder="الصف/الفصل" value="${clsVal}" name="class_${key}">
          <input placeholder="الشعبة" value="${roomVal}" name="room_${key}">
        </div>
      </div>
    `;

    const wrap = td.firstElementChild;
    const [s, cls, room] = wrap.querySelectorAll("input");

    const persist = (ev) => {
      const cur = userDBOps.get();
      cur[key] = { subj: s.value, class: cls.value, room: room.value };
      userDBOps.set(cur);
      wrap.classList.toggle("empty", !(s.value || cls.value || room.value));
      if (ev?.target === s) colorManager.apply();
    };

    wrap.addEventListener("input", persist); // استماع واحد على الحاوية
    return td;
  };

  // بناء الجدول
  const buildTable = () => {
    const days =
      daysSel.value === "sun-wed" ? DEFAULT_DAYS.slice(0, 4) : DEFAULT_DAYS;
    const periods = parseInt(periodsSel?.value, 10) || 7;
    const times = timeOps.build(
      startTime?.value || "07:00",
      parseInt(slotMinsSel?.value, 10) || 50,
      periods
    );
    const saved = userDBOps.get();
    const orient = orientSel?.value || "periods-rows";
    const isRowOrient = orient === "periods-rows";

    let html =
      "<thead><tr><th>" +
      (isRowOrient ? "الوقت \\ اليوم" : "اليوم \\ الوقت") +
      "</th>";
    const headerItems = isRowOrient ? days : times;
    headerItems.forEach(
      (item) =>
        (html += `<th class="${isRowOrient ? "day" : "time"}-col">${item}</th>`)
    );
    html += "</tr></thead><tbody>";

    const rowsCount = isRowOrient ? periods : days.length;
    const colsCount = isRowOrient ? days.length : periods;

    // بناء الصفوف باستخدام DocumentFragment للأداء
    const frag = document.createDocumentFragment();
    const tempTable = document.createElement("table"); // حاوية مؤقتة

    for (let i = 0; i < rowsCount; i++) {
      const tr = document.createElement("tr");
      const firstCell = document.createElement("td");
      firstCell.className = isRowOrient ? "time-col" : "day-col";
      firstCell.textContent = (isRowOrient ? times : days)[i] || "";
      tr.appendChild(firstCell);

      for (let j = 0; j < colsCount; j++) {
        tr.appendChild(
          makeCell(isRowOrient ? i : j, isRowOrient ? j : i, saved)
        );
      }
      frag.appendChild(tr);
    }

    tempTable.innerHTML = html; // وضع الهيدر
    const tbody = document.createElement("tbody");
    tbody.appendChild(frag);
    tempTable.appendChild(tbody);

    tbl.replaceChildren(...tempTable.children); // تحديث الجدول دفعة واحدة
    colorManager.apply();

    userDBOps.merge({
      __meta: {
        days,
        periods,
        startAt: startTime.value,
        slotMin: slotMinsSel.value,
        orient,
        colorsOn: !!window.__colorsOn,
      },
    });
  };

  // CSV
  const csvOps = {
    generate: () => {
      const saved = userDBOps.get();
      const m = saved.__meta || {};
      const days =
        m.days ||
        (daysSel.value === "sun-wed" ? DEFAULT_DAYS.slice(0, 4) : DEFAULT_DAYS);
      const periods = m.periods || parseInt(periodsSel.value, 10) || 7;
      const times = timeOps.build(
        m.startAt || startTime.value || "07:00",
        m.slotMin || parseInt(slotMinsSel.value, 10) || 50,
        periods
      );

      const rows = [["اليوم", "الزمن", "المادة", "الصف/الفصل", "الشعبة"]];
      for (let r = 0; r < periods; r++) {
        for (let c = 0; c < days.length; c++) {
          const cell = saved[`r${r}c${c}`] || {};
          rows.push(
            [days[c], times[r], cell.subj, cell.class, cell.room].map(
              (x) => x || ""
            )
          );
        }
      }
      return (
        "\uFEFF" +
        rows
          .map((r) =>
            r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")
          )
          .join("\r\n")
      );
    },
    download: () => {
      const blob = new Blob([csvOps.generate()], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `masar-schedule-${new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:T]/g, "-")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
  };

  // Theme
  const themeManager = {
    apply: () => {
      const root = document.documentElement.style;
      if (colorInp) root.setProperty("--table-accent", colorInp.value);
      if (mixInp) root.setProperty("--table-mix", mixInp.value + "%");
      if (borderInp)
        root.setProperty("--table-border-mix", borderInp.value + "%");
    },
    save: () =>
      userDBOps.merge({
        __theme: {
          accent: colorInp?.value,
          mix: mixInp?.value,
          borderMix: borderInp?.value,
        },
      }),
    load: () => {
      const th = userDBOps.get().__theme || {};
      if (th.accent && colorInp) colorInp.value = th.accent;
      if (th.mix && mixInp) mixInp.value = th.mix;
      if (th.borderMix && borderInp) borderInp.value = th.borderMix;
      themeManager.apply();
    },
  };

  // Events Setup
  const setupEvents = () => {
    $("#addRow")?.addEventListener("click", () => {
      periodsSel.value = String((parseInt(periodsSel.value, 10) || 7) + 1);
      buildTable();
    });

    $("#addCol")?.addEventListener("click", () => {
      daysSel.value = "sun-thu";
      buildTable();
    });

    $("#clearAll")?.addEventListener("click", () => {
      if (!confirm("مسح كل محتوى الخلايا؟")) return;
      const saved = userDBOps.get();
      Object.keys(saved).forEach(
        (k) => /^r\d+c\d+$/.test(k) && delete saved[k]
      );
      userDBOps.set(saved);
      buildTable();
      window.toast?.("تم المسح ✓");
    });

    const logTool = async (name) => {
      if (typeof supaLogToolUsage === "function") {
        try {
          await supaLogToolUsage(name, masarMeta());
        } catch (_) {}
      }
    };

    $("#print")?.addEventListener("click", () => {
      printArea(false);
      logTool("masar_print");
    });
    $("#printCompact")?.addEventListener("click", () => {
      printArea(true);
      logTool("masar_print_compact");
    });
    $("#exportCsv")?.addEventListener("click", () => {
      csvOps.download();
      logTool("masar_export_csv");
    });

    $("#savePng")?.addEventListener("click", async () => {
      try {
        const canvas = await html2canvas(tableWrap, {
          backgroundColor:
            getComputedStyle(document.body).getPropertyValue("--bg") || null,
          scale: window.devicePixelRatio || 2,
          useCORS: true,
        });
        const a = document.createElement("a");
        a.href = canvas.toDataURL("image/png");
        a.download = `masar-schedule-${new Date()
          .toISOString()
          .slice(0, 19)
          .replace(/[:T]/g, "-")}.png`;
        a.click();
        logTool("masar_save_png");
      } catch (e) {
        window.toast?.("تعذّر حفظ الصورة.");
      }
    });

    $("#toggleColors")?.addEventListener("click", function () {
      window.__colorsOn = !window.__colorsOn;
      this.textContent = window.__colorsOn
        ? "إيقاف تلوين المواد"
        : "تلوين المواد";
      userDBOps.merge({ __meta: { colorsOn: window.__colorsOn } });
      colorManager.apply();
    });

    [periodsSel, startTime, slotMinsSel, orientSel, daysSel].forEach((el) =>
      el?.addEventListener("change", buildTable)
    );
    [colorInp, mixInp, borderInp].forEach((el) =>
      el?.addEventListener("input", () => {
        themeManager.apply();
        themeManager.save();
      })
    );
  };

  const printArea = (compact) => {
    document.body.classList.toggle("print-compact", compact);
    window.print();
    window.addEventListener(
      "afterprint",
      () => document.body.classList.remove("print-compact"),
      { once: true }
    );
  };

  // Init
  document.addEventListener("DOMContentLoaded", () => {
    themeManager.load();
    const m = userDBOps.get().__meta || {};
    if (periodsSel) periodsSel.value = m.periods || 7;
    if (startTime) startTime.value = m.startAt || "07:00";
    if (slotMinsSel) slotMinsSel.value = m.slotMin || 50;
    if (orientSel) orientSel.value = m.orient || "periods-rows";
    if (daysSel)
      daysSel.value =
        Array.isArray(m.days) && m.days.length === 4 ? "sun-wed" : "sun-thu";

    window.__colorsOn = m.colorsOn !== undefined ? !!m.colorsOn : true;
    const toggleBtn = $("#toggleColors");
    if (toggleBtn)
      toggleBtn.textContent = window.__colorsOn
        ? "تلوين المواد (مفعّل)"
        : "تلوين المواد";

    buildTable();
    setupEvents();
  });

  // Toast logic embedded
  (function () {
    let box = document.getElementById("toast");
    if (box && !box.style.position) {
      Object.assign(box.style, {
        position: "fixed",
        bottom: "16px",
        insetInline: "0",
        margin: "0 auto",
        maxWidth: "320px",
        padding: "10px 14px",
        borderRadius: "10px",
        background: "rgba(17,25,40,.9)",
        color: "#fff",
        fontWeight: "700",
        textAlign: "center",
        zIndex: "9999",
        boxShadow: "0 8px 24px rgba(0,0,0,.25)",
        display: "none",
      });
    }
    window.toast = (msg, ms = 1800) => {
      if (!box) {
        alert(msg);
        return;
      }
      box.textContent = msg || "";
      box.style.display = "block";
      clearTimeout(window.__toastTimer);
      window.__toastTimer = setTimeout(() => (box.style.display = "none"), ms);
    };
  })();
})();
