<!-- /assets/js/require-auth.js -->
<script>
/* =============================================
   Athar - Front-end Guard (Auth0 v2, API Audience)
   - منع الدوران بعد الرجوع من Auth0
   - توحيد جلب التوكن للـ API (Access Token أو Id Token)
   - حارس اشتراك مباشر + دعم trial من الـ ID Token
   ============================================= */
(function AtharGuard(){
  // ---- إعدادات ----
  const AUTH0_DOMAIN  = "dev-2f0fmbtj6u8o7en4.us.auth0.com";
  const AUTH0_CLIENT  = "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU";
  const API_AUDIENCE  = "https://api.n-athar";

  const CALLBACK = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:8888/profile.html'
    : 'https://n-athar.co/profile.html';

  const RETURN_TO = CALLBACK.startsWith('http://localhost:8888')
    ? 'http://localhost:8888'
    : 'https://n-athar.co';

  const DEBUG = false;
  const log  = (...a)=>{ if (DEBUG) console.info("[AtharGuard]", ...a); };
  const warn = (...a)=>{ if (DEBUG) console.warn("[AtharGuard]", ...a); };
  const err  = (...a)=>{ console.error("[AtharGuard]", ...a); };

  // نشر الإعدادات لاستخدامها من أي سكربت آخر
  window.__CFG = Object.assign({}, window.__CFG || {}, {
    auth0_domain: AUTH0_DOMAIN,
    auth0_clientId: AUTH0_CLIENT,
    api_audience: API_AUDIENCE
  });

  // شاشة انتظار
  function mountGuardOverlay(){
    if (document.getElementById("athar-guard")) return;
    const s = document.createElement("style");
    s.id = "athar-guard-style";
    s.textContent = `
      #athar-guard{position:fixed;inset:0;background:#0b1324;display:flex;align-items:center;justify-content:center;z-index:2147483647}
      #athar-guard .box{color:#fff;font:500 14px/1.6 system-ui,-apple-system,Segoe UI,Roboto;opacity:.9;text-align:center}
      #athar-guard .spin{width:28px;height:28px;border:3px solid #ffffff33;border-top-color:#fff;border-radius:50%;margin:0 auto 10px;animation:ag-spin .9s linear infinite}
      @keyframes ag-spin{to{transform:rotate(360deg)}}
    `;
    document.head.appendChild(s);
    const d = document.createElement("div");
    d.id = "athar-guard";
    d.innerHTML = `<div class="box"><div class="spin"></div><div>جاري التحقق من الصلاحيات…</div></div>`;
    document.documentElement.appendChild(d);
  }
  function unmountGuardOverlay(){
    document.getElementById("athar-guard")?.remove();
    document.getElementById("athar-guard-style")?.remove();
  }

  // عدم الكاش
  (function addMetaNoStore(){
    const metas = [
      ['Cache-Control','no-store, no-cache, must-revalidate, max-age=0'],
      ['Pragma','no-cache'],
      ['Expires','0']
    ];
    metas.forEach(([httpEquiv,content])=>{
      const m = document.createElement('meta');
      m.httpEquiv = httpEquiv; m.content = content;
      document.head.appendChild(m);
    });
  })();

  // أدوات مساعدة
  function fileSlug(){
    let p = location.pathname.replace(/\/+$/,'');
    if (p === "" || p === "/") return "index";
    const last = p.split("/").pop();
    return last.replace(/\.html?$/i, "").toLowerCase();
  }
  const PUBLIC      = new Set(["index","pricing","programs","privacy","terms","refund-policy","whatsapp"]);
  const LOGIN_ONLY  = new Set(["profile"]);
  const TOOLS       = new Set(["athar","darsi","masar","miyad","ethraa","mulham","mueen","murtakaz","beta","athar-beta"]);
  const ADMIN       = "admin";

  const toPricing = (msg) => {
    try { if (msg) sessionStorage.setItem("athar:msg", msg); } catch {}
    location.replace(location.origin + "/pricing.html");
  };

  // تحميل SDK مع بدائل
  async function ensureAuth0SDK(){
    if (window.auth0?.createAuth0Client || window.createAuth0Client) return;
    const sources = [
      "https://cdn.auth0.com/js/auth0-spa-js/2.2/auth0-spa-js.production.js",
      "https://cdn.jsdelivr.net/npm/@auth0/auth0-spa-js@2.2.0/dist/auth0-spa-js.production.js",
      "https://unpkg.com/@auth0/auth0-spa-js@2.2.0/dist/auth0-spa-js.production.js",
      "/assets/vendor/auth0-spa-js.production.js"
    ];
    for (const src of sources){
      const ok = await new Promise((res)=>{
        const sc = document.createElement("script");
        sc.src = src; sc.async = true; sc.defer = true;
        sc.onload = ()=>res(true); sc.onerror = ()=>res(false);
        document.head.appendChild(sc);
      });
      if (ok && (window.auth0?.createAuth0Client || window.createAuth0Client)) { log("Auth0 SDK from:", src); return; }
      warn("Auth0 SDK load failed from:", src);
    }
    err("Auth0 SDK load failed");
  }

  // بناء العميل
  async function buildClient(){
    await ensureAuth0SDK();
    const f = window.auth0?.createAuth0Client || window.createAuth0Client;
    if (!f) throw new Error("Auth0 SPA SDK not available");

    const options = {
      domain: AUTH0_DOMAIN,
      clientId: AUTH0_CLIENT,
      cacheLocation: "localstorage",
      useRefreshTokens: true,
      authorizationParams: {
        redirect_uri: CALLBACK,
        scope: "openid profile email offline_access",
        audience: API_AUDIENCE
      }
    };

    const c = await f(options);
    window.auth0Client = c;
    window.auth = c;
    try { window.dispatchEvent(new Event("auth0:ready")); } catch(_){}
    return c;
  }

  // تنظيف ما بعد الرجوع من Auth0 (مرة واحدة فقط)
  let handledRedirect = false;
  async function cleanupRedirectIfNeeded(client){
    if (handledRedirect) return false;
    if (location.search.includes("code=") && location.search.includes("state=")) {
      handledRedirect = true;
      let result = null;
      try { result = await client.handleRedirectCallback(); }
      catch (e) { warn("handleRedirectCallback failed", e); }

      // إزالة code/state
      const url = new URL(location.href);
      url.searchParams.delete('code');
      url.searchParams.delete('state');
      history.replaceState({}, document.title, url.pathname + (url.search || "") + url.hash);

      // هدف الرجوع
      const desired =
        (result && result.appState && result.appState.returnTo) ||
        (function(){ try { return localStorage.getItem('afterLogin') || null; } catch(_){ return null; } })();

      // إن كانت الوجهة الملف الشخصي نفسه… ابقِ
      const here = location.pathname + (location.search||"") + (location.hash||"");
      if (desired && desired !== here && desired !== '/profile.html') {
        try { localStorage.removeItem('afterLogin'); } catch(_){}
        location.replace(desired);
        return true;
      }
    }
    return false;
  }

  // جلب حالة الاشتراك من الـ backend (باستخدام Access Token الصحيح)
  async function fetchUserStatus(client){
    try {
      const token = await client.getAccessTokenSilently({
        detailedResponse: false,
        authorizationParams: { audience: API_AUDIENCE }
      });
      if (!token) return { active:false, status:"none", expires_at:null };

      const res = await fetch("/.netlify/functions/user-status?ts=" + Date.now(), {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      if (!res.ok) return { active:false, status:"none", expires_at:null };
      const data = await res.json();
      return { active: !!data.active, status: data.status || "none", expires_at: data.expires_at || null };
    } catch (e) {
      warn("fetchUserStatus failed", e);
      return { active:false, status:"none", expires_at:null };
    }
  }

  // مخرجات التوكن لاستخدام الواجهة
  // تحاول Access Token أولاً، ثم تعيد الـ Id Token كحل بديل.
  window.getBearerForApi = async function(){
    const c = window.auth0Client || window.auth;
    if (!c) throw new Error("Auth0 client not ready");
    try {
      const at = await c.getAccessTokenSilently({
        detailedResponse: false,
        authorizationParams: { audience: API_AUDIENCE }
      });
      if (at) return at;
    } catch (_){}
    try {
      const claims = await c.getIdTokenClaims();
      if (claims && claims.__raw) return claims.__raw;
    } catch (_){}
    throw new Error("Missing token");
  };

  // الحارس
  let client = null;
  let slug   = fileSlug();

  async function enforce(){
    try {
      let status = await fetchUserStatus(client).catch(() => ({ active:false, status:"inactive" }));

      // دمج trial من الـ ID Token
      try {
        const claims = await client.getIdTokenClaims();
        const NS  = "https://n-athar.co/";
        const ALT = "https://athar.co/";
        const tokenStatus = claims?.[NS + "status"] ?? claims?.[ALT + "status"];
        if (!status.active && tokenStatus === "trial") {
          status = { ...status, active: true, status: "trial" };
        }
      } catch (e) { /* تجاهل */ }

      // الأدمن: نشط فقط
      if (slug === ADMIN) {
        if (!status.active || status.status !== "active") return toPricing("هذه الصفحة للمشتركين النشطين فقط.");
        unmountGuardOverlay(); return;
      }

      // أدوات البرامج
      if (TOOLS.has(slug)) {
        if (!status.active) return toPricing("حسابك غير مُفعّل (انتهت التجربة أو لم يتم التفعيل).");
        unmountGuardOverlay(); return;
      }

      // باقي الصفحات المحمية
      if (!status.active) {
        const msg = (status.status === "expired" || status.status === "inactive")
          ? "حسابك غير مُفعّل. فضلاً اشتركي أو جدّدي الاشتراك."
          : "هذه الصفحة للمشتركين فقط.";
        return toPricing(msg);
      }

      unmountGuardOverlay();
    } catch (e) {
      warn("enforce() failed", e);
      return toPricing("حدث خلل أثناء التحقق. أعيدي المحاولة بعد لحظات.");
    }
  }

  // بدء التشغيل
  async function start(){
    mountGuardOverlay();
    slug = fileSlug();

    // منع دوران loginWithRedirect
    const REDIRECT_FLAG = "athar:redirecting";
    if (sessionStorage.getItem(REDIRECT_FLAG) === "1") {
      // نعطي فرصة لـ handleRedirectCallback
      setTimeout(()=>unmountGuardOverlay(), 1500);
    }

    client = await buildClient();

    // تنظيف ما بعد الرجوع
    const redirected = await cleanupRedirectIfNeeded(client);
    if (redirected) return;

    const isAuth = await client.isAuthenticated();

    // صفحات عامة
    if (PUBLIC.has(slug)) { unmountGuardOverlay(); return; }

    // صفحة الملف الشخصي فقط
    if (LOGIN_ONLY.has(slug)) {
      if (!isAuth) {
        try { localStorage.setItem('afterLogin', location.pathname + location.search + location.hash); } catch(_){}
        sessionStorage.setItem(REDIRECT_FLAG, "1");
        await client.loginWithRedirect({
          authorizationParams: {
            prompt: "login",
            redirect_uri: CALLBACK,
            audience: API_AUDIENCE
          },
          appState: { returnTo: location.pathname + location.search + location.hash }
        });
        return;
      }
      sessionStorage.removeItem(REDIRECT_FLAG);
      unmountGuardOverlay(); return;
    }

    // باقي الصفحات المحمية (أدوات/أدمن/…)
    if (!isAuth) {
      try { localStorage.setItem('afterLogin', location.pathname + location.search + location.hash); } catch(_){}
      sessionStorage.setItem(REDIRECT_FLAG, "1");
      await client.loginWithRedirect({
        authorizationParams: {
          prompt: "login",
          redirect_uri: CALLBACK,
          audience: API_AUDIENCE
        },
        appState: { returnTo: location.pathname + location.search + location.hash }
      });
      return;
    }

    sessionStorage.removeItem(REDIRECT_FLAG);
    await enforce();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  // رجوع من الذاكرة
  window.addEventListener("pageshow", function(e){
    if (e.persisted) { try { enforce(); } catch(_){ } }
  });

  // إعادة توجيه بعد الملف الشخصي (مرة واحدة)
  window.addEventListener('auth0:ready', async () => {
    if ((location.pathname || '').endsWith('/profile.html')) {
      const go = (function(){ try { return localStorage.getItem('afterLogin'); } catch(_){ return null; } })();
      if (go && go !== '/profile.html') {
        try { localStorage.removeItem('afterLogin'); } catch(_){}
        location.replace(go);
      }
    }
  });

  // خروج
  window.atharLogout = function(){
    try { window.auth?.logout?.({ logoutParams: { returnTo: RETURN_TO }}); }
    catch(e){ warn("logout failed", e); }
  };
})();
</script>
