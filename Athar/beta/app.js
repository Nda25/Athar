/* ============================
 * Athar - app.js (Optimized)
 * ============================ */

// === Constants & Configuration ===
const FLAG_RESET = "ATHAR_V2_READY";
const NS_MAIN = "https://n-athar.co/";
const NS_ALT = "https://athar.co/";

// Determine Environment
const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
const CALLBACK = isLocal
  ? "http://localhost:8888/profile.html"
  : "https://n-athar.co/profile.html";
const RETURN_TO = isLocal ? "http://localhost:8888" : "https://n-athar.co";

// Auth0 Defaults
window.AUTH0_DOMAIN ??= "dev-2f0fmbtj6u8o7en4.us.auth0.com";
window.AUTH0_CLIENT ??= "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU";

console.log(`[Auth] redirect: ${CALLBACK} | return: ${RETURN_TO}`);

// === Utilities ===
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// === Hard Reset (Self-executing) ===
(function hardResetOnce() {
  try {
    if (!localStorage.getItem(FLAG_RESET)) {
      localStorage.clear();
      sessionStorage.clear();
      if (window.indexedDB?.databases) {
        indexedDB
          .databases()
          .then((dbs) =>
            dbs.forEach((db) => indexedDB.deleteDatabase(db.name))
          );
      }
      localStorage.setItem(FLAG_RESET, "1");
      console.log("[Athar] Storage reset done.");
    }
  } catch (_) {}
})();

// === UI: Theme Management ===
const root = document.documentElement;
// Consolidate theme initialization
(() => {
  // Move dark class from body to root if present, or check storage
  const isDark =
    document.body.classList.contains("dark") ||
    localStorage.getItem("theme") === "dark";
  document.body.classList.remove("dark");
  root.classList.toggle("dark", isDark);
})();

function bindThemeToggle() {
  const btn = document.getElementById("themeToggle");
  if (!btn) return;

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    const isDark = root.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    if (window.toast)
      toast(isDark ? "تم تفعيل الوضع الداكن" : "تم تفعيل الوضع الفاتح");
  });
}

// === UI: Toast ===
window.toast ??= (msg) => {
  let t = $(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1800);
};

// === UI: Modals ===
window.openModal ??= (id) => $(id)?.classList.add("show");
window.closeModal ??= (id) => $(id)?.classList.remove("show");

// Event Delegation for modal closing (Optimization: 1 listener instead of N)
document.addEventListener("click", (e) => {
  if (e.target.closest(".modal [data-close]")) {
    e.preventDefault();
    e.target.closest(".modal").classList.remove("show");
  }
});

// === Logic: Auth & Supabase ===

/** Unified method to perform login or register */
const performAuthAction = (hint, extra = {}) => {
  const params = {
    authorizationParams: {
      screen_hint: hint,
      redirect_uri: CALLBACK,
      ...extra,
    },
  };
  // Support both SDK versions/methods seamlessly
  (window.auth?.loginWithRedirect || window.auth?.login)?.call(
    window.auth,
    params
  );
};

/** Sync Auth0 user to Supabase */
async function supaEnsureUserFromAuth0() {
  try {
    const u = await window.auth?.getUser();
    if (!u?.email) return;

    const payload = {
      email: u.email.toLowerCase(),
      name: u.name || u.nickname || null,
    };

    if (window.supaEnsureUser)
      await window.supaEnsureUser({
        email: payload.email,
        full_name: payload.name,
      });
    else if (window.supaEnsureUserProfile)
      await window.supaEnsureUserProfile({
        ...payload,
        sub: u.sub,
        picture: u.picture || null,
      });
  } catch (_) {}
}

/** Check Admin Status */
async function toggleAdminButton() {
  const adminBtn = document.getElementById("adminBtn");
  if (!adminBtn) return;

  try {
    if (!(await window.auth?.isAuthenticated?.())) {
      adminBtn.style.display = "none";
      return;
    }

    const claims = await window.auth.getIdTokenClaims();
    // Check roles in both namespaces or direct admin flag
    const roles =
      claims?.[NS_MAIN + "roles"] || claims?.[NS_ALT + "roles"] || [];
    const isAdmin =
      roles.includes("admin") ||
      claims?.[NS_MAIN + "admin"] === true ||
      claims?.[NS_ALT + "admin"] === true;

    adminBtn.style.display = isAdmin ? "inline-flex" : "none";
  } catch (err) {
    console.error("Admin Check Error:", err);
    adminBtn.style.display = "none";
  }
}

