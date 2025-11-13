const toast = (m) => {
  const t = document.getElementById("toast");
  t.textContent = m;
  t.style.display = "block";
  setTimeout(() => (t.style.display = "none"), 1400);
};

// ===== تبويبات
const tabs = ["t-activate", "t-ann", "t-complaints", "t-users"];
function showTab(id) {
  tabs.forEach((x) => {
    const el = document.getElementById(x);
    if (el) el.style.display = x === id ? "" : "none";
  });
  document
    .querySelectorAll("[data-tab]")
    .forEach((b) => b.classList.toggle("primary", b.dataset.tab === id));
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-tab]");
  if (!b) return;
  
  // Update active state for tab buttons
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  b.classList.add("active");
  
  showTab(b.dataset.tab);
  if (b.dataset.tab === "t-users") loadUsers();
});

// ===== صلاحيات الأدمن
const NS = "https://n-athar.co/";
const ALT = "https://athar.co/";

async function isAdmin() {
  try {
    const u = await window.auth.getUser();
    document.getElementById("whoami").textContent = u?.email || "";
    if (!u) return false;

    const claims = await window.auth.getIdTokenClaims();
    const roles = claims?.[NS + "roles"] || claims?.[ALT + "roles"] || [];
    const flag =
      claims?.[NS + "admin"] === true || claims?.[ALT + "admin"] === true;

    return (Array.isArray(roles) && roles.includes("admin")) || flag;
  } catch (_) {
    return false;
  }
}

// === Token + Fetch
const API_AUDIENCE = window.__CFG?.api_audience || "https://api.n-athar";

async function authToken() {
  try {
    if (!window.auth) throw new Error("Auth0 not initialized");
    return await window.auth.getTokenSilently({
      authorizationParams: {
        audience: API_AUDIENCE,
        scope: "openid profile email offline_access",
      },
    });
  } catch (err) {
    if (window.auth?.loginWithRedirect) {
      await window.auth.loginWithRedirect({
        authorizationParams: {
          audience: API_AUDIENCE,
          scope: "openid profile email offline_access",
          prompt: "consent",
        },
      });
    }
    throw err;
  }
}

async function apiFetch(url, opts = {}) {
  try {
    const token = await authToken();
    const res = await fetch(url, {
      ...opts,
      headers: {
        ...(opts.headers || {}),
        Authorization: `Bearer ${token}`,
        "Content-Type":
          (opts.headers && opts.headers["Content-Type"]) || "application/json",
      },
    });

    const ct = res.headers.get("content-type") || "";
    const bodyText = await res.text();

    if (!res.ok) {
      const errMsg = bodyText || `HTTP ${res.status}`;
      throw new Error(errMsg);
    }

    // Parse JSON حتى لو Content-Type مش مظبوط
    if (
      ct.includes("application/json") ||
      bodyText.trim().startsWith("{") ||
      bodyText.trim().startsWith("[")
    ) {
      return JSON.parse(bodyText || "{}");
    }

    return bodyText;
  } catch (err) {
    console.error("API Error:", err);
    throw err;
  }
}

// ===== الإعلانات
function toIso(calSelId, gId, hId) {
  const mode = document.getElementById(calSelId).value;
  if (mode === "greg") {
    const v = document.getElementById(gId).value;
    if (!v) return null;
    return new Date(v + "T00:00:00Z").toISOString();
  } else {
    const hasMoment = typeof window.moment === "function";
    const hasHijri = hasMoment && typeof moment.fn.iYear === "function";
    if (!hasHijri) return null;
    const v = document.getElementById(hId).value.trim();
    if (!v) return null;
    const m = moment(v, "iYYYY-iMM-iDD", true);
    if (!m.isValid()) return null;
    return new Date(m.format("YYYY-MM-DD") + "T00:00:00Z").toISOString();
  }
}

