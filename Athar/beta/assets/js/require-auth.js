// assets/js/require-auth.js
(async () => {
  // ===== إعدادات الهوية =====
  const AUTH0_DOMAIN = "dev-2f0fmbtj6u8o7en4.us.auth0.com";
  const AUTH0_CLIENT = "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU";
  const API_AUDIENCE = "https://api.athar";           // نفس القيمة المستعملة على الخادم
  const REDIRECT_URI = window.location.origin + location.pathname; // نرجع لنفس الصفحة بعد الدخول

  // متغيّرات عامة تستهلكها صفحات مثل pricing/الشكاوى عند طلب توكن وصول
  window.__CFG = Object.assign({}, window.__CFG || {}, {
    auth0_domain: AUTH0_DOMAIN,
    auth0_clientId: AUTH0_CLIENT,
    api_audience: API_AUDIENCE
  });

  // ===== سياسة الوصول =====
  const PUBLIC_FILES     = new Set(["", "index.html", "privacy.html", "terms.html", "programs.html", "pricing.html", "refund-policy.html", "whatsapp.html"]);
  const LOGIN_ONLY_FILES = new Set(["profile.html"]);
  const TOOL_FILES       = new Set(["athar.html","darsi.html","masar.html","miyad.html","ethraa.html","mulham.html"]);
  const ADMIN_FILE       = "admin.html";

  // ===== أسماء الـ claims =====
  const NS           = "https://athar.co/";
  const CLAIM_STATUS = NS + "status";
  const CLAIM_ROLES  = NS + "roles";
  const CLAIM_ADMIN  = NS + "admin";

  function currentFile(){ const f = location.pathname.replace(/\/+$/,"").split("/").pop(); return f || ""; }
  function redirectTo(u){ location.replace(u); }

  async function ensureAuth0SDK(){
    if (window.auth0?.createAuth0Client) return;
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdn.auth0.com/js/auth0-spa-js/2.1/auth0-spa-js.production.js";
      s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }

  async function buildClient(){
    await ensureAuth0SDK();
    const c = await window.auth0.createAuth0Client({
      domain: AUTH0_DOMAIN,
      clientId: AUTH0_CLIENT,
      cacheLocation: "localstorage",
      authorizationParams: { redirect_uri: REDIRECT_URI, scope: "openid profile email" }
    });
    window.auth0Client = c;
    window.auth = c; // توافق
    window.dispatchEvent(new CustomEvent("auth0:ready", { detail:{ client:c }}));
    return c;
  }

  async function cleanupRedirectIfNeeded(client){
    if (location.search.includes("code=") && location.search.includes("state=")) {
      try { await client.handleRedirectCallback(); history.replaceState({}, document.title, location.pathname + location.hash); }
      catch {}
    }
  }

  const isAdmin = (claims)=> (claims?.[CLAIM_ROLES]||[]).includes("admin") || claims?.[CLAIM_ADMIN] === true;
  const userStatus = (claims)=> claims?.[CLAIM_STATUS] || "";

  const file = currentFile();

  // صفحات عامة
  if (PUBLIC_FILES.has(file)) { try { const tmp = await buildClient(); await cleanupRedirectIfNeeded(tmp); } catch {} return; }

  const client = await buildClient();
  await cleanupRedirectIfNeeded(client);

  let isAuth=false, claims=null;
  try { isAuth = await client.isAuthenticated(); } catch {}

  const forceLogin = async () => client.loginWithRedirect({ authorizationParams:{ screen_hint:"login", redirect_uri: REDIRECT_URI } });

  if (LOGIN_ONLY_FILES.has(file)) { if (!isAuth) return forceLogin(); return; }

  if (!isAuth) return forceLogin();

  try { claims = await client.getIdTokenClaims(); } catch {}

  if (file === ADMIN_FILE) { if (!isAdmin(claims)) return redirectTo("/pricing.html"); return; }

  if (TOOL_FILES.has(file)) {
    const st = userStatus(claims);
    if (st !== "active") {
      sessionStorage.setItem("athar:msg","حسابك غير مُفعّل بعد. يرجى انتظار التفعيل أو الاشتراك.");
      return redirectTo("/programs.html");
    }
    return;
  }

  const st = userStatus(claims);
  if (st !== "active") {
    sessionStorage.setItem("athar:msg","حسابك غير مُفعّل بعد. يرجى انتظار التفعيل أو الاشتراك.");
    return redirectTo("/programs.html");
  }
})();
