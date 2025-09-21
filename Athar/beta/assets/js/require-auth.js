// assets/js/require-auth.js
(async () => {
  const AUTH0_DOMAIN   = "dev-2f0fmbtj6u8o7en4.us.auth0.com";
  const AUTH0_CLIENT   = "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU";
  const REDIRECT_URI   = window.location.origin + location.pathname; // نرجع لنفس الصفحة بعد الدخول

  // ===== سياسة الوصول =====
  const PUBLIC_FILES       = new Set(["", "index.html", "privacy.html", "terms.html", "programs.html","pricing.html"]);
  const LOGIN_ONLY_FILES   = new Set(["profile.html"]); // يحتاج تسجيل فقط
  const TOOL_FILES         = new Set(["athar.html","darsi.html","masar.html","miyad.html","ethraa.html","mulham.html"]);
  const ADMIN_FILE         = "admin.html";

  // ===== أسماء الـ claims (نفس النيمسبيس) =====
  const NS          = "https://athar.co/";
  const CLAIM_STATUS= NS + "status";   // 'active' | 'pending' | ...
  const CLAIM_ROLES = NS + "roles";    // array
  const CLAIM_ADMIN = NS + "admin";    // boolean

  // ===== Helpers =====
  function currentFile() {
    const file = location.pathname.replace(/\/+$/, "").split("/").pop();
    return file || "";
  }
  function redirectTo(url) { location.replace(url); }

  async function ensureAuth0SDK() {
    if (window.auth0?.createAuth0Client) return;
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdn.auth0.com/js/auth0-spa-js/2.1/auth0-spa-js.production.js";
      s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }

  async function buildClient() {
    await ensureAuth0SDK();
    return await window.auth0.createAuth0Client({
      domain: AUTH0_DOMAIN,
      clientId: AUTH0_CLIENT,
      cacheLocation: "localstorage",
      authorizationParams: {
        redirect_uri: REDIRECT_URI,
        scope: "openid profile email"
      }
    });
  }

  async function cleanupRedirectIfNeeded(client) {
    if (location.search.includes("code=") && location.search.includes("state=")) {
      try {
        await client.handleRedirectCallback();
        history.replaceState({}, document.title, location.pathname + location.hash);
      } catch {}
    }
  }

  function isAdmin(claims) {
    const roles = claims?.[CLAIM_ROLES] || [];
    return roles.includes("admin") || claims?.[CLAIM_ADMIN] === true;
  }

  function userStatus(claims) {
    return claims?.[CLAIM_STATUS] || ""; // نتوقع 'active' أو 'pending' إلخ
  }

  // ===== التنفيذ =====
  const file = currentFile();

  // 0) صفحات عامة للجميع — فقط نظّفي العودة من Auth0 لو في code/state
  if (PUBLIC_FILES.has(file)) {
    try { const tmp = await buildClient(); await cleanupRedirectIfNeeded(tmp); } catch {}
    return;
  }

  // 1) حضّري عميل Auth0
  const client = await buildClient();
  await cleanupRedirectIfNeeded(client);

  let isAuth = false, claims = null;
  try {
    isAuth = await client.isAuthenticated();
  } catch {}

  // وظيفة تسجيل الدخول المعاد توجيهه لنفس الصفحة
  const forceLogin = async () => {
    await client.loginWithRedirect({
      authorizationParams: {
        screen_hint: "login",
        redirect_uri: REDIRECT_URI
      }
    });
  };

  // 2) صفحات "تسجيل دخول فقط"
  if (LOGIN_ONLY_FILES.has(file)) {
    if (!isAuth) return forceLogin();
    // ما نتحقق من الحالة هنا — فقط تسجيل دخول كفاية
    return; // اسمح بالمرور
  }

  // 3) باقي الصفحات (الأدوات + الأدمن) — تتطلب تسجيل دخول
  if (!isAuth) return forceLogin();

  // جِب الـ claims
  try { claims = await client.getIdTokenClaims(); } catch {}

  // 3.a) الأدمن
  if (file === ADMIN_FILE) {
    if (!isAdmin(claims)) return redirectTo("/pricing.html");
    return; // أدمن مسموح
  }

  // 3.b) الأدوات — لازم حالة active
  if (TOOL_FILES.has(file)) {
    const st = userStatus(claims);
    if (st !== "active") {
      // رجّعه لـ programs + مرري رسالة مبسطة
      sessionStorage.setItem("athar:msg", "حسابك غير مُفعّل بعد. يرجى انتظار التفعيل أو الاشتراك.");
      return redirectTo("/programs.html");
    }
    return; // active — اسمح بالدخول
  }

  // 4) أي صفحة ثانية غير مصنّفة؟ خذيها كـ محمية وتتبع سياسة الأدوات.
  // (لو تبين عكس كذا، أضيفيها صراحة في واحدة من القوائم فوق)
  const st = userStatus(claims);
  if (st !== "active") {
    sessionStorage.setItem("athar:msg", "حسابك غير مُفعّل بعد. يرجى انتظار التفعيل أو الاشتراك.");
    return redirectTo("/programs.html");
  }
})();
