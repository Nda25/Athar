// assets/js/require-auth.js — unified guard for Athar
(async () => {
  // ======== Config (عدّليها حسب مشروعك) ========
  const AUTH0_DOMAIN  = "dev-2f0fmbtj6u8o7en4.us.auth0.com";
  const AUTH0_CLIENT  = "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU";
  const AUTH0_AUDIENCE = "https://api.athar"; // لما تحتاجين Access Token لاحقًا
  const REDIRECT_URI  = window.location.origin + "/";

  // ملفات عامة لا تحتاج تسجيل/تحقق خطة
  const PUBLIC_FILES = new Set(["", "index.html", "pricing.html", "plans.html"]);

  // خطط مسموح بها لغير الأدمن (عدّلي القائمة حسب سياستك)
  const ALLOW_PLANS = new Set(["trial", "free", "lifetime_free", "pro", "school"]);

  // أسماء الكليمس المستخدمة
  const CLAIM_ADMIN_FLAG  = "https://athar/admin";
  const CLAIM_ROLES       = "https://athar/roles";
  const CLAIM_APP_META    = "https://n-athar.co/app_metadata";

  // ======== Helpers ========
  function currentFile() {
    const path = location.pathname.replace(/\/+$/, "");
    const file = path.split("/").pop();
    return file || ""; // "/" → ""
  }
  function goPlans()   { location.replace("/plans.html"); }
  function isAdminFromClaims(claims) {
    const roles = (claims && claims[CLAIM_ROLES]) || [];
    const hasRole = Array.isArray(roles) && roles.includes("admin");
    const flag    = !!(claims && claims[CLAIM_ADMIN_FLAG] === true);
    // دعم احتياطي لو حقنتِ role داخل app_metadata
    const meta    = (claims && claims[CLAIM_APP_META]) || {};
    return hasRole || flag || (meta && meta.role === "admin");
  }
  function getPlanFromClaims(claims) {
    const meta = (claims && claims[CLAIM_APP_META]) || {};
    return meta.plan || "free";
  }
  async function waitForWindowAuth(max = 50) {
    for (let i = 0; i < max && !(window.auth && typeof window.auth.isAuthenticated === "function"); i++) {
      await new Promise(r => setTimeout(r, 100));
    }
    return !!(window.auth && typeof window.auth.isAuthenticated === "function");
  }
  async function ensureAuth0Sdk() {
    if (window.auth0 && typeof window.auth0.createAuth0Client === "function") return true;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://unpkg.com/@auth0/auth0-spa-js@2.2.0/dist/auth0-spa-js.production.js";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return true;
  }
  async function buildTempClient() {
    await ensureAuth0Sdk();
    return await window.auth0.createAuth0Client({
      domain: AUTH0_DOMAIN,
      clientId: AUTH0_CLIENT,
      cacheLocation: "localstorage",
      authorizationParams: { redirect_uri: REDIRECT_URI, audience: AUTH0_AUDIENCE, scope: "openid profile email" }
    });
  }
  async function cleanupRedirectIfNeeded(client) {
    if (location.search.includes("code=") && location.search.includes("state=")) {
      try {
        await client.handleRedirectCallback();
        history.replaceState({}, document.title, location.pathname + location.hash);
      } catch (e) {
        // تجاهل
      }
    }
  }

  // ======== 0) الصفحات العامة: خروج مبكّر مع تنظيف العودة من Auth0 ========
  const file = currentFile();
  if (PUBLIC_FILES.has(file)) {
    try {
      const tmp = await buildTempClient();
      await cleanupRedirectIfNeeded(tmp);
    } catch { /* لا شيء */ }
    return; // السماح للصفحات العامة
  }

  // ======== 1) الصفحات المحمية: تحقق تسجيل الدخول + الصلاحيات ========
  let client = null;
  let isAuth = false;
  let claims = null;
  let user   = null;

  try {
    if (await waitForWindowAuth()) {
      // نستخدم window.auth اللي جهزه app.js
      isAuth = await window.auth.isAuthenticated();
      if (!isAuth) {
        await window.auth.login({ authorizationParams: { screen_hint: "login", redirect_uri: window.location.href } });
        return;
      }
      // claims + user
      claims = await window.auth.getIdTokenClaims();
      user   = await window.auth.getUser();
    } else {
      // نبني عميل مؤقت
      client = await buildTempClient();
      await cleanupRedirectIfNeeded(client);

      isAuth = await client.isAuthenticated();
      if (!isAuth) {
        await client.loginWithRedirect({ authorizationParams: { screen_hint: "login", redirect_uri: window.location.href } });
        return;
      }
      claims = await client.getIdTokenClaims();
      user   = await client.getUser();
    }
  } catch (e) {
    console.warn("[Guard] auth check error:", e);
    return goPlans();
  }

  if (!isAuth) return goPlans();

  // 2) سياسة الوصول: admin.html يتطلب أدمن، وباقي المحمية تتطلب خطة مسموح بها أو أدمن
  const adminRequired = location.pathname.endsWith("/admin.html");
  const isAdmin = isAdminFromClaims(claims);

  if (adminRequired && !isAdmin) return goPlans();

  const plan = getPlanFromClaims(claims);
  const allowed = isAdmin || ALLOW_PLANS.has(plan);
  if (!allowed) return goPlans();

  // 3) (اختياري لكن مفيد) — تحديث/إدراج المستخدم في قاعدة البيانات
  try {
    const u = user || {};
    if (u.sub && u.email) {
      await fetch("/.netlify/functions/upsert-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sub: u.sub,
          email: String(u.email).toLowerCase(),
          name: u.name || u.nickname || null,
          picture: u.picture || null
        })
      });
    }
  } catch (e) {
    console.warn("[Guard] upsert-user call failed:", e);
  }

  // وصلنا هنا؟ ممتاز — المستخدم مخوّل يكمّل 👍
})();
