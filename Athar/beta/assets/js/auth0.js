// assets/js/auth0.js — نسخة صافية
(function(){
  "use strict";

  const DOMAIN       = "dev-2f0fmbtj6u8o7en4.us.auth0.com";
  const CLIENT_ID    = "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU";
  const AUDIENCE     = "default";
  const REDIRECT_URI = window.location.origin;
  const SCOPE        = "openid profile email offline_access";
  const CACHE_LOC    = "localstorage";

  function buildOptions(){
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

  const clientPromise = (async () => {
    if (typeof window.createAuth0Client !== "function") {
      console.error("[Auth0] SDK not loaded");
      return null;
    }
    const client = await window.createAuth0Client(buildOptions());

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
    return async function(){
      const c = await clientPromise;
      if (!c) throw new Error("Auth0 client not ready");
      return fn.apply(null, [c].concat([].slice.call(arguments)));
    };
  }

  window.auth = {
    client: () => clientPromise,
    login:  wrap((c, opts) => c.loginWithRedirect(opts || {})),
    logout: wrap((c, opts) => c.logout({ logoutParams: { returnTo: REDIRECT_URI }, ...(opts||{}) })),
    isAuthenticated: wrap((c) => c.isAuthenticated()),
    getUser: wrap((c) => c.getUser())
  };

  window.auth0ClientPromise = clientPromise;
  window.dispatchEvent(new CustomEvent("auth0:ready"));
})();
