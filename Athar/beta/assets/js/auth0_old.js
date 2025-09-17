// assets/js/auth0.js — bootstrap يدوي مع فولباك


(function () {
  "use strict";

  // 1) الإعدادات اليدوية
  var DOMAIN       = "dev-2f0fmbtj6u8o7en4.us.auth0.com";
  var CLIENT_ID    = "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU"; // ← تأكدي من صحته
  var AUDIENCE     = "default";
  var REDIRECT_URI = window.location.origin; // يرجع للرئيسية
  var SCOPE        = "openid profile email offline_access";
  var CACHE_LOC    = "localstorage";
console.log("Auth0 config check:", { DOMAIN, CLIENT_ID });
  
  // 2) تحميل SDK عند الحاجة (CDN ثم فولباك محلي)
  function loadScript(src){
    return new Promise(function(res, rej){
      var s = document.createElement("script");
      s.src = src; s.defer = true;
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  async function ensureSdk(){
    if (typeof window.createAuth0Client === "function") return;
    try {
      await loadScript("https://cdn.auth0.com/js/auth0-spa-js/2/auth0-spa-js.production.js");
    } catch(_) {
      await loadScript("/assets/vendor/auth0-spa-js.production.js");
    }
  }

  // 3) تهيئة العميل مرة واحدة
  var clientPromise = (async function init(){
    await ensureSdk();
    if (typeof window.createAuth0Client !== "function"){
      throw new Error("sdk_not_loaded");
    }
    var opts = {
      domain: DOMAIN,
      clientId: CLIENT_ID,
      cacheLocation: CACHE_LOC,
      authorizationParams: {
        audience: AUDIENCE,
        redirect_uri: REDIRECT_URI,
        scope: SCOPE
      }
    };

    var client = await window.createAuth0Client(opts);

    // تنظيف redirect إن وُجد
    if (/\b(code|state)=/.test(location.search)) {
      try {
        var r = await client.handleRedirectCallback();
        history.replaceState({}, document.title, location.pathname + location.hash);
        if (r && r.appState && r.appState.returnTo){
          try { location.replace(r.appState.returnTo); } catch(_){}
        }
      } catch(e){
        console.warn("[Auth0] redirect cleanup:", e);
      }
    }

    // API مبسّطة
    function wrap(fn){ return async function(){ return fn.apply(null, [client].concat([].slice.call(arguments))); }; }

    var api = {
      client: () => clientPromise,
      login: wrap((c,opts)=> c.loginWithRedirect(opts||{})),
      loginPopup: wrap((c,opts,p)=> c.loginWithPopup(opts||{}, p||{})),
      logout: wrap((c,opts)=> c.logout(Object.assign({ logoutParams:{ returnTo: REDIRECT_URI }}, opts||{}))),
      isAuthenticated: wrap(c=> c.isAuthenticated()),
      getUser: wrap(c=> c.getUser()),
      getToken: wrap((c,opts)=> c.getTokenSilently(opts||{})),
    };

    // تعريض + حدث جاهزية
    window.auth = window.auth || api;
    window.auth0ClientPromise = clientPromise;
    window.dispatchEvent(new CustomEvent("auth0:ready"));
    console.log("[Auth0] ready");
    return client;
  })();

  // debug خفيف
  clientPromise.catch(e=> console.error("[Auth0] init error:", e?.message || e));
})();
