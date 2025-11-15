/**
 * Navbar Component Logic
 * Handles theme toggle, auth buttons, and mobile menu interactions
 */
(function () {
  // Utility: Toast notification
  const toast = (message) => {
    const toastEl = document.getElementById("toast");
    if (!toastEl) {
      console.log(message);
      return;
    }
    toastEl.textContent = message;
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 1500);
  };

  // ============ Mobile Menu Logic (NEW) ============
  function initMobileMenu() {
    const menuBtn = document.getElementById("mobileMenuBtn");
    const navLinks = document.getElementById("navLinksMenu");

    if (menuBtn && navLinks) {
      menuBtn.addEventListener("click", () => {
        navLinks.classList.toggle("active");
        // تغيير أيقونة الزر
        menuBtn.textContent = navLinks.classList.contains("active") ? "✕" : "☰";
      });

      // إغلاق القائمة عند الضغط على أي رابط
      navLinks.querySelectorAll("a, button").forEach((link) => {
        link.addEventListener("click", () => {
          // لا نغلق القائمة إذا كان الزر هو themeToggle لأنه موجود خارج القائمة
          navLinks.classList.remove("active");
          menuBtn.textContent = "☰";
        });
      });
    }
  }

  // ============ Theme Toggle (Existing) ============
  function initThemeToggle() {
    const btn = document.getElementById("themeToggle");
    if (!btn) return;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const root = document.documentElement;
      const isDark = root.classList.toggle("dark");
      try {
        localStorage.setItem("theme", isDark ? "dark" : "light");
      } catch (_) {}
      // تحديث نص الـ Toast ليكون ألطف
      toast(isDark ? "🌙 الوضع الليلي" : "☀️ الوضع النهاري");
    });

    try {
      if (localStorage.getItem("theme") === "dark") {
        document.documentElement.classList.add("dark");
      }
    } catch (_) {}
  }

  // ============ Auth Button Logic (Existing) ============
  function bindAuthCTA() {
    const btn = document.getElementById("authCta");
    const logoutBtn = document.getElementById("logout");
    const auth = window.auth;

    if (!btn) return; // Silent return if elements not found yet

    if (!auth) {
      setTimeout(bindAuthCTA, 500);
      return;
    }

    btn.disabled = false;
    btn.onclick = null;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      auth.loginWithRedirect({
        authorizationParams: {
          redirect_uri: window.location.origin + "/profile.html",
        },
      });
    });

    if (logoutBtn) {
      logoutBtn.onclick = null;
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        auth.logout({ logoutParams: { returnTo: window.location.origin } });
      });
    }
  }

  // ============ Sync Auth UI (Existing) ============
  function syncAuthButtons() {
    const auth = window.auth;
    if (!auth) {
      setTimeout(syncAuthButtons, 500);
      return;
    }

    auth
      .isAuthenticated()
      .then((ok) => updateAuthButtons(ok))
      .catch(() => updateAuthButtons(false));
  }

  function updateAuthButtons(isAuthed) {
    const showEl = (el, show) => {
      if (!el) return;
      // في التصميم الجديد نستخدم flex، لكن display: none يخفي العنصر تماماً
      if (show) {
        el.style.removeProperty("display"); // Remove inline display none
        el.style.display = "inline-flex"; // Ensure flex behavior
      } else {
        el.style.display = "none";
      }
    };

    showEl(document.getElementById("authCta"), !isAuthed);
    showEl(document.getElementById("logout"), isAuthed);
    showEl(document.getElementById("nav-profile"), isAuthed);
    showEl(document.getElementById("adminBtn"), isAuthed);
  }

  // ============ Init ============
  function init() {
    // نحاول العثور على العناصر عدة مرات إذا لم تكن موجودة
    const checkElements = setInterval(() => {
      const navLinks = document.getElementById("navLinksMenu");
      if (navLinks) {
        clearInterval(checkElements);
        initThemeToggle();
        initMobileMenu(); // New Function
        bindAuthCTA();
        syncAuthButtons();
      }
    }, 100);

    // إيقاف المحاولة بعد 5 ثواني لتجنب الذاكرة
    setTimeout(() => clearInterval(checkElements), 5000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  document.addEventListener("auth0:ready", () => {
    bindAuthCTA();
    syncAuthButtons();
  });
})();
