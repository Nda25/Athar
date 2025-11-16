/**
 * إعدادات عامة ومساعدات
 */
const UTILS = {
  toast: (msg) => {
    const t = document.getElementById("toast");
    if (!t) return alert(msg);
    t.textContent = msg;
    t.style.display = "block";
    setTimeout(() => (t.style.display = "none"), 2000);
  },
  renderBadge: (status) => {
    const el = document.getElementById("acc-badge");
    if (!el) return;
    el.className = "badge"; // reset classes
    if (status === "active") {
      el.classList.add("active");
      el.textContent = "مفعّل";
    } else if (status === "trial") {
      el.classList.add("trial");
      el.textContent = "تجريبي";
    } else {
      el.classList.add("inactive");
      el.textContent = "غير نشط";
    }
  },
};

/**
 * 1. إدارة المظهر (Theme Picker)
 */
function initTheme() {
  const root = document.documentElement;
  const picker = document.getElementById("themePicker");
  if (!picker) return;

  // تلوين الأزرار
  picker.querySelectorAll("button").forEach((b) => {
    if (b.dataset.color) b.style.backgroundColor = b.dataset.color;
    if (b.hasAttribute("data-reset")) b.style.background = "#111827";
  });

  // استرجاع اللون المحفوظ
  const saved = localStorage.getItem("athar:theme");
  if (saved) {
    root.style.setProperty("--primary", saved);
    picker.querySelector(`[data-color="${saved}"]`)?.classList.add("is-active");
  } else {
    picker.querySelector("[data-reset]")?.classList.add("is-active");
  }

  // عند النقر
  picker.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    // تحديث UI
    picker
      .querySelectorAll("button")
      .forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");

    const isReset = btn.hasAttribute("data-reset");
    const color = isReset ? "#1e40af" : btn.dataset.color; // اللون الافتراضي أو المختار

    // تطبيق
    root.style.setProperty("--primary", color);
    if (isReset) localStorage.removeItem("athar:theme");
    else localStorage.setItem("athar:theme", color);

    // حفظ في قاعدة البيانات (بدون تعطيل الواجهة)
    try {
      const user = await window.auth0Client?.getUser();
      if (window.supa && user?.sub) {
        window.supa
          .from("user_prefs")
          .upsert(
            { user_sub: user.sub, theme_color: isReset ? null : color },
            { onConflict: "user_sub" }
          );
      }
    } catch (_) {}
  });
}

/**
 * 2. إدارة الملف الشخصي (الصورة والاسم)
 */
function initProfileActions(user) {
  // --- تعديل الاسم ---
  const nameBtn = document.getElementById("editNameBtn");
  if (nameBtn) {
    nameBtn.onclick = async () => {
      const displayEl = document.getElementById("displayName");
      const newName = prompt(
        "أدخلي الاسم الجديد:",
        displayEl.textContent.trim()
      );
      if (!newName || !newName.trim()) return;

      const cleanName = newName.trim();
      displayEl.textContent = cleanName;
      localStorage.setItem("athar:displayName", cleanName);
      UTILS.toast("تم تحديث الاسم محلياً ✓");

      // حفظ في السيرفر
      if (window.supa && user.sub) {
        await window.supa
          .from("user_prefs")
          .upsert(
            { user_sub: user.sub, display_name: cleanName },
            { onConflict: "user_sub" }
          );
      }
    };
  }

  // --- رفع الصورة (مبسط بدون قص) ---
  const fileInput = document.getElementById("avatarInput");
  if (fileInput) {
    fileInput.onchange = async (ev) => {
      const file = ev.target.files?.[0];
      if (!file) return;

      // تحقق بسيط
      if (!file.type.startsWith("image/"))
        return UTILS.toast("الرجاء اختيار صورة.");
      if (file.size > 2 * 1024 * 1024)
        return UTILS.toast("حجم الصورة يجب أن يكون أقل من 2 ميجا.");

      UTILS.toast("جارٍ الرفع...");

      try {
        if (!window.supa) throw new Error("قاعدة البيانات غير متصلة");

        const fileExt = file.name.split(".").pop();
        const fileName = `${user.sub.replace(
          /[|]/g,
          "_"
        )}/${Date.now()}.${fileExt}`;

        // رفع مباشر
        const { error: uploadError } = await window.supa.storage
          .from("avatars")
          .upload(fileName, file, { upsert: true });

        if (uploadError) throw uploadError;

        // جلب الرابط
        const { data } = window.supa.storage
          .from("avatars")
          .getPublicUrl(fileName);
        const publicUrl = `${data.publicUrl}?t=${Date.now()}`; // cache busting

        // تحديث الواجهة
        document.getElementById("u-avatar").src = publicUrl;
        localStorage.setItem("athar:avatar", publicUrl);

        // حفظ الرابط في جدول التفضيلات
        await window.supa
          .from("user_prefs")
          .upsert(
            { user_sub: user.sub, avatar_url: publicUrl },
            { onConflict: "user_sub" }
          );

        UTILS.toast("تم تحديث الصورة بنجاح ✓");
      } catch (err) {
        console.error(err);
        UTILS.toast("حدث خطأ أثناء الرفع");
      } finally {
        ev.target.value = ""; // تنظيف الإدخال
      }
    };
  }
}

