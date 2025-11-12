/* ====== أدوات بسيطة ====== */
const KEY = "mi3ad:events";
function toast(m) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = m;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1200);
}
function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch (_) {
    return [];
  }
}
function save(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}
window.addEventListener("load", () => {
  if (typeof supaEnsureUserProfile === "function") {
    try {
      supaEnsureUserProfile();
    } catch (_) {}
  }
});

/* — ميتا خفيفة عن آخر إدخال (للتتبّع) */
function miyadMetaSnapshot() {
  const subj = (document.getElementById("m-subj")?.value || "").trim() || null;
  const cls = (document.getElementById("m-class")?.value || "").trim() || null;
  const day = document.getElementById("m-day")?.value || null;
  const slot = Number(document.getElementById("m-slot")?.value || 0) || null;
  const date = (document.getElementById("m-date")?.value || "").trim() || null;
  const color = document.getElementById("m-color")?.value || null;
  return { subj, cls, day, slot, date, color };
}

/* رندر القائمة */
function render() {
  const box = document.getElementById("list");
  box.innerHTML = "";
  const daysOrder = {
    الأحد: 1,
    الإثنين: 2,
    الثلاثاء: 3,
    الأربعاء: 4,
    الخميس: 5,
  };
  const items = load().sort(
    (a, b) => daysOrder[a.day] - daysOrder[b.day] || a.slot - b.slot
  );
  if (!items.length) {
    box.innerHTML = '<p class="muted">لا توجد مواعيد بعد.</p>';
    return;
  }
  items.forEach((e, i) => {
    const d = document.createElement("div");
    d.className = "ev";
    d.innerHTML = `
          <div class="meta">
            <span class="color" style="background:${e.color}"></span>
            <strong>${e.subj}</strong>
            <span>— فصل ${e.cls}</span>
            <span>— ${e.day} (حصة ${e.slot})</span>
            ${e.date ? `<span>— ${e.date}</span>` : ""}
          </div>
          <a href="#" data-i="${i}" class="btn ghost" style="padding:6px 10px">حذف</a>`;
    box.appendChild(d);
  });
}

/* ====== تحليلات الاستخدام (اختياري) ====== */
function logUse(tag) {
  try {
    if (typeof supaLogToolUsage === "function") supaLogToolUsage(tag);
  } catch (_) {}
}

/* أحداث الأزرار الأساسية */
document.addEventListener("DOMContentLoaded", () => {
  if (typeof bindAutoSave === "function") bindAutoSave("miyad", "#miyad-form");
  render();
  logUse("miyad:view");
  document.getElementById("add").addEventListener("click", async () => {
    const subj = document.getElementById("m-subj").value.trim();
    const cls = document.getElementById("m-class").value.trim();
    const day = document.getElementById("m-day").value;
    const slot = +document.getElementById("m-slot").value || 1;
    const date = document.getElementById("m-date").value;
    const color = document.getElementById("m-color").value;

    if (!subj || !cls) {
      toast("أدخل المادة والفصل");
      return;
    }

    const newEvent = { subj, cls, day, slot, date, color };

    // 2. ابعته للسيرفر (واستقبل الـ ID اللي راجع)
    try {
      if (typeof supaAddMiyadEvent === "function") {
        // استقبل الداتا اللي راجعة (اللي فيها الـ ID)
        const { data, error } = await supaAddMiyadEvent(newEvent);

        // لو رجع ID، ضيفه على الموعد
        if (data && data.length > 0) {
          newEvent.id = data[0].id; // <-- أهم سطر في الخطوة دي
        }
      }
    } catch (e) {
      console.warn("Failed to sync event to Supabase", e);
    }

    // 3. احفظ الموعد (بالـ ID لو موجود) في localStorage
    const list = load();
    list.push(newEvent);
    save(list);
    // -->> (نهاية التعديل) <<--

    render();
    toast("تمت الإضــافة ✅");

    // تتبّع: إضافة موعد
    if (typeof supaLogToolUsage === "function") {
      try {
        await supaLogToolUsage("miyad_add", {
          subj,
          cls,
          day,
          slot,
          date: date || null,
          color,
        });
      } catch (_) {}
    }
    // (الإبقاء على التتبّع البسيط القديم اختياري)
    logUse("miyad:add_event");
  });

  document.getElementById("list").addEventListener("click", (e) => {
    const a = e.target.closest("a[data-i]");
    if (!a) return;
    e.preventDefault();
    const i = +a.getAttribute("data-i");
    const list = load();
    const eventToDelete = list[i];
    list.splice(i, 1);
    save(list);
    render();
    if (
      eventToDelete &&
      eventToDelete.id &&
      typeof supaDeleteMiyadEvent === "function"
    ) {
      // ابعت الـ ID بس للدالة الجديدة (اللي هنعملها في الخطوة 4)
      supaDeleteMiyadEvent(eventToDelete.id);
    }
    logUse("miyad:delete_event");
  });

  document.getElementById("export").addEventListener("click", () => {
    const txt = load()
      .map(
        (e) =>
          `${e.day} | حصة ${e.slot} | ${e.subj} — فصل ${e.cls}${
            e.date ? " — " + e.date : ""
          }`
      )
      .join("\n");
    navigator.clipboard.writeText(txt || "").then(() => {
      toast("تم النسخ ✅");
      logUse("miyad:export");
    });
  });

  document.getElementById("print").addEventListener("click", () => {
    window.print();
    logUse("miyad:print");
  });

  document.getElementById("clear").addEventListener("click", () => {
    if (confirm("حذف جميع مواعيد الفصل الدراسي؟")) {
      localStorage.removeItem(KEY);
      render();
      logUse("miyad:clear_all");
    }
  });
});

