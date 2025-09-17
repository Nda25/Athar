<!-- اتركي هذا الملف كـ assets/js/auth0.js -->
<script>
// assets/js/auth0.js

(function () {
  "use strict";

  // ===== الإعدادات (عدّليها عند الحاجة) =====
  var DOMAIN       = "dev-2f0fmbtj6u8o7en4.us.auth0.com";
  var CLIENT_ID    = "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU";
  var AUDIENCE     = "default";
  var REDIRECT_URI = window.location.origin;         // رجوع للصفحة الرئيسية
  var SCOPE        = "openid profile email offline_access";
  var CACHE_LOC    = "localstorage";

  // ===== تحميل الـSDK مع فولباك محلي =====
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.defer = true;
      s.src = src;
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
      // فولباك محلي
      await loadScript("/assets/vendor/auth0-spa-js.production.js");
    }
  }

  // ===== بناء خيارات العميل =====
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

  // ===== تهيئة العميل وإتاحة API عامة =====
  var HCB = /[?&](code|state)=/.test(location.search);

  var clientPromise = (async function init() {
    // 1) تأكد من الـSDK
    await ensureSdk();
    if (typeof window.createAuth0Client !== "function") {
      throw new Error("[Auth0] SDK not available");
    }

    // 2) إنشاء العميل
    var opts = buildOptions();
    var client = await window.createAuth0Client(opts);

    // 3) تنظيف redirect إن وُجد
    if (HCB) {
      try {
        var { appState } = await client.handleRedirectCallback();
        history.replaceState({}, document.title, location.pathname + location.hash);
        if (appState && appState.returnTo) {
          // اختياري
          try { location.replace(appState.returnTo); } catch(_) {}
        }
      } catch (e) {
        console.warn("[Auth0] handleRedirectCallback:", e);
      }
    }

    // 4) كشف API بسيطة على window
    function wrap(fn) {
      return async function () {
        return fn.apply(null, [client].concat([].slice.call(arguments)));
      };
    }

    var api = {
      client:   () => clientPromise,
      login:    wrap((c, opts) => c.loginWithRedirect(opts || {})),
      loginPopup: wrap((c, opts, popup) => c.loginWithPopup(opts || {}, popup || {})),
      logout:   wrap((c, opts) => c.logout(Object.assign({ logoutParams: { returnTo: REDIRECT_URI } }, opts || {}))),
      isAuthenticated: wrap((c) => c.isAuthenticated()),
      getUser:  wrap((c) => c.getUser()),
      getIdTokenClaims: wrap((c) => c.getIdTokenClaims()),
      getToken: wrap((c, opts) => c.getTokenSilently(Object.assign({ detailedResponse: false }, opts || {}))),
      getTokenDetailed: wrap((c, opts) => c.getTokenSilently(Object.assign({ detailedResponse: true }, opts || {}))),
      handleRedirect: wrap((c, url) => c.handleRedirectCallback(url))
    };

    // 5) نشر الـAPI وإطلاق حدث الجاهزية
    window.auth = window.auth || api;
    window.auth0ClientPromise = clientPromise;
    window.dispatchEvent(new CustomEvent("auth0:ready", { detail: { client: client, config: opts } }));

    return client;
  })();

  // اختيارياً: طباعة جاهزية في الكونسول
  clientPromise.then(
    () => console.log("[Auth0] ready"),
    (e)  => console.error("[Auth0] init error:", e)
  );

})();
</script>