/**
 * 3. جلب بيانات الاشتراك والفواتير
 */
async function loadUserData(user, claims) {
  const NS_NEW = "https://n-athar.co/";

  // أ) عرض البيانات الأولية فوراً من Auth0 (سريع جداً)
  const status = claims?.[NS_NEW + "status"] || "inactive";
  const plan = claims?.[NS_NEW + "plan"] || "—";

  UTILS.renderBadge(status);
  document.getElementById("u-plan").textContent = plan;
  document.getElementById("u-status-text").textContent =
    status === "active" ? "مفعّل" : status === "trial" ? "تجريبي" : "غير نشط";

  // ب) جلب البيانات الثقيلة بالتوازي (Parallel Fetching)
  if (!window.supa) return;

  const fetchMembership = async () => {
    // جلب أحدث اشتراك
    const { data } = await window.supa
      .from("memberships")
      .select("*")
      .or(`user_sub.eq.${user.sub},email.eq.${user.email}`)
      .order("end_at", { ascending: false })
      .limit(1);

    if (data && data[0]) {
      const m = data[0];
      const end = m.expires_at || m.end_at;
      const isActive = m.status === "active" && new Date(end) > new Date();

      // تحديث الواجهة بأحدث بيانات من الداتابيس
      UTILS.renderBadge(isActive ? "active" : m.status);
      if (m.start_at && end) {
        document.getElementById("u-activation").textContent = `${new Date(
          m.start_at
        ).toLocaleDateString("ar-SA")} → ${new Date(end).toLocaleDateString(
          "ar-SA"
        )}`;
      }
      document.getElementById("cardSub").setAttribute("data-ready", "1");
    }
  };

  const fetchInvoices = async () => {
    // يمكن استبدال هذا بـ call مباشر لـ Supabase إذا كانت الفواتير مخزنة هناك
    // أو الإبقاء على Netlify function
    try {
      const token = await window.auth0Client.getTokenSilently();
      const res = await fetch("/.netlify/functions/invoices-list", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      const tbody = document.getElementById("invBody");
      tbody.innerHTML = "";

      if (json.rows?.length) {
        json.rows.forEach((r) => {
          const tr = document.createElement("tr");
          const amount = (r.amount / 100).toFixed(2);
          tr.innerHTML = `
                    <td>${new Date(r.created_at).toLocaleDateString(
                      "ar-SA"
                    )}</td>
                    <td>${amount} ر.س</td>
                    <td>${r.gateway || "بطاقة"}</td>
                    <td><span class="pill ${r.status}">${r.status}</span></td>
                    <td>${r.invoice_id || "—"}</td>
                `;
          tbody.appendChild(tr);
        });
        document.getElementById("invTable").style.display = "table";
        document.getElementById("invEmpty").style.display = "none";
      }
      document.getElementById("cardInvoices").setAttribute("data-ready", "1");
    } catch (e) {
      console.warn("Failed to load invoices", e);
    }
  };

  const fetchPrefs = async () => {
    const { data } = await window.supa
      .from("user_prefs")
      .select("display_name, avatar_url, theme_color")
      .eq("user_sub", user.sub)
      .maybeSingle();

    if (data) {
      if (data.display_name)
        document.getElementById("displayName").textContent = data.display_name;
      if (data.avatar_url)
        document.getElementById("u-avatar").src = data.avatar_url;
      if (data.theme_color)
        document.documentElement.style.setProperty(
          "--primary",
          data.theme_color
        );
    }
  };

  // تنفيذ الكل معاً
  await Promise.allSettled([fetchMembership(), fetchInvoices(), fetchPrefs()]);
}

/**
 * الدالة الرئيسية (نقطة الدخول)
 */
async function initApp() {
  initTheme(); // تفعيل المظهر فوراً

  const client = window.auth0Client || window.auth;
  if (!client) return;

  // 1. تحقق سريع
  if (!(await client.isAuthenticated())) {
    await client.loginWithRedirect({
      authorizationParams: { redirect_uri: window.location.href },
    });
    return;
  }

  // 2. جلب بيانات المستخدم
  const user = await client.getUser();
  const claims = await client.getIdTokenClaims();

  // 3. ملء البيانات الأساسية في HTML
  document.getElementById("displayName").textContent =
    localStorage.getItem("athar:displayName") || user.name || "مستخدم";
  document.getElementById("u-email").textContent = user.email;
  document.getElementById("u-sub").textContent = user.sub;
  document.getElementById("u-joined").textContent = user.updated_at
    ? new Date(user.updated_at).toLocaleDateString("ar-SA")
    : "—";
  document.getElementById("u-last").textContent = new Date().toLocaleString(
    "ar-SA"
  );

  // إظهار الكارد الأساسي
  document.getElementById("cardHeader").setAttribute("data-ready", "1");

  // 4. تفعيل الأزرار (رفع صور، تعديل اسم)
  initProfileActions(user);

  // 5. جلب البيانات من السيرفر (اشتراك، فواتير)
  loadUserData(user, claims);
}

/**
 * 4. جلب شكاوى المستخدم
 */
async function loadUserComplaints() {
  const container = document.getElementById("user-complaints");
  if (!container) return;

  try {
    const user = await (window.auth0Client || window.auth).getUser();
    if (!user?.email) {
      container.innerHTML =
        '<div class="empty-state"><p>يجب تسجيل الدخول لعرض الشكاوى</p></div>';
      return;
    }

    const token = await (window.auth0Client || window.auth).getTokenSilently();
    const response = await fetch(
      "/.netlify/functions/complaints-list?user_email=" +
        encodeURIComponent(user.email),
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const data = await response.json();
    const complaints = data.rows || [];

    container.innerHTML = "";

    if (complaints.length === 0) {
      container.innerHTML =
        '<div class="empty-state"><p>لا توجد شكاوى أو اقتراحات</p></div>';
      return;
    }

    complaints.forEach((complaint) => {
      const statusText =
        complaint.status === "new"
          ? "جديدة"
          : complaint.status === "in_progress"
          ? "قيد المعالجة"
          : complaint.status === "resolved"
          ? "مغلقة"
          : complaint.status;

      const typeText = complaint.type === "complaint" ? "شكوى" : "اقتراح";
      const date = new Date(complaint.created_at).toLocaleDateString("ar-SA");

      const item = document.createElement("div");
      item.className = "complaint-item";
      item.innerHTML = `
        <div class="complaint-header">
          <h4 class="complaint-title">${complaint.subject}</h4>
          <span class="complaint-status ${
            complaint.status
          }">${statusText}</span>
        </div>
        <div class="complaint-meta">${typeText} • ${date}</div>
        <div class="complaint-preview">${complaint.message.substring(0, 100)}${
        complaint.message.length > 100 ? "..." : ""
      }</div>
      `;
      container.appendChild(item);
    });
  } catch (error) {
    console.error("Error loading complaints:", error);
    container.innerHTML =
      '<div class="empty-state" style="color: #ef4444;"><p>خطأ في تحميل الشكاوى</p></div>';
  }
}

// تشغيل التطبيق
window.addEventListener("auth0:ready", async () => {
  await initApp();
  await loadUserComplaints();
});
if (window.auth0Client || window.auth) {
  initApp().then(() => loadUserComplaints());
}

// زر الخروج
document.getElementById("logout")?.addEventListener("click", () => {
  (window.auth0Client || window.auth)?.logout({
    logoutParams: { returnTo: window.location.origin },
  });
});