/* ====== إعدادات التذكير (Supabase + Auth0) ====== */
// نضمن أننا نرجع "client" فيه .from — وليس مكتبة supabase نفسها
function pickSupaClient() {
  if (window.supa && typeof window.supa.from === "function") return window.supa;
  if (window.supabaseClient && typeof window.supabaseClient.from === "function")
    return window.supabaseClient;
  return null; // لا ترجّع window.supabase لأنها مجرد مكتبة createClient
}
async function waitForSupa(max = 40) {
  // ~4 ثواني
  for (let i = 0; i < max; i++) {
    const c = pickSupaClient();
    if (c) return c;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}
async function getAuthUser() {
  try {
    return await window.auth?.getUser();
  } catch (_) {
    return null;
  }
}

// تحميل الإعدادات
async function loadReminderSettings() {
  // const sb = await waitForSupa();
  const user = await getAuthUser();
  if (!user) return;

  if (typeof supaGetReminderSettings !== "function") {
    console.warn("supaGetReminderSettings function is not defined");
    return;
  }

  const { data, error } = await supaGetReminderSettings();

  if (error) {
    console.warn("loadReminderSettings error:", error);
    return;
  }

  const enable = data?.reminders_enabled ?? false;
  const days = data?.remind_days_before ?? 2;

  const cb = document.getElementById("rem-enable");
  const sel = document.getElementById("rem-days");
  if (cb) cb.checked = !!enable;
  if (sel) sel.value = String(days);
}

// حفظ الإعدادات
async function saveReminderSettings() {
  const sb = await waitForSupa();
  const user = await getAuthUser();
  if (!sb || !user) {
    window.toast ? toast("سجّلي دخولك أولًا") : alert("سجّلي دخولك أولًا");
    return;
  }

  const cb = document.getElementById("rem-enable");
  const sel = document.getElementById("rem-days");
  const stat = document.getElementById("rem-status");

  const enabled = !!cb.checked;
  const days_before = Number(sel.value || 2);

  const payload = {
    user_id: user.sub,
    email: user.email || null,
    reminders_enabled: enabled,
    remind_days_before: days_before,
  };

  stat.textContent = "جارٍ الحفظ…";
  if (typeof supaSaveReminderSettings !== "function") {
    stat.textContent = "خطأ: الدالة غير معرفة";
    toast("خطأ برمجي: الدالة غير موجودة");
    return;
  }

  // هنبعت الـ payload جاهز للدالة الجديدة
  const { ok, error } = await supaSaveReminderSettings(payload);

  if (error || !ok) {
    console.error("saveReminderSettings error:", error);
    stat.textContent = "تعذّر الحفظ";
    toast("تعذّر الحفظ");
    return;
  }

  stat.textContent = "تم الحفظ ✓";
  toast("تم حفظ إعدادات التذكير ✓");

  // تتبّع: إعداد التذكير
  if (typeof supaLogToolUsage === "function") {
    try {
      await supaLogToolUsage("miyad_reminder_save", {
        enabled,
        days_before,
      });
    } catch (_) {}
  }
}

// ربط أزرار إعدادات التذكير + تحميل عند الجاهزية
document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("rem-save")
    ?.addEventListener("click", saveReminderSettings);
  window.addEventListener("auth0:ready", loadReminderSettings);
  setTimeout(loadReminderSettings, 1500); // احتياط
});
