/* =========================================
   ميعاد (Miyad) - Frontend Logic
   =========================================
   ⚠️ ملاحظة مهمة:
   جميع دوال Supabase موجودة في ملف supabase-client.js:
   - window.supaEnsureUserProfile
   - window.supaAddMiyadEvent
   - window.supaDeleteMiyadEvent
   - window.supaSaveReminderSettings
   - window.supaGetReminderSettings
   - window.supaLogToolUsage
   
   هذه الدوال تستخدم Netlify Functions للتواصل الآمن مع Supabase.
   ========================================= */

// دالة مساعدة: جلب المستخدم الحالي من Auth0
async function getAuthUser() {
  try {
    return await window.auth?.getUser();
  } catch (_) {
    return null;
  }
}

/* =========================================
   الجزء الثاني: منطق الواجهة (Frontend)
   (الأدوات، العرض، التخزين المحلي)
   ========================================= */

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

/* --- تشغيل المزامنة عند تحميل الصفحة --- */
window.addEventListener("load", async () => {
  // ننتظر قليلاً للتأكد من جاهزية Auth0
  setTimeout(async () => {
    const user = await getAuthUser();
    if (user && typeof window.supaEnsureUserProfile === "function") {
      try {
        await window.supaEnsureUserProfile();
        console.log("User profile ensured for:", user.sub);
      } catch (e) {
        console.error("Error ensuring user profile:", e);
      }
    } else {
      console.log(
        "User not authenticated or supaEnsureUserProfile not available"
      );
    }
  }, 2000); // زيادة الوقت لضمان جاهزية Auth0
});

function render() {
  const box = document.getElementById("list");
  if (!box) return;

  box.innerHTML = "";
  const daysOrder = {
    الأحد: 1,
    الإثنين: 2,
    الثلاثاء: 3,
    الأربعاء: 4,
    الخميس: 5,
  };

  const items = load().sort(
    (a, b) =>
      (daysOrder[a.day] || 0) - (daysOrder[b.day] || 0) || a.slot - b.slot
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

function logUse(tag) {
  if (typeof window.supaLogToolUsage === "function")
    window.supaLogToolUsage(tag);
}

/* =========================================
   الجزء الثالث: التفاعل (Event Listeners)
   ========================================= */

document.addEventListener("DOMContentLoaded", () => {
  render();
  logUse("miyad:view");

  // --- زر الإضافة ---
  const addBtn = document.getElementById("add");
  if (addBtn) {
    addBtn.addEventListener("click", async () => {
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

      // التحقق من حالة المصادقة أولاً
      const user = await getAuthUser();
      if (!user) {
        toast("يجب تسجيل الدخول أولاً");
        return;
      }

      // 1. إرسال للسيرفر (Supabase via Netlify Function)
      let serverSuccess = false;
      try {
        toast("جارِ الحفظ...");
        const result = await window.supaAddMiyadEvent(newEvent);

        // supabase-client.js returns { ok: boolean, data: ..., error: ... }
        if (!result.ok) {
          console.error("Server error:", result.error);
          toast("خطأ في الحفظ: " + (result.error || "خطأ غير معروف"));
        } else if (result.data) {
          // النتيجة من Netlify Function هي array من الـ IDs
          const idData = Array.isArray(result.data)
            ? result.data[0]
            : result.data;
          if (idData && idData.id) {
            newEvent.id = idData.id;
          }
          serverSuccess = true;
        } else {
          // ok = true but no data means user not authenticated (saved locally only)
          serverSuccess = false;
        }
      } catch (e) {
        console.error("Error syncing to server:", e);
        toast("تعذر الاتصال بالخادم - سيتم الحفظ محلياً");
      }

      // 2. حفظ محلي (LocalStorage)
      const list = load();
      list.push(newEvent);
      save(list);

      render();

      if (serverSuccess) {
        toast("تمت الإضــافة ✅");
      } else {
        toast("تم الحفظ محلياً فقط");
      }

      logUse("miyad:add_event");
    });
  }

  // --- زر الحذف (داخل القائمة) ---
  const listContainer = document.getElementById("list");
  if (listContainer) {
    listContainer.addEventListener("click", (e) => {
      const a = e.target.closest("a[data-i]");
      if (!a) return;
      e.preventDefault();

      const i = +a.getAttribute("data-i");
      const list = load();
      const eventToDelete = list[i];

      // حذف محلي
      list.splice(i, 1);
      save(list);
      render();

      // حذف من السيرفر (لو له ID)
      if (eventToDelete && eventToDelete.id) {
        window.supaDeleteMiyadEvent(eventToDelete.id);
      }
      logUse("miyad:delete_event");
    });
  }

  // --- زر النسخ ---
  const exportBtn = document.getElementById("export");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
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
  }

  // --- زر الطباعة ---
  const printBtn = document.getElementById("print");
  if (printBtn) {
    printBtn.addEventListener("click", () => {
      window.print();
      logUse("miyad:print");
    });
  }

  // --- زر الحذف الكامل ---
  const clearBtn = document.getElementById("clear");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (confirm("حذف جميع مواعيد الفصل الدراسي؟")) {
        localStorage.removeItem(KEY);
        render();
        logUse("miyad:clear_all");
        toast("تم الحذف المحلي فقط");
      }
    });
  }
});