async function fetchAnnouncements() {
  try {
    const latestRes = await apiFetch(
      "/.netlify/functions/admin-announcement?latest=1"
    );
    const listRes = await apiFetch(
      "/.netlify/functions/admin-announcement?list=1"
    );

    const latest = latestRes?.latest || null;
    const list = listRes?.items || [];

    const curBox = document.getElementById("ann-current");
    curBox.innerHTML = latest
      ? `المنشور الحالي: <span class="pill">${latest.text}</span>`
      : "لا يوجد إعلان منشور حاليًا.";

    const wrap = document.getElementById("ann-list");
    wrap.innerHTML = "";

    list.forEach((a) => {
      const liveNow =
        a.active &&
        (!a.start_at || new Date(a.start_at) <= new Date()) &&
        (!a.expires_at || new Date(a.expires_at) > new Date());
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
          <div>
            <div><strong>${a.active ? "✅" : "⏸️"} ${a.text}</strong></div>
            <div class="muted" style="font-size:.9em">
              يبدأ: ${
                a.start_at
                  ? new Date(a.start_at).toLocaleDateString("ar-SA")
                  : "فوري"
              }
              • ينتهي: ${
                a.expires_at
                  ? new Date(a.expires_at).toLocaleDateString("ar-SA")
                  : "—"
              }
              ${
                liveNow
                  ? '<span class="pill" style="margin-inline-start:6px">منشور حاليًا</span>'
                  : ""
              }
            </div>
          </div>
          <div class="actions-row" style="margin:0">
            <button class="btn" data-repub="${a.id}">إعادة نشر</button>
            ${
              a.active
                ? '<button class="btn" data-stop="' + a.id + '">إيقاف</button>'
                : ""
            }
            <button class="btn" data-del="${a.id}">حذف</button>
          </div>
        </div>
      `;
      wrap.appendChild(card);
    });

    wrap.querySelectorAll("[data-repub]").forEach((b) => {
      b.onclick = async () => {
        await updateAnnouncement({
          id: b.getAttribute("data-repub"),
          active: true,
          start: null,
        });
        await fetchAnnouncements();
      };
    });

    wrap.querySelectorAll("[data-stop]").forEach((b) => {
      b.onclick = async () => {
        await updateAnnouncement({
          id: b.getAttribute("data-stop"),
          active: false,
        });
        await fetchAnnouncements();
      };
    });

    wrap.querySelectorAll("[data-del]").forEach((b) => {
      b.onclick = async () => {
        if (!confirm("حذف الإعلان؟")) return;
        await deleteAnnouncement(b.getAttribute("data-del"));
        await fetchAnnouncements();
      };
    });
  } catch (e) {
    console.warn("Failed to fetch announcements:", e);
  }
}

async function updateAnnouncement(payload) {
  return await apiFetch("/.netlify/functions/admin-announcement", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

async function deleteAnnouncement(id) {
  return await apiFetch(
    "/.netlify/functions/admin-announcement?id=" + encodeURIComponent(id),
    {
      method: "DELETE",
    }
  );
}

document.addEventListener("click", async (e) => {
  if (e.target.id !== "btn-publish") return;

  const text = document.getElementById("ann-text").value.trim();
  const active = document.getElementById("ann-active").value === "true";
  const start = toIso("ann-start-cal", "ann-start-g", "ann-start-h");
  const expires = toIso("ann-end-cal", "ann-end-g", "ann-end-h");
  const stat = document.getElementById("ann-status");

  if (!text) {
    toast("أكتب نص الإعلان");
    return;
  }

  stat.textContent = "جارٍ النشر…";
  try {
    await apiFetch("/.netlify/functions/admin-announcement", {
      method: "POST",
      body: JSON.stringify({ text, active, start, expires }),
    });
    stat.textContent = "نُشر ✓";
    toast("✓ تم نشر/تحديث الإعلان");
    document.getElementById("ann-text").value = "";
    await fetchAnnouncements();
  } catch (err) {
    stat.textContent = "✗ تعذّر النشر";
    toast("✗ تعذّر النشر");
  }
});

// ===== تفعيل/تمديد عضوية
document.addEventListener("click", async (e) => {
  if (e.target.id !== "btn-activate") return;

  const email = document.getElementById("act-email").value.trim();
  const user_id = document.getElementById("act-userid").value.trim();
  const amount = Math.max(
    1,
    Number(document.getElementById("act-amount").value || "1") | 0
  );
  const unit = document.getElementById("act-unit").value;
  const note = document.getElementById("act-note").value.trim() || null;
  const stat = document.getElementById("act-status");

  if (!email && !user_id) {
    toast("أدخل بريد إلكتروني أو UID");
    return;
  }

  stat.textContent = "جارٍ التفعيل…";
  try {
    const j = await apiFetch("/.netlify/functions/admin-activate", {
      method: "POST",
      body: JSON.stringify({
        email: email || null,
        user_id: user_id || null,
        amount,
        unit,
        note,
      }),
    });
    stat.textContent = `✓ تم التفعيل | ينتهي: ${j.expires_at || "—"}`;
    toast("✓ تم التفعيل");
  } catch (err) {
    stat.textContent = "✗ تعذّر التفعيل";
    toast("✗ تعذّر التفعيل");
  }
});

// ===== الشكاوى/الاقتراحات
let currentComplaintId = null;

async function loadComplaints() {
  try {
    const type = document.getElementById("c-type")?.value || "";
    const status = document.getElementById("c-status")?.value || "";
    const q = document.getElementById("c-q")?.value.trim() || "";
    const qs = new URLSearchParams();
    if (type) qs.set("type", type);
    if (status) qs.set("status", status);
    if (q) qs.set("q", q);

    const j = await apiFetch(
      "/.netlify/functions/complaints-list?" + qs.toString()
    );
    const tbody = document.getElementById("c-rows");
    if (!tbody) return;

    tbody.innerHTML = "";
    (j.rows || []).forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><a href="#" data-open="${row.id}">${row.subject}</a></td>
        <td>${row.user_name || "—"}<br><span class="muted">${
        row.user_email
      }</span></td>
        <td>${row.type === "complaint" ? "شكوى" : "اقتراح"}</td>
        <td><span class="pill status-${row.status}">${row.status}</span></td>
        <td>${new Date(row.created_at).toLocaleString("ar-SA")}</td>
      `;
      tbody.appendChild(tr);
    });

    if ((j.rows || []).length === 0) {
      tbody.innerHTML = `<td colspan="5" class="muted">لا توجد نتائج</td>`;
    }
  } catch (err) {
    console.error("Failed to load complaints:", err);
    toast("خطأ: فشل تحميل الشكاوى");
  }
}

