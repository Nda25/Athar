// assets/js/require-auth.js — Athar Guard (status-based)
(async () => {
  const AUTH0_DOMAIN = "dev-2f0fmbtj6u8o7en4.us.auth0.com";
  const AUTH0_CLIENT = "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU";
  const REDIRECT_URI = window.location.origin + "/";
  const NS = "https://athar.co/"; // نفس الـ namespace المستخدم في الأكشن

  // صفحات عامة (بدون تسجيل دخول)
  const PUBLIC = new Set(["", "index.html", "pricing.html"]);

  // صفحات البرامج (مقفلة إلا لو status=active أو Admin)
  const PROGRAM_PAGES = new Set([
    "athar.html",      // مُنطلق
    "darsi.html",      // مُرتكز
    "masar.html",      // مسار
    "miyad.html",      // ميعاد
    "ethraa.html",     // إثراء
    "mulham.html"      // مُلهم
  ]);

  function fileName() {
    const path = location.pathname.replace(/\/+$/, "");
    const f = path.split("/").pop();
    return f || "";
  }

  async function ensureAuth0Sdk() {
    if (window.auth0 && typeof window.auth0.createAuth0Client === "function") return true;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://unpkg.com/@auth0/auth0-spa-js@2.2.0/dist/auth0-spa-js.production.js";
      s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
    });
    return true;
  }
  async function tempClient() {
    await ensureAuth0Sdk();
    return await window.auth0.createAuth0Client({
      domain: AUTH0_DOMAIN,
      clientId: AUTH0_CLIENT,
      cacheLocation: "localstorage",
      authorizationParams: { redirect_uri: REDIRECT_URI, scope: "openid profile email" }
    });
  }
  async function cleanupRedirect(client) {
    if (location.search.includes("code=") && location.search.includes("state=")) {
      try {
        await client.handleRedirectCallback();
        history.replaceState({}, document.title, location.pathname + location.hash);
      } catch {}
    }
  }
  async function waitWindowAuth(max = 50) {
    for (let i = 0; i < max && !(window.auth && window.auth.isAuthenticated); i++) {
      await new Promise(r => setTimeout(r, 100));
    }
    return !!(window.auth && window.auth.isAuthenticated);
  }

  function go(to) { location.replace(to); }
  function goProfile(reason) {
    const q = reason ? `?reason=${encodeURIComponent(reason)}` : "";
    go("/profile.html" + q);
  }
  function goLogin(currentUrl) {
    if (window.auth && window.auth.login) {
      return window.auth.login({ authorizationParams: { screen_hint: "login", redirect_uri: currentUrl } });
    }
    // fallback
    return tempClient().then(c => c.loginWithRedirect({
      authorizationParams: { screen_hint: "login", redirect_uri: currentUrl }
    }));
  }

  // 0) عام: سماح للصفحات العامة + تنظيف العودة إن وجدت
  const file = fileName();
  if (PUBLIC.has(file)) {
    try { const c = await tempClient(); await cleanupRedirect(c); } catch {}
    return;
  }

  // 1) لازم تسجيل دخول لبقية الصفحات
  let isAuth = false, claims = null, user = null;
  try {
    if (await waitWindowAuth()) {
      isAuth = await window.auth.isAuthenticated();
      if (!isAuth) return goLogin(window.location.href);
      claims = await window.auth.getIdTokenClaims();
      user   = await window.auth.getUser();
    } else {
      const c = await tempClient();
      await cleanupRedirect(c);
      isAuth = await c.isAuthenticated();
      if (!isAuth) return goLogin(window.location.href);
      claims = await c.getIdTokenClaims();
      user   = await c.getUser();
    }
  } catch (e) {
    console.warn("[Guard] auth error:", e);
    return go("/index.html");
  }

  // 2) استخرج الصلاحيات والحالة
  const roles  = (claims && claims[NS + "roles"]) || [];
  const isAdmin = Array.isArray(roles) && roles.includes("admin") || claims?.[NS + "admin"] === true;
  const status = (claims && claims[NS + "status"]) || "pending";

  // 3) سياسة الوصول:
  // - admin.html للأدمن فقط
  if (location.pathname.endsWith("/admin.html")) {
    if (!isAdmin) return go("/index.html");
    return; // تمام
  }

  // - profile.html: مسموح لأي مستخدم مسجّل (حتى pending)
  if (file === "profile.html") {
    return; // السماح
  }

  // - صفحات البرامج: لازم status=active (أو Admin)
  if (PROGRAM_PAGES.has(file)) {
    if (isAdmin || status === "active") return; // سماح
    return goProfile("not_active");
  }

  // الصفحات الأخرى (إن وُجدت) خلّها تتبع نفس شرط البرامج افتراضيًا
  if (!isAdmin && status !== "active") {
    return goProfile("not_active");
  }
})();