/** Manage Auth Buttons State */
function bindAuthButtons() {
  const loginBtn = document.getElementById("loginBtn");
  const registerBtn = document.getElementById("registerBtn");
  const logoutBtn = document.getElementById("logout");
  const profileLink = document.getElementById("nav-profile");
  const inviteCode = new URLSearchParams(location.search).get("code");

  const setButtons = (isAuth) => {
    if (loginBtn) loginBtn.style.display = isAuth ? "none" : "";
    if (registerBtn) registerBtn.style.display = isAuth ? "none" : "";
    if (logoutBtn) logoutBtn.style.display = isAuth ? "" : "none";
    if (profileLink) profileLink.style.display = isAuth ? "" : "none";
  };

  // Expose for external use if needed
  window.__setAuthButtons = setButtons;
  setButtons(false);

  if (loginBtn) loginBtn.onclick = () => performAuthAction("login");
  if (registerBtn)
    registerBtn.onclick = () =>
      performAuthAction("signup", inviteCode ? { code: inviteCode } : {});

  if (logoutBtn) {
    logoutBtn.onclick = () => {
      if (window.auth?.logout) return window.auth.logout();
      window.auth0Client?.logout?.({ logoutParams: { returnTo: RETURN_TO } });
    };
  }

  // Check auth state helper
  const checkAuth = async () => {
    try {
      const ok = await (window.auth?.isAuthenticated?.() ??
        window.auth0Client?.isAuthenticated?.());
      setButtons(!!ok);
    } catch {
      setButtons(false);
    }
  };

  // Listen or check immediately
  window.addEventListener("auth0:ready", checkAuth, { once: true });
  if (window.auth?.isAuthenticated) checkAuth();
}

/** Log Tool Usage based on URL */
async function logToolViewIfAny() {
  try {
    const file = (location.pathname.split("/").pop() || "")
      .replace(".html", "")
      .toLowerCase();
    // Aliases map
    const alias = { athar: "muntalaq", darsi: "murtakaz" };
    const tool = alias[file] || file;

    // List of valid tools to log (derived from original code comments)
    const validTools = [
      "muntalaq",
      "murtakaz",
      "miyad",
      "masar",
      "ethraa",
      "mulham",
    ];

    if (validTools.includes(tool) && window.supaLogToolUsage) {
      await window.supaLogToolUsage(`${tool}:view`);
    }
  } catch (_) {}
}

// === Banners ===

/** Announcement Banner */
async function mountAnnouncementBar() {
  try {
    console.log("[Announcement] Fetching...");

    const res = await fetch("/.netlify/functions/admin-announcement?latest=1", {
      cache: "no-store",
    });

    console.log("[Announcement] Response status:", res.status);

    if (!res.ok) {
      console.error("[Announcement] Response not OK");
      return;
    }

    const data = await res.json();
    console.log("[Announcement] Data received:", data);

    const ann = data.latest; // هنا الفرق!

    if (!ann || !ann.active || !ann.text) {
      console.log("[Announcement] No active announcement:", ann);
      return;
    }

    console.log("[Announcement] Creating banner...");

    const bar = document.createElement("div");
    bar.dir = "rtl";
    bar.style.cssText =
      "background:#1f2937;color:#fff;padding:10px 14px;text-align:center;font-weight:800;z-index:9999;position:relative;";
    bar.textContent = ann.text;
    document.body.prepend(bar);

    console.log("[Announcement] Banner mounted!");
  } catch (err) {
    console.error("[Announcement] Error:", err);
  }
}

/** Trial Banner */
async function mountTrialBanner() {
  try {
    if (!(await window.auth?.isAuthenticated?.())) return;

    const claims = await window.auth.getIdTokenClaims();
    const status = claims?.[NS_MAIN + "status"] ?? claims?.[NS_ALT + "status"];
    const expStr =
      claims?.[NS_MAIN + "trial_expires"] ?? claims?.[NS_ALT + "trial_expires"];

    if (status !== "trial" || !expStr) return;

    const exp = new Date(expStr);
    if (isNaN(exp)) return;

    const getDaysLeft = () =>
      Math.max(0, Math.ceil((exp - Date.now()) / 864e5)); // 864e5 = 1 day in ms
    const dLeft = getDaysLeft();
    if (dLeft <= 0) return;

    const bar = document.createElement("div");
    Object.assign(bar, { dir: "rtl", id: "trial-banner" });
    bar.style.cssText =
      "background:#fde68a;color:#1f2937;padding:10px 14px;text-align:center;font-weight:700";

    const updateText = (n) =>
      (bar.textContent = `أنتِ على الخطة التجريبية — تبقّى ${n} يوم`);
    updateText(dLeft);

    // Insert after existing top banner or at top
    const first = document.body.firstElementChild;
    first
      ? first.insertAdjacentElement("afterend", bar)
      : document.body.prepend(bar);

    const timer = setInterval(() => {
      const n = getDaysLeft();
      if (n <= 0) {
        clearInterval(timer);
        bar.remove();
      } else updateText(n);
    }, 3600000); // Update every hour
  } catch (_) {}
}

// === Initialization ===
document.addEventListener("DOMContentLoaded", () => {
  bindThemeToggle();
  bindAuthButtons();
  mountAnnouncementBar();

  const onAuthReady = async () => {
    await Promise.allSettled([
      supaEnsureUserFromAuth0(),
      toggleAdminButton(),
      logToolViewIfAny(),
      mountTrialBanner(),
    ]);
  };

  window.addEventListener("auth0:ready", onAuthReady, { once: true });
  // If Auth0 loaded before DOM
  if (window.auth) onAuthReady();
});
