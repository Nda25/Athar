// assets/js/require-auth.js
// FULL file - replace your existing file with this (do not patch lines).
// Purpose: initialize Auth0 SPA client, handle callback, and enforce protection for pages.
// Notes: this file is configured to use your Auth0 app values provided earlier.

(async () => {
  // ------- CONFIG: عدّلي القيم هنا فقط إن احتجتِ -------
  const AUTH0_DOMAIN = "dev-2f0fmbtj6u8o7en4.us.auth0.com";
  const AUTH0_CLIENT_ID = "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU";
  const API_AUDIENCE = "https://api.athar"; // لو عندك API audience استخدميه، وإلا اتركيه null
  const REDIRECT_URI = window.location.origin + window.location.pathname; // نرجع لنفس الصفحة بعد الدخول

  // ------- صفحات/ملفات عامة (تعديل لو احتجتي) -------
  const PUBLIC_FILES = new Set(["", "index.html", "pricing.html", "privacy.html", "terms.html", "programs.html", "refund-policy.html", "whatsapp.html"]);
  const LOGIN_ONLY_FILES = new Set(["profile.html"]);
  const TOOL_FILES = new Set(["athar.html","darsi.html","masar.html","miyad.html","ethraa.html","mulham.html"]);
  const ADMIN_FILE = "admin.html";

  // ------- أسماء الـ claims (namespace) المستخدمة في الواجهة/توكنات السيرفر -------
  const NS = "https://athar.co/";             // تأكدي بالـ namespace لو عندك واحد مخصص
  const CLAIM_STATUS = NS + "status";         // مثال: "https://athar.co/status"
  const CLAIM_ROLES = NS + "roles";
  const CLAIM_ADMIN = NS + "admin";

  // ------- helpers -------
  function currentFile(){
    const f = location.pathname.replace(/\/+$/,"").split("/").pop();
    return f || "";
  }
  function redirectTo(u){ location.replace(u); }

  // hide/show app root to avoid flash of protected content
  function hideAppRoot() {
    const root = document.getElementById('app-root');
    if (root) root.style.display = 'none';
  }
  function showAppRoot() {
    const root = document.getElementById('app-root');
    if (root) root.style.display = '';
  }

  function showLoading() {
    if (document.getElementById('auth-loading')) return;
    const s = document.createElement('div');
    s.id = 'auth-loading';
    s.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.8);z-index:9999';
    s.innerHTML = '<div style="padding:12px 18px;border-radius:8px;background:#fff;border:1px solid #eee">جارٍ التحقق من هوية المستخدم…</div>';
    document.body.appendChild(s);
  }
  function hideLoading() {
    const s = document.getElementById('auth-loading');
    if (s) s.remove();
  }

  // ensure auth0 spa script loaded (cdn)
  async function ensureAuth0SDK(){
    if (window.createAuth0Client) return;
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdn.auth0.com/js/auth0-spa-js/2.1/auth0-spa-js.production.js";
      s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }

  // Start by hiding app content to prevent bypass via back button / flash
  hideAppRoot();
  showLoading();

  try {
    await ensureAuth0SDK();
  } catch (e) {
    console.error("Failed to load Auth0 SDK:", e);
    hideLoading();
    showAppRoot();
    return;
  }

  // create client
  const auth0Options = {
    domain: AUTH0_DOMAIN,
    client_id: AUTH0_CLIENT_ID,
    cacheLocation: "localstorage", // يساعد بعدم طلب تسجيل متكرر؛ لو تريدي أمنيّة أعلى استخدمي 'memory'
    useRefreshTokens: true,
    authorizationParams: {
      redirect_uri: REDIRECT_URI,
      scope: "openid profile email"
    }
  };
  if (API_AUDIENCE) auth0Options.authorizationParams.audience = API_AUDIENCE;

  let auth0 = null;
  try {
    auth0 = await createAuth0Client(auth0Options);
    window.__auth0 = auth0; // expose if needed
  } catch (e) {
    console.error("createAuth0Client failed:", e);
    hideLoading();
    showAppRoot();
    return;
  }

  // If URL contains code/state -> handle callback then remove query string
  async function handleCallbackIfPresent(){
    const search = window.location.search;
    if (search.includes("code=") && search.includes("state=")) {
      try {
        await auth0.handleRedirectCallback();
      } catch (err) {
        console.error("Auth0 callback handling error:", err);
        // continue anyway, we will redirect to login if needed
      } finally {
        // remove query params to avoid re-processing on refresh
        const url = new URL(window.location.href);
        url.search = "";
        window.history.replaceState({}, document.title, url.toString());
      }
    }
  }

  await handleCallbackIfPresent();

  // helper to check admin & status claims
  function isAdmin(claims) {
    if (!claims) return false;
    try {
      const roles = claims[CLAIM_ROLES] || [];
      if (Array.isArray(roles) && roles.includes("admin")) return true;
      if (claims[CLAIM_ADMIN] === true) return true;
    } catch {}
    return false;
  }
  function userStatus(claims) {
    return claims ? (claims[CLAIM_STATUS] || "") : "";
  }

  // Force login helper
  async function forceLogin(extra = {}) {
    const params = { authorizationParams: { redirect_uri: REDIRECT_URI, ...extra } };
    try {
      await auth0.loginWithRedirect(params);
    } catch (e) {
      console.error("loginWithRedirect error:", e);
      hideLoading();
      const msg = document.createElement('div');
      msg.innerText = 'حدث خطأ أثناء التوجيه لصفحة الدخول. الرجاء المحاولة لاحقاً.';
      document.body.appendChild(msg);
      showAppRoot();
    }
  }

  // main enforcement
  try {
    const file = currentFile();

    // public pages: we still build client & handle callback, but don't require auth
    if (PUBLIC_FILES.has(file)) {
      hideLoading();
      showAppRoot();
      return;
    }

    // profile-only page (force login but not necessarily active membership)
    if (LOGIN_ONLY_FILES.has(file)) {
      const isAuth = await auth0.isAuthenticated();
      if (!isAuth) return await forceLogin();
      hideLoading();
      showAppRoot();
      return;
    }

    // protected pages: require auth
    const isAuth = await auth0.isAuthenticated();
    if (!isAuth) {
      // will redirect to Auth0; on return handleCallbackIfPresent will clear query
      return await forceLogin();
    }

    // get claims to examine custom app claims
    let claims = null;
    try { claims = await auth0.getIdTokenClaims(); } catch (e) { console.warn("getIdTokenClaims failed", e); }

    // admin page
    if (file === ADMIN_FILE) {
      if (!isAdmin(claims)) {
        // not allowed -> send to public pricing
        return redirectTo("/pricing.html");
      }
      hideLoading();
      showAppRoot();
      return;
    }

    // tool pages require active membership
    if (TOOL_FILES.has(file)) {
      const st = userStatus(claims);
      if (st !== "active") {
        sessionStorage.setItem("athar:msg", "حسابك غير مُفعّل بعد. يرجى انتظار التفعيل أو الاشتراك.");
        return redirectTo("/programs.html");
      }
      hideLoading();
      showAppRoot();
      return;
    }

    // default protected: require active membership
    const st = userStatus(claims);
    if (st !== "active") {
      sessionStorage.setItem("athar:msg", "حسابك غير مُفعّل بعد. يرجى انتظار التفعيل أو الاشتراك.");
      return redirectTo("/programs.html");
    }

    // all checks passed: show app
    hideLoading();
    showAppRoot();

  } catch (err) {
    console.error("Auth enforcement error:", err);
    hideLoading();
    showAppRoot();
  }
})();
