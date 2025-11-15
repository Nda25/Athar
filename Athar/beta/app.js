/* ============================
 * Athar - app.js (Optimized with Rotating Banners)
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

document.addEventListener("click", (e) => {
  if (e.target.closest(".modal [data-close]")) {
    e.preventDefault();
    e.target.closest(".modal").classList.remove("show");
  }
});

// === Logic: Auth & Supabase ===

const performAuthAction = (hint, extra = {}) => {
  const params = {
    authorizationParams: {
      screen_hint: hint,
      redirect_uri: CALLBACK,
      ...extra,
    },
  };
  (window.auth?.loginWithRedirect || window.auth?.login)?.call(
    window.auth,
    params
  );
};

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

async function toggleAdminButton() {
  const adminBtn = document.getElementById("adminBtn");
  if (!adminBtn) return;

  try {
    if (!(await window.auth?.isAuthenticated?.())) {
      adminBtn.style.display = "none";
      return;
    }

    const claims = await window.auth.getIdTokenClaims();
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

  const checkAuth = async () => {
    try {
      const ok = await (window.auth?.isAuthenticated?.() ??
        window.auth0Client?.isAuthenticated?.());
      setButtons(!!ok);
    } catch {
      setButtons(false);
    }
  };

  window.addEventListener("auth0:ready", checkAuth, { once: true });
  if (window.auth?.isAuthenticated) checkAuth();
}

async function logToolViewIfAny() {
  try {
    const file = (location.pathname.split("/").pop() || "")
      .replace(".html", "")
      .toLowerCase();
    const alias = { athar: "muntalaq", darsi: "murtakaz" };
    const tool = alias[file] || file;

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

// === Initialization ===
document.addEventListener("DOMContentLoaded", () => {
  bindThemeToggle();
  bindAuthButtons();
  mountRotatingBanners();

  const onAuthReady = async () => {
    await Promise.allSettled([
      supaEnsureUserFromAuth0(),
      toggleAdminButton(),
      logToolViewIfAny(),
    ]);
  };

  window.addEventListener("auth0:ready", onAuthReady, { once: true });
  if (window.auth) onAuthReady();
});
