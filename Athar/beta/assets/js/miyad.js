/* =========================================
   الجزء الأول: أدوات الربط مع Supabase
   (هذا هو المحرك الخلفي للنظام)
   ========================================= */

// دالة مساعدة: ننتظر حتى يتم تحميل Supabase
async function waitForSupa(max = 40) {
  for (let i = 0; i < max; i++) {
    // بنبحث عن الكلاينت سواء كان اسمه supa أو supabaseClient
    if (
      window.supabaseClient &&
      typeof window.supabaseClient.from === "function"
    )
      return window.supabaseClient;
    if (window.supa && typeof window.supa.from === "function")
      return window.supa;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

// دالة مساعدة: جلب المستخدم الحالي من Auth0
async function getAuthUser() {
  try {
    return await window.auth?.getUser();
  } catch (_) {
    return null;
  }
}

/* --- 1. تسجيل المستخدم الجديد تلقائياً (أهم دالة لصاحبك) --- */
window.supaEnsureUserProfile = async function () {
  const sb = await waitForSupa();
  const user = await getAuthUser();

  if (!sb || !user) return;

  console.log("Checking user profile for:", user.email);

  // نرسل البيانات لقاعدة البيانات (إنشاء لو جديد / تحديث لو موجود)
  const { error } = await sb.from("miyad_settings").upsert(
    {
      user_id: user.sub, // معرف المستخدم
      email: user.email, // الإيميل (عشان Resend يبعتله)
      reminders_enabled: true, // تفعيل التنبيهات افتراضياً
      remind_days_before: 1, // التنبيه قبل الموعد بيوم
      updated_at: new Date(),
    },
    { onConflict: "user_id" }
  );

  if (error) console.error("Supabase Profile Error:", error);
  else console.log("User profile synced successfully ✅");
};

/* --- 2. إضافة موعد جديد للداتابيز --- */
window.supaAddMiyadEvent = async function (evt) {
  const sb = await waitForSupa();
  const user = await getAuthUser();

  if (!sb || !user) {
    console.error("No Supabase client or user authenticated");
    return { data: null, error: "Not logged in" };
  }

  console.log("Adding to DB:", evt, "User:", user.sub);

  try {
    // تأكد من وجود البروفايل أولاً
    await window.supaEnsureUserProfile();

    // ثم أضف الحدث
    const result = await sb
      .from("miyad_events")
      .insert([
        {
          user_id: user.sub,
          subj: evt.subj,
          class: evt.cls,
          day: evt.day,
          slot: evt.slot,
          date: evt.date || null,
          color: evt.color,
        },
      ])
      .select();

    if (result.error) {
      console.error("Supabase insert error:", result.error);
      throw result.error;
    }

    return result;
  } catch (error) {
    console.error("Error adding miyad event:", error);
    return { data: null, error: error.message };
  }
};

/* --- 3. حذف موعد من الداتابيز --- */
window.supaDeleteMiyadEvent = async function (id) {
  const sb = await waitForSupa();
  if (!sb) return;
  console.log("Deleting from DB ID:", id);
  return await sb.from("miyad_events").delete().eq("id", id);
};

/* --- 4. حفظ إعدادات التنبيه يدوياً --- */
window.supaSaveReminderSettings = async function (payload) {
  const sb = await waitForSupa();
  if (!sb) return { error: "No client" };
  return await sb.from("miyad_settings").upsert(payload).select();
};

/* --- 5. جلب الإعدادات عند الفتح --- */
window.supaGetReminderSettings = async function () {
  const sb = await waitForSupa();
  const user = await getAuthUser();
  if (!sb || !user) return { data: null };

  return await sb
    .from("miyad_settings")
    .select("*")
    .eq("user_id", user.sub)
    .single();
};

/* --- أداة تتبع بسيطة (اختياري) --- */
window.supaLogToolUsage = async function (tag, details) {
  // يمكنك تركها فارغة أو تفعيلها لو عندك جدول logs
  console.log("Log:", tag, details);
};

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

      // 1. إرسال للسيرفر (Supabase)
      let serverSuccess = false;
      try {
        toast("جارِ الحفظ...");
        const result = await window.supaAddMiyadEvent(newEvent);

        if (result.error) {
          console.error("Server error:", result.error);
          toast("خطأ في الحفظ: " + result.error);
        } else if (result.data && result.data.length > 0) {
          newEvent.id = result.data[0].id;
          serverSuccess = true;
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

  const { data, error } = await window.supaGetReminderSettings();
  if (error) {
    console.warn("loadSettings error:", error);
    return;
  }

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

  const { data, error } = await window.supaSaveReminderSettings(payload);

  if (error) {
    console.error("Save Settings Error:", error);
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
