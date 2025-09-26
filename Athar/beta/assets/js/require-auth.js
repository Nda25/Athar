// /assets/js/require-auth.js
// =============================================
// Athar - Front-end Guard (with live user-status check)
// (CALLBACK ثابت + منع الكاش + حفظ مسار الرجوع + لودر SDK متعدد + دعم appState.returnTo)
// =============================================
(function AtharGuard(){
  // ---- إعدادات أساسية ----
  const AUTH0_DOMAIN = "dev-2f0fmbtj6u8o7en4.us.auth0.com";
  const AUTH0_CLIENT = "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU";
  const API_AUDIENCE = "https://api.n-athar";

  // ✅ Callback ثابت (أضيفيه في Auth0 Allowed Callback URLs)
  const CALLBACK = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:8888/profile.html'
    : 'https://n-athar.co/profile.html';

  // وجهة الخروج
  const RETURN_TO = CALLBACK.startsWith('http://localhost:8888')
    ? 'http://localhost:8888'
    : 'https://n-athar.co';

  const DEBUG = false;
  const log  = (...a)=>{ if (DEBUG) console.info("[AtharGuard]", ...a); };
  const warn = (...a)=>{ if (DEBUG) console.warn("[AtharGuard]", ...a); };
  const err  = (...a)=>{ console.error("[AtharGuard]", ...a); };

  // نشر الإعدادات
  window.__CFG = Object.assign({}, window.__CFG || {}, {
    auth0_domain: AUTH0_DOMAIN,
    auth0_clientId: AUTH0_CLIENT,
    api_audience: API_AUDIENCE
  });

  let __AUTH_READY_FIRED__ = false;
  function fireAuthReady(){
    if (__AUTH_READY_FIRED__) return;
    __AUTH_READY_FIRED__ = true;
    try { window.dispatchEvent(new Event("auth0:ready")); } catch(_) {}
  }

  function fileSlug(){
    let p = location.pathname.replace(/\/+$/,'');
    if (p === "" || p === "/") return "index";
    const last = p.split("/").pop();
    return last.replace(/\.html?$/i, "").toLowerCase();
  }

  // خرائط الصفحات
  const PUBLIC = new Set(["index","pricing","programs","privacy","terms","refund-policy","whatsapp"]);
  const LOGIN_ONLY = new Set(["profile"]);
  const TOOLS = new Set(["athar","darsi","masar","miyad","ethraa","mulham","mueen"]);
  const ADMIN = "admin";

  const toPricing = (msg) => {
    try { if (msg) sessionStorage.setItem("athar:msg", msg); } catch {}
    location.replace(location.origin + "/pricing.html");
  };

  const addMetaNoStore = () => {
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
  };

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

  // ===== لودر SDK قوي مع بدائل =====
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
    fireAuthReady();
    return c;
  }

  // ←— بعد العودة من Auth0: نظّف URL وأعد التوجيه لـ appState.returnTo إن وُجد
  async function cleanupRedirectIfNeeded(client){
    if (location.search.includes("code=") && location.search.includes("state=")) {
      let result;
      try { result = await client.handleRedirectCallback(); }
      catch (e) { /* نتجاهل */ }

      // شِل code/state من الرابط مع الحفاظ على الباقي
      const url = new URL(location.href);
      url.searchParams.delete('code');
      url.searchParams.delete('state');
      history.replaceState({}, document.title, url.pathname + (url.search || "") + url.hash);

      // الهدف المفضّل: appState.returnTo، وإلا نسخة احتياطية من localStorage
      const desired =
        (result && result.appState && result.appState.returnTo) ||
        (function(){ try { return localStorage.getItem('afterLogin') || null; } catch(_){ return null; } })();

      if (desired && desired !== location.pathname + location.search + location.hash) {
        try { localStorage.removeItem('afterLogin'); } catch(_){}
        location.replace(desired);
        return true; // تم تحويل الصفحة
      }
    }
    return false;
  }

  // === جلب حالة الاشتراك من السيرفر ===
  async function fetchUserStatus(client){
    try {
      const token = await (client.getTokenSilently?.() || client.getTokenWithPopup?.());
      if (!token) return { active:false, status:"none", expires_at:null };

      const res = await fetch("/.netlify/functions/user-status?ts=" + Date.now(), {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });

      if (!res.ok) return { active:false, status:"none", expires_at:null };
      const data = await res.json();
      return { active: !!data.active, status: data.status || "none", expires_at: data.expires_at || null };
    } catch { return { active:false, status:"none", expires_at:null }; }
  }

  // ======== المنفّذ الرئيسي ========
  async function enforce(){
    addMetaNoStore();
    mountGuardOverlay();
    const slug = fileSlug();
    log("slug:", slug);

    // الصفحات العامة
    if (PUBLIC.has(slug)) {
      try {
        const tmp = await buildClient();
        const redirected = await cleanupRedirectIfNeeded(tmp);
        if (!redirected) { unmountGuardOverlay(); fireAuthReady(); }
      } catch { unmountGuardOverlay(); fireAuthReady(); }
      return;
    }

    // تهيئة العميل
    let client;
    try {
      client = await buildClient();
      const redirected = await cleanupRedirectIfNeeded(client);
      if (redirected) return; // رجّعناه بالفعل
    } catch (e) { err("Auth0 init failed:", e?.message || e); unmountGuardOverlay(); return; }

    // صفحات login-only (profile)
    if (LOGIN_ONLY.has(slug)) {
      let authed = false;
      try { authed = await client.isAuthenticated(); } catch {}

      if (!authed) {
        const returnTo = location.pathname + location.search + location.hash;
        try { localStorage.setItem('afterLogin', returnTo); } catch(_){}
        try {
          await client.loginWithRedirect({
            authorizationParams: { screen_hint: "login", redirect_uri: CALLBACK },
            appState: { returnTo }
          });
          return;
        } catch { return toPricing("الرجاء تسجيل الدخول للوصول إلى هذه الصفحة."); }
      }

      unmountGuardOverlay();
      fireAuthReady();
      return;
    }

    // باقي الصفحات المحمية
    let authed = false;
    try { authed = await client.isAuthenticated(); } catch {}
    if (!authed) {
      const returnTo = location.pathname + location.search + location.hash;
      try { localStorage.setItem('afterLogin', returnTo); } catch(_){}
      try {
        await client.loginWithRedirect({
          authorizationParams: { screen_hint:"login", redirect_uri: CALLBACK },
          appState: { returnTo }
        });
        return;
      } catch {
        return toPricing("الرجاء تسجيل الدخول للوصول إلى هذه الصفحة.");
      }
    }

    // تحقق حالة الاشتراك
    const status = await fetchUserStatus(client);
    log("live status:", status);

    if (slug === ADMIN) {
      if (!status.active) return toPricing("هذه الصفحة للمشتركين النشطين فقط.");
      unmountGuardOverlay(); fireAuthReady(); return;
    }

    if (TOOLS.has(slug)) {
      if (!status.active) return toPricing("حسابك غير مُفعّل (انتهت التجربة أو لم يتم التفعيل).");
      unmountGuardOverlay(); fireAuthReady(); return;
    }

    if (!status.active) return toPricing("هذه الصفحة للمشتركين النشطين فقط.");

    unmountGuardOverlay();
    fireAuthReady();
  }

  // نقطة الدخول
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enforce);
  } else {
    enforce();
  }

  // الرجوع من الذاكرة (bfcache)
  window.addEventListener("pageshow", function(e){
    if (e.persisted) enforce();
  });

  // دعم إعادة التوجيه من داخل profile.html أيضًا لو لزم
  window.addEventListener('auth0:ready', async () => {
    if ((location.pathname || '').endsWith('/profile.html')) {
      const go = (function(){ try { return localStorage.getItem('afterLogin'); } catch(_){ return null; } })();
      if (go && go !== '/profile.html') {
        try { localStorage.removeItem('afterLogin'); } catch(_){}
        location.replace(go);
      }
    }
  });

  // دالة خروج عامة
  window.atharLogout = function(){
    try { window.auth?.logout?.({ logoutParams: { returnTo: RETURN_TO }}); }
    catch(e){ warn("logout failed", e); }
  };

})();