async function openComplaint(id) {
  try {
    currentComplaintId = id;
    const j = await apiFetch(
      "/.netlify/functions/complaints-get?id=" + encodeURIComponent(id)
    );
    const c = j.complaint;
    const msgs = j.messages || [];

    document.getElementById("c-empty").classList.add("hidden");
    document.getElementById("c-box").classList.remove("hidden");

    document.getElementById("cd-subject").textContent = c.subject;
    document.getElementById("cd-user").textContent =
      (c.user_name ? c.user_name + " — " : "") + c.user_email;
    document.getElementById("cd-kind").textContent =
      c.type === "complaint" ? "شكوى" : "اقتراح";

    const st = document.getElementById("cd-status");
    st.textContent = c.status;
    st.className = "pill status-" + c.status;

    const thread = document.getElementById("cd-thread");
    thread.innerHTML = "";
    msgs.forEach((m) => {
      const bubble = document.createElement("div");
      bubble.style.margin = "8px 0";
      bubble.innerHTML = `
        <div class="pill" style="display:inline-block;${
          m.sender === "admin"
            ? "background:#e2e8f0;color:#0f172a;"
            : "background:#f1f5f9;color:#0f172a;"
        }">
          ${m.sender === "admin" ? "فريق أثر" : "العميل"}
        </div>
        <div>${(m.body || "").replace(/\n/g, "<br>")}</div>
        <div class="muted" style="font-size:.85em">${new Date(
          m.created_at
        ).toLocaleString("ar-SA")}</div>
      `;
      thread.appendChild(bubble);
    });

    document.getElementById("cd-reply").value = "";
    document.getElementById("cd-next").value = "";
    document.getElementById("cd-statusmsg").textContent = "";
  } catch (err) {
    console.warn("Failed to open complaint:", err);
  }
}

document.getElementById("c-refresh")?.addEventListener("click", loadComplaints);
document.getElementById("c-type")?.addEventListener("change", loadComplaints);
document.getElementById("c-status")?.addEventListener("change", loadComplaints);
document.getElementById("c-q")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loadComplaints();
});

document.getElementById("c-rows")?.addEventListener("click", (e) => {
  const a = e.target.closest("[data-open]");
  if (!a) return;
  e.preventDefault();
  openComplaint(a.getAttribute("data-open"));
});

document.getElementById("cd-send")?.addEventListener("click", async () => {
  if (!currentComplaintId) return;

  const msg = document.getElementById("cd-reply").value.trim();
  const next = document.getElementById("cd-next").value || null;
  const stat = document.getElementById("cd-statusmsg");

  if (!msg) {
    toast("أكتب الرد");
    return;
  }

  stat.textContent = "جارٍ الإرسال…";
  try {
    await apiFetch("/.netlify/functions/complaints-reply", {
      method: "POST",
      body: JSON.stringify({
        complaint_id: currentComplaintId,
        message: msg,
        next_status: next,
      }),
    });
    stat.textContent = "تم الإرسال ✓";
    toast("تم إرسال الرد");
    await openComplaint(currentComplaintId);
    await loadComplaints();
  } catch (err) {
    stat.textContent = "تعذّر الإرسال";
    toast("تعذّر الإرسال");
  }
});

