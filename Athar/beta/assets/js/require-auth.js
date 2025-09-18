<!-- assets/js/require-auth.js (نسخة حديثة) -->
(async () => {
  // إعدادات Auth0 (مثل app.js)
  const AUTH0_DOMAIN = "dev-2f0fmbtj6u8o7en4.us.auth0.com";
  const AUTH0_CLIENT = "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU";
  const REDIRECT_URI = window.location.origin + "/";

  // صفحات عامة (تُفتح للجميع). أي صفحة غيرها تعتبر محمية.
  const PUBLIC_FILES = new Set(["", "index.html", "pricing.html"]);

  function goPricing() {
    location.replace("/pricing.html");
  }

  function currentFile() {
    const path = location.pathname.replace(/\/+$/, "");
    const file = path.split("/").pop();
    return file || ""; // "/" → ""
  }

  // انتظري window.auth من app.js إن كان موجود
  async function waitForWindowAuth(max = 50) {
    for (let i = 0; i < max && !(window.auth && typeof window.auth.isAuthenticated === "function"); i++) {
      await new Promise(r => setTimeout(r, 100));
    }
    return !!(window.auth && typeof window.auth.isAuthenticated === "function");
  }

  // حمّلي UMD SDK عند الحاجة (ونستخدم window.auth0.createAuth0Client)
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
      authorizationParams: { redirect_uri: REDIRECT_URI }
    });
  }

  // 1) لو الصفحة عامة، نسمح و(اختياري) ننظّف باراميترات العودة من Auth0
  const file = currentFile();
  if (PUBLIC_FILES.has(file)) {
    try {
      // تنظيف code/state إن وُجد
      if (location.search.includes("code=") && location.search.includes("state=")) {
        const tmp = await buildTempClient();
        await tmp.handleRedirectCallback();
        history.replaceState({}, document.title, location.pathname);
      }
    } catch(_) {}
    return;
  }

  // 2) الصفحات المحمية
  // نحاول استخدام window.auth أولاً (من app.js)، وإلا نبني عميل مؤقت
  let isAuth = false;
  let claims = null;

  try {
    if (await waitForWindowAuth()) {
      isAuth = await window.auth.isAuthenticated();
      if (isAuth && typeof window.auth.getIdTokenClaims === "function") {
        claims = await window.auth.getIdTokenClaims();
      }
    } else {
      const tmp = await buildTempClient();

      // تنظيف code/state إذا رجعنا من Auth0
      if (location.search.includes("code=") && location.search.includes("state=")) {
        await tmp.handleRedirectCallback();
        history.replaceState({}, document.title, location.pathname);
      }

      isAuth = await tmp.isAuthenticated();
      if (isAuth) claims = await tmp.getIdTokenClaims();
    }
  } catch (e) {
    console.warn("[Guard] auth check error:", e);
    return goPricing();
  }

  if (!isAuth) return goPricing();

  // 3) نقرأ الخطة/الدور من الكليم الموحّد الذي وضعناه في Action:
  //   api.idToken.setCustomClaim("https://n-athar.co/app_metadata", event.user.app_metadata || {})
  const meta = claims?.["https://n-athar.co/app_metadata"] || {};
  const plan = meta.plan || "free";
  const role = meta.role || "user";

  // سياسة السماح:
  // - admin مسموح دائمًا
  // - باقي المستخدمين: اسمحي لهذي الخطط فقط (عدّليها حسب رغبتك)
  const ALLOW_PLANS = new Set(["trial", "free", "lifetime_free"]);
  const allowed = role === "admin" || ALLOW_PLANS.has(plan);

  if (!allowed) return goPricing();

  // وصلنا هنا؟ إذًا المستخدم مخوّل 👌
})();
