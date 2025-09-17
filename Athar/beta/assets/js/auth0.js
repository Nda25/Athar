// assets/js/auth0.js — يحمّل SDK بنفسه + فولباك محلي + يعرّض window.auth
(function () {
  "use strict";

  // ===== إعداداتك =====
  const DOMAIN       = "dev-2f0fmbtj6u8o7en4.us.auth0.com";
  const CLIENT_ID    = "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU";
  const AUDIENCE     = "default";
  const REDIRECT_URI = window.location.origin;
  const SCOPE        = "openid profile email offline_access";
  const CACHE_LOC    = "localstorage";

  // تحميل سكربت خارجي
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.defer = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // حمّل الـSDK: CDN ثم فولباك محلي
  async function ensureSdk() {
    if (typeof window.createAuth0Client === "function") return;
    try {
      await loadScript("https://cdn.auth0.com/js/auth0-spa-js/2/auth0-spa-js.production.js");
    } catch (_) {
      await loadScript("/assets/vendor/auth0-spa-js.production.js");
    }
  }

  // خيارات العميل
  function buildOptions() {
    return {
      domain: DOMAIN,
      clientId: CLIENT_ID,
      cacheLocation: CACHE_LOC,
      authorizationParams: {
        audience: AUDIENCE,
        redirect_uri: REDIRECT_URI,
        scope: SCOPE
      }
    };
  }

  const HCB = /[?&](code|state)=/.test(location.search);

  // ابدأ
  const clientPromise = (async () => {
    await ensureSdk();
    if (typeof window.createAuth0Client !== "function") {
      throw new Error("[Auth0] SDK still not available");
    }

    const client = await window.createAuth0Client(buildOptions());

    // تنظيف العودة من Auth0
    if (HCB) {
      try {
        const r = await client.handleRedirectCallback();
        history.replaceState({}, document.title, location.pathname + location.hash);
        window.__AUTH0_APP_STATE__ = r?.appState || null;
      } catch (e) {
        console.warn("[Auth0] redirect cleanup error:", e);
      }
    }

    return client;
  })();

  // التفاف دوال
  function wrap(fn) {
    return async function () {
      const c = await clientPromise;
      return fn.apply(null, [c].concat([].slice.call(arguments)));
    };
  }

  // API عام
  const api = {
    client: () => clientPromise,
    login:  wrap((c, opts) => c.loginWithRedirect(opts || {})),
    loginPopup: wrap((c, opts, popup) => c.loginWithPopup(opts || {}, popup || {})),
    logout: wrap((c, opts) => c.logout({ logoutParams: { returnTo: REDIRECT_URI }, ...(opts||{}) })),
    isAuthenticated: wrap((c) => c.isAuthenticated()),
    getUser: wrap((c) => c.getUser()),
    getToken: wrap((c, opts) => c.getTokenSilently(opts || {})),
  };

  // تعريض + حدث جاهزية
  window.auth = window.auth || api;
  window.auth0ClientPromise = clientPromise;
  window.dispatchEvent(new CustomEvent("auth0:ready"));

  // لوج مفيد
  clientPromise.then(
    () => console.log("[Auth0] ready"),
    (e)  => console.error("[Auth0] init error:", e)
  );
})();
