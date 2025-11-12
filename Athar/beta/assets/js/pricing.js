// ========== Pricing Page Main Script ==========

// Set year in footer
(function () {
  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
})();

// Toast notification function
const toast = (() => {
  const showToast = (m) => {
    const t = document.querySelector("#toast");
    if (!t) {
      alert(m);
      return;
    }
    t.textContent = m;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 1500);
  };
  return showToast;
})();

// Theme toggle
(() => {
  const btn = document.getElementById("themeToggle");
  if (!btn) return;

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    const root = document.documentElement;
    const dark = root.classList.toggle("dark");
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch (_) {}
    toast(dark ? "تم تفعيل الوضع الداكن" : "تم تفعيل الوضع الفاتح");
  });

  try {
    if (localStorage.getItem("theme") === "dark")
      document.documentElement.classList.add("dark");
  } catch (_) {}
})();

// Check if user is logged in
async function isLogged() {
  try {
    return await window.auth?.isAuthenticated?.();
  } catch (_) {
    return false;
  }
}

// Get token for API calls
async function getToken() {
  try {
    return await window.auth.getTokenSilently();
  } catch (e) {
    console.warn("getTokenSilently failed, trying popup", e);
    if (window.auth?.getTokenWithPopup)
      return await window.auth.getTokenWithPopup();
    throw e;
  }
}

// Update UI based on authentication status
async function refreshAuthUI() {
  const logged = await isLogged();
  const logoutBtn = document.querySelector("#logout");
  const whoami = document.querySelector("#whoami");

  if (logged) {
    let user = null;
    try {
      user = await window.auth.getUser();
    } catch (_) {}

    if (logoutBtn) logoutBtn.style.display = "inline-flex";
    if (whoami) {
      whoami.style.display = "block";
      whoami.textContent = user?.email
        ? "مسجّل كـ " + user.email
        : "حسابك نشِط";
    }

    document
      .querySelectorAll("#choose-plan .btn[data-plan]")
      .forEach((b) => (b.textContent = "إكمال الاشتراك"));
  } else {
    if (logoutBtn) logoutBtn.style.display = "none";
    if (whoami) whoami.style.display = "none";

    document
      .querySelectorAll("#choose-plan .btn[data-plan]")
      .forEach((b) => (b.textContent = "اشترك الآن"));
  }
}

// Logout handler
(() => {
  const logoutBtn = document.querySelector("#logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      window.auth?.logout?.();
    });
  }
})();

// Promo code redemption
(() => {
  const redeemBtn = document.querySelector("#redeem");
  if (!redeemBtn) return;

  redeemBtn.addEventListener("click", async () => {
    const code = (document.querySelector("#promo")?.value || "").trim();
    const msgEl = document.querySelector("#redeem-msg");

    msgEl.textContent = "";

    if (!code) {
      msgEl.textContent = "الرجاء إدخال الرمز";
      return;
    }

    try {
      const token = await window.auth.getTokenSilently();
      const res = await fetch("/.netlify/functions/promo-redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ code }),
      });

      const out = await res.text();

      if (!res.ok) {
        msgEl.textContent = out || "تعذّر تفعيل الرمز";
        return;
      }

      const j = JSON.parse(out);
      msgEl.textContent =
        "تم التفعيل ✓، تاريخ الانتهاء: " +
        new Date(j.expires_at).toLocaleDateString("ar-SA");
    } catch (e) {
      msgEl.textContent = "تعذّر تفعيل الرمز";
    }
  });
})();

// Main subscription handler
async function subscribe(plan) {
  const btn = document.querySelector(`[data-plan="${plan}"]`);
  if (!btn) return;

  try {
    localStorage.setItem("intended_plan", plan);
  } catch (_) {}

  // Check if user is logged in
  if (!(await isLogged())) {
    try {
      localStorage.setItem("afterLogin", "/pricing.html");
    } catch (_) {}
    return window.auth?.loginWithRedirect?.();
  }

  // Prevent duplicate clicks
  if (btn.dataset.loading === "1") return;
  btn.dataset.loading = "1";

  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = "جارِ التوجيه…";

  // Get email from Auth0 session
  let email = "";
  try {
    const u = await window.auth.getUser();
    email = (u?.email || "").toLowerCase();
  } catch (_) {}

  const promo = (document.querySelector("#promo")?.value || "").trim() || null;

  try {
    const token = await getToken();
    if (!token) throw new Error("no_token");

    // Create invoice
    const res = await fetch(
      "/.netlify/functions/payments-create-invoice?ts=" + Date.now(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ plan, promo, email }),
      }
    );

    const raw = await res.text();
    let j = {};
    try {
      j = JSON.parse(raw);
    } catch {}

    if (!res.ok || !j?.url) {
      console.error("create-invoice failed", { status: res.status, raw });
      alert(j?.error || `تعذّر إنشاء الفاتورة (status ${res.status}).`);
      btn.disabled = false;
      btn.textContent = old;
      btn.dataset.loading = "";
      return;
    }

    // Redirect to payment page
    window.location.replace(j.url);
  } catch (e) {
    console.error("subscribe error:", e);
    alert("تعذّر إنشاء الفاتورة. جرّب تسجيل الخروج ثم الدخول مرة أخرى.");
    btn.disabled = false;
    btn.textContent = old;
    btn.dataset.loading = "";
  }
}

// Expose subscribe function globally
window.subscribe = subscribe;

// Update UI when Auth0 is ready
window.addEventListener("auth0:ready", async () => {
  await refreshAuthUI();
  try {
    if (await isLogged()) {
      document
        .querySelectorAll("#choose-plan .btn[data-plan]")
        .forEach((b) => (b.textContent = "إكمال الاشتراك"));
    }
  } catch (_) {}
});

// Display success message if payment was successful
(() => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("paid") === "1") {
    const msg = document.createElement("div");
    msg.textContent = "🎉 تم الدفع بنجاح! شكرًا لاشتراكك في أثر.";
    msg.style.position = "fixed";
    msg.style.top = "20px";
    msg.style.left = "50%";
    msg.style.transform = "translateX(-50%)";
    msg.style.background = "#16a34a";
    msg.style.color = "white";
    msg.style.padding = "14px 22px";
    msg.style.borderRadius = "10px";
    msg.style.fontSize = "16px";
    msg.style.zIndex = "9999";
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 5000);
  }
})();

// Display message from session storage (from require-auth.js)
(() => {
  try {
    const msg = sessionStorage.getItem("athar:msg");
    if (!msg) return;
    sessionStorage.removeItem("athar:msg");

    if (typeof window.toast === "function") {
      toast(msg);
      return;
    }

    const bar = document.createElement("div");
    bar.dir = "rtl";
    bar.style.cssText =
      "background:#1f2937;color:#fff;padding:12px 16px;text-align:center;font:500 14px/1.6 system-ui;border-radius:10px;margin:12px auto;max-width:960px";
    bar.textContent = msg;
    document.body.prepend(bar);
  } catch (_) {}
})();