// ===== المشتركون الجدد
async function loadUsers() {
  const container = document.getElementById("users-container");
  if (!container) return;

  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>جاري تحميل المستخدمين...</p></div>';

  try {
    const q = document.getElementById("u-q")?.value.trim() || "";
    const act = document.getElementById("u-active")?.value || "";
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (act) qs.set("active", act);

    const j = await apiFetch(
      "/.netlify/functions/admin-users-list?" + qs.toString()
    );
    const allRows = j.rows || [];

    container.innerHTML = "";

    if (allRows.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>لا يوجد مستخدمون</p></div>';
      return;
    }

    allRows.forEach((u) => {
      const name = u.display_name || u.name || "مستخدم جديد";
      const email = u.email || "—";
      const joined = u.created_at
        ? new Date(u.created_at).toLocaleDateString("ar-SA")
        : "—";
      const exp = u.expires_at
        ? new Date(u.expires_at).toLocaleDateString("ar-SA")
        : "—";

      const card = document.createElement("div");
      card.className = "user-card";
      card.innerHTML = `
        <div class="user-header">
          <div class="user-info">
            <h4>${name}</h4>
            <p class="email">${email}</p>
          </div>
          <div class="user-status ${u.active ? 'active' : ''}">
            <div class="status-dot ${u.active ? 'active' : ''}"></div>
            <span>${u.active ? 'نشط' : 'غير نشط'}</span>
          </div>
        </div>
        
        <div class="user-meta">
          <div class="meta-item">
            <span class="meta-label">تاريخ الانضمام</span>
            <span class="meta-value">${joined}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">ينتهي في</span>
            <span class="meta-value">${exp}</span>
          </div>
        </div>
        
        <div class="user-actions">
          <button class="quick-btn" data-quick="30d" data-email="${email}" data-sub="${u.user_sub || ''}">+30 يوم</button>
          <button class="quick-btn" data-quick="3m" data-email="${email}" data-sub="${u.user_sub || ''}">+3 أشهر</button>
          <button class="quick-btn" data-quick="1y" data-email="${email}" data-sub="${u.user_sub || ''}">+سنة</button>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error("Failed to load users:", err);
    toast("خطأ: فشل تحميل المستخدمين");
    container.innerHTML = '<div class="empty-state" style="color: #ef4444;"><p>خطأ في تحميل البيانات</p></div>';
  }
}

// أزرار التفعيل السريع
document.getElementById("users-container")?.addEventListener("click", async (e) => {
  const qbtn = e.target.closest("[data-quick]");
  const cbtn = e.target.closest("[data-custom]");
  if (!qbtn && !cbtn) return;

  let email = (qbtn || cbtn).getAttribute("data-email") || "";
  const user_id = (qbtn || cbtn).getAttribute("data-sub") || null;

  if (!email) {
    toast("لا يوجد إيميل");
    return;
  }

  let amount,
    unit,
    note = "admin-quick-activate";

  if (qbtn) {
    const k = qbtn.getAttribute("data-quick");
    if (k === "30d") {
      amount = 30;
      unit = "days";
    } else if (k === "3m") {
      amount = 3;
      unit = "months";
    } else {
      amount = 1;
      unit = "years";
    }
  } else {
    const row = cbtn.closest("tr");
    const amtEl = row.querySelector("[data-amt]");
    const unitEl = row.querySelector("[data-unit]");
    amount = Math.max(1, Number(amtEl.value || "1") | 0);
    unit = unitEl.value;
    note = "admin-custom-activate";
  }

  try {
    await apiFetch("/.netlify/functions/admin-activate", {
      method: "POST",
      body: JSON.stringify({ email, user_id, amount, unit, note }),
    });
    toast("✓ تم التفعيل");
    await loadUsers();
  } catch (err) {
    toast("✗ تعذّر التفعيل");
  }
});

// أدوات تحكّم
document.getElementById("u-refresh")?.addEventListener("click", loadUsers);
document.getElementById("u-active")?.addEventListener("change", loadUsers);
document.getElementById("u-q")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loadUsers();
});

// ===== تشغيل الصفحة
async function startAdmin() {
  // انتظر تحميل الـ DOM
  if (document.readyState === "loading") {
    await new Promise((resolve) => {
      document.addEventListener("DOMContentLoaded", resolve, { once: true });
    });
  }

  try {
    // انتظر Auth0
    for (let i = 0; i < 50 && !window.auth; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }

    if (!window.auth) {
      document.getElementById("denyCard").style.display = "";
      return;
    }

    const authed = await window.auth.isAuthenticated?.();
    if (!authed) {
      document.getElementById("denyCard").style.display = "";
      return;
    }

    const ok = await isAdmin();
    document.getElementById("tabsCard").style.display = ok ? "" : "none";
    document.getElementById("denyCard").style.display = ok ? "none" : "";

    if (!ok) return;

    showTab("t-users");

    await Promise.all([
      fetchAnnouncements().catch(() => {}),
      loadComplaints().catch(() => {}),
      loadUsers().catch(() => {}),
    ]);
  } catch (err) {
    console.error("Admin startup error:", err);
    document.getElementById("denyCard").style.display = "";
  }
}

// تشغيل
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    if (window.auth) {
      startAdmin();
    } else {
      window.addEventListener("auth0:ready", startAdmin, { once: true });
    }
  });
} else {
  if (window.auth) {
    startAdmin();
  } else {
    window.addEventListener("auth0:ready", startAdmin, { once: true });
  }
}
