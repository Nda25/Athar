// assets/js/auth0.js — pure JS (no <script> tag)

(function () {
  "use strict";

  // ===== الإعدادات =====
  var DOMAIN       = "dev-2f0fmbtj6u8o7en4.us.auth0.com";
  var CLIENT_ID    = "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU";
  var AUDIENCE     = "default";
  var REDIRECT_URI = window.location.origin; // العودة للرئيسية
  var SCOPE        = "openid profile email offline_access";
  var CACHE_LOC    = "localstorage";

  // ===== تحميل SDK عند الحاجة (مع فولباك محلي) =====
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.defer = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  async function ensureSdk() {
    if (typeof window.createAuth0Client === "function") return;
    try {
      await loadScript("https://cdn.auth0.com/js/auth0-spa-js/2/auth0-spa-js.production.js");
    } catch (_) {
      await loadScript("/assets/vendor/auth0-spa-js.production.js");
    }
  }

  // ===== خيارات العميل =====
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

  // ===== إنشاء العميل والتصدير =====
  const HCB = /[?&](code|state)=/.test(window.location.search);

  const clientPromise = (async () => {
    await ensureSdk();
    const client = await window.createAuth0Client(buildOptions());

    // تنظيف redirect إن وُجد
    if (HCB) {
      try {
        const r = await client.handleRedirectCallback();
        history.replaceState({}, document.title, location.pathname + location.hash);
        window.__AUTH0_APP_STATE__ = (r && r.appState) || null;
      } catch (e) {
        console.warn("[Auth0] redirect cleanup error:", e);
      }
    }

    return client;
  })();

  function wrap(fn) {
    return async function () {
      const c = await clientPromise;
      return fn.apply(null, [c].concat([].slice.call(arguments)));
    };
  }

  // API عام بسيط
  const api = {
    client: () => clientPromise,
    login:  wrap((c, opts) => c.loginWithRedirect(opts || {})),
    logout: wrap((c, opts) => c.logout(Object.assign({ logoutParams: { returnTo: REDIRECT_URI } }, opts || {}))),
    isAuthenticated: wrap((c) => c.isAuthenticated()),
    getUser: wrap((c) => c.getUser()),
    getToken: wrap((c, opts) => c.getTokenSilently(opts || {})),
  };

  // تعريضه على window + حدث جاهزية
  window.auth = window.auth || api;
  window.auth0ClientPromise = clientPromise;
  window.dispatchEvent(new CustomEvent("auth0:ready"));
})();
