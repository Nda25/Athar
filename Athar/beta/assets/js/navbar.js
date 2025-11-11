/**
 * Navbar Component Logic
 * Handles theme toggle, auth buttons, and navbar interactions
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

  // ============ Theme Toggle ============
  function initThemeToggle() {
    const btn = document.getElementById("themeToggle");
    if (!btn) {
      console.warn("Theme toggle button not found");
      return;
    }

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const root = document.documentElement;
      const isDark = root.classList.toggle("dark");
      try {
        localStorage.setItem("theme", isDark ? "dark" : "light");
      } catch (_) {}
      toast(isDark ? "تم تفعيل الوضع الداكن" : "تم تفعيل الوضع الفاتح");
    });

    // Restore theme preference
    try {
      if (localStorage.getItem("theme") === "dark") {
        document.documentElement.classList.add("dark");
      }
    } catch (_) {}
  }

  // ============ Auth Button Logic ============
  function bindAuthCTA() {
    const btn = document.getElementById("authCta");
    const logoutBtn = document.getElementById("logout");
    const auth = window.auth; // from require-auth.js

    if (!btn) {
      console.warn("Auth CTA button not found");
      return;
    }

    if (!auth) {
      console.warn("Auth0 not initialized yet");
      btn.disabled = false;
      return;
    }

    // Login/Register button
    btn.disabled = false;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      auth.loginWithRedirect({
        authorizationParams: {
          redirect_uri: window.location.origin + "/profile.html",
          // screen_hint: 'signup' // uncomment to show signup directly
        },
      });
    });

    // Logout button
    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        auth.logout({ logoutParams: { returnTo: window.location.origin } });
      });
    }
  }

  // ============ Sync Auth UI ============
  function syncAuthButtons() {
    const auth = window.auth; // from require-auth.js
    if (!auth) {
      console.warn("Auth0 not available for sync");
      return;
    }

    try {
      auth.isAuthenticated().then((ok) => {
        updateAuthButtons(ok);
      });
    } catch (error) {
      console.error("Error checking authentication:", error);
      updateAuthButtons(false);
    }
  }

  function updateAuthButtons(isAuthed) {
    const showEl = (el, show) => {
      if (!el) return;
      el.style.display = show ? "inline-flex" : "none";
    };

    showEl(document.getElementById("authCta"), !isAuthed); // Login/Register button
    showEl(document.getElementById("logout"), isAuthed); // Logout button
    showEl(document.getElementById("nav-profile"), isAuthed); // Profile link
    showEl(document.getElementById("adminBtn"), isAuthed); // Admin panel link (can be enhanced with role check)
  }

  // ============ Wait for navbar to be loaded in DOM ============
  function waitForNavbar(callback, attempts = 0) {
    const authCta = document.getElementById("authCta");
    const themeToggle = document.getElementById("themeToggle");

    if (authCta && themeToggle) {
      // Navbar components are in DOM
      callback();
    } else if (attempts < 50) {
      // Keep trying for up to 5 seconds (50 * 100ms)
      setTimeout(() => waitForNavbar(callback, attempts + 1), 100);
    } else {
      console.error("Navbar components failed to load after timeout");
    }
  }

  // ============ Initialize on DOM Ready ============
  function init() {
    // Wait for navbar to be loaded, then initialize
    waitForNavbar(() => {
      initThemeToggle();
      bindAuthCTA();
      syncAuthButtons();
    });
  }

  // Wait for DOM to be ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Also bind when Auth0 is ready
  document.addEventListener("auth0:ready", () => {
    bindAuthCTA();
    syncAuthButtons();
  });
})();
