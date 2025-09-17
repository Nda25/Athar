// Debug: اطبع القيم للتأكد إنها واصلة صح
console.log("Auth0 settings check:", {
  domain: DOMAIN,
  clientId: CLIENT_ID,
  redirect: REDIRECT_URI
});

(function () {
  "use strict";

  // ===== الإعدادات =====
  var DOMAIN       = "dev-2f0fmbtj6u8o7en4.us.auth0.com";
  var CLIENT_ID    = "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU";
  var AUDIENCE     = "default";
  var REDIRECT_URI = window.location.origin;
  var SCOPE        = "openid profile email offline_access";
  var CACHE_LOC    = "localstorage";
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

  // حمّل SDK: CDN ثم فولباك محلي (عدّل المسار إذا لزم)
  async function ensureSdk() {
    if (typeof window.createAuth0Client === "function") return;
    try {
      await loadScript("https://cdn.auth0.com/js/auth0-spa-js/2/auth0-spa-js.production.js");
    } catch (_) {
      await loadScript("/assets/vendor/auth0-spa-js.production.js"); // ← عدّليها لو مسارك مختلف
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
      console.error("[Auth0] SDK not loaded");
      // نرجّع عميل وهمي يمنع كراش ويعطي رسالة مفهومة
      throw new Error("sdk_not_loaded");
    }

    const client = await window.createAuth0Client(buildOptions());

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

  // التفاف دوال — كل دالة تنتظر الجاهزية
  function wrap(fn) {
    return async function () {
      const c = await clientPromise;
      return fn.apply(null, [c].concat([].slice.call(arguments)));
    };
  }

  const api = {
    client: () => clientPromise,
    login:  wrap((c, opts) => c.loginWithRedirect(opts || {})),
    loginPopup: wrap((c, opts, popup) => c.loginWithPopup(opts || {}, popup || {})),
    logout: wrap((c, opts) => c.logout({ logoutParams: { returnTo: REDIRECT_URI }, ...(opts||{}) })),
    isAuthenticated: wrap((c) => c.isAuthenticated()),
    getUser: wrap((c) => c.getUser()),
    getToken: wrap((c, opts) => c.getTokenSilently(opts || {})),
  };

  window.auth = window.auth || api;
  window.auth0ClientPromise = clientPromise;
  window.dispatchEvent(new CustomEvent("auth0:ready"));

  clientPromise.then(
    () => console.log("[Auth0] ready"),
    (e)  => console.error("[Auth0] init error:", e && e.message ? e.message : e)
  );
})();