/* =========================================
   الجزء الرابع: إدارة إعدادات التنبيه
   ========================================= */

async function loadReminderSettings() {
  const user = await getAuthUser();
  if (!user) return;

  const result = await window.supaGetReminderSettings();
  // supabase-client.js returns { ok, data, error }
  if (!result.ok || result.error) {
    console.warn("loadSettings error:", result.error);
    return;
  }

  const data = result.data;
  const enable = data?.reminders_enabled ?? false;
  const days = data?.remind_days_before ?? 2;

  const cb = document.getElementById("rem-enable");
  const sel = document.getElementById("rem-days");
  if (cb) cb.checked = !!enable;
  if (sel) sel.value = String(days);
}

async function saveReminderSettings() {
  const user = await getAuthUser();
  if (!user) {
    toast("يجب تسجيل الدخول أولاً");
    return;
  }

  const cb = document.getElementById("rem-enable");
  const sel = document.getElementById("rem-days");
  const stat = document.getElementById("rem-status");

  if (!cb || !sel) return;

  const enabled = !!cb.checked;
  const days_before = Number(sel.value || 2);

  if (stat) stat.textContent = "جارٍ الحفظ...";

  const payload = {
    user_id: user.sub,
    email: user.email || null,
    reminders_enabled: enabled,
    remind_days_before: days_before,
    updated_at: new Date(), // تحديث وقت التعديل
  };

  const result = await window.supaSaveReminderSettings(payload);

  // supabase-client.js returns { ok, data, error }
  if (!result.ok || result.error) {
    console.error("Save Settings Error:", result.error);
    if (stat) stat.textContent = "تعذّر الحفظ";
    toast("تعذّر حفظ الإعدادات");
  } else {
    if (stat) stat.textContent = "تم الحفظ ✓";
    toast("تم حفظ الإعدادات بنجاح");
  }
}

// تشغيل تحميل الإعدادات عند جاهزية Auth0
document.addEventListener("DOMContentLoaded", () => {
  const saveBtn = document.getElementById("rem-save");
  if (saveBtn) saveBtn.addEventListener("click", saveReminderSettings);

  // نستمع لحدث جاهزية Auth0 لو بتستخدم مكتبة بتطلق الحدث ده
  window.addEventListener("auth0:ready", () => {
    loadReminderSettings();
    // التأكد من تسجيل المستخدم أيضاً
    if (window.supaEnsureUserProfile) window.supaEnsureUserProfile();
  });

  // احتياطي: المحاولة بعد ثانية ونصف
  setTimeout(loadReminderSettings, 1500);
});
