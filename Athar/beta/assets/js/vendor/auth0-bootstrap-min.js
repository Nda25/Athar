/*! auth0 bootstrap (min) */
!function(){ "use strict";
function g(o,k,f){for(const n of k)if(n in o)return o[n];return f}
function p(u){try{var s=new URL(u);return s.origin}catch(_){return u}}
var G=window.APP_CONFIG||window.CONFIG||window.ENV||{}, W=window;
var DOMAIN=g(W,["AUTH0_DOMAIN"],g(G,["AUTH0_DOMAIN","auth0Domain","AUTH0_DOMAIN_NAME"],""));
var CLIENT_ID=g(W,["AUTH0_CLIENT_ID"],g(G,["AUTH0_CLIENT_ID","auth0ClientId","clientId"],""));
var AUDIENCE=g(W,["AUTH0_AUDIENCE"],g(G,["AUTH0_AUDIENCE","auth0Audience","audience"],"default"));
var REDIRECT_URI=g(W,["AUTH0_REDIRECT_URI"],g(G,["AUTH0_REDIRECT_URI","redirectUri"],W.location.origin));
var SCOPE=g(W,["AUTH0_SCOPE"],g(G,["AUTH0_SCOPE","auth0Scope"],"openid profile email offline_access"));
var CACHE_LOCATION=g(W,["AUTH0_CACHE_LOCATION"],g(G,["AUTH0_CACHE_LOCATION","cacheLocation"],"localstorage"));
var USE_REFRESH=!!g(W,["AUTH0_USE_REFRESH_TOKENS"],g(G,["AUTH0_USE_REFRESH_TOKENS","useRefreshTokens"],!0));
var USE_DPOP=!!g(W,["AUTH0_USE_DPOP"],g(G,["AUTH0_USE_DPOP","useDpop"],!1));
var COOKIE_DOMAIN=g(W,["AUTH0_COOKIE_DOMAIN"],g(G,["AUTH0_COOKIE_DOMAIN","cookieDomain"],void 0));
var ISSUER=g(W,["AUTH0_ISSUER"],g(G,["AUTH0_ISSUER","issuer"],""));
var WORKER_URL=g(W,["AUTH0_WORKER_URL"],g(G,["AUTH0_WORKER_URL","workerUrl"],void 0));
var ORG=g(W,["AUTH0_ORGANIZATION"],g(G,["AUTH0_ORGANIZATION","organization"],void 0));

function ensure(v,name){if(!v||String(v).trim()==="")throw new Error("Missing Auth0 "+name)}
ensure(DOMAIN,"DOMAIN"); ensure(CLIENT_ID,"CLIENT_ID");

var auth0Opts={domain:DOMAIN, clientId:CLIENT_ID, useRefreshTokens:USE_REFRESH, cacheLocation:CACHE_LOCATION, useDpop:USE_DPOP};
auth0Opts.authorizationParams={audience:AUDIENCE, redirect_uri:REDIRECT_URI, scope:SCOPE};
if(COOKIE_DOMAIN) auth0Opts.cookieDomain=COOKIE_DOMAIN;
if(ISSUER) auth0Opts.issuer=ISSUER;
if(WORKER_URL) auth0Opts.workerUrl=WORKER_URL;
if(ORG) (auth0Opts.authorizationParams.organization=ORG);

var HCB=/[?&](code|state)=/.test(W.location.search);
var _clientPromise=(async function(){
  if(!W.auth0||!auth0.createAuth0Client) throw new Error("auth0-spa-js not loaded");
  var c=await auth0.createAuth0Client(auth0Opts);
  if(HCB){try{var r=await c.handleRedirectCallback(); W.history&&W.history.replaceState&&W.history.replaceState({},W.document.title,W.location.pathname+W.location.hash); W.__AUTH0_APP_STATE__=r&&r.appState||null;}catch(e){W.__AUTH0_REDIRECT_ERROR__=e;}}
  return c;
})();

function wrap(fn){return async function(){var c=await _clientPromise; return fn.apply(null,[c].concat([].slice.call(arguments)))}}
var api={
  client:()=>_clientPromise,
  login:wrap((c,opts)=>c.loginWithRedirect(opts||{})),
  loginPopup:wrap((c,opts,popup)=>c.loginWithPopup(opts||{},popup||{})),
  logout:wrap((c,opts)=>c.logout(Object.assign({returnTo:REDIRECT_URI,openUrl:!0},opts||{}))),
  isAuthenticated:wrap((c)=>c.isAuthenticated()),
  getUser:wrap((c)=>c.getUser()),
  getIdTokenClaims:wrap((c)=>c.getIdTokenClaims()),
  getToken:wrap((c,opts)=>c.getTokenSilently(Object.assign({detailedResponse:!1},opts||{}))),
  getTokenDetailed:wrap((c,opts)=>c.getTokenSilently(Object.assign({detailedResponse:!0},opts||{}))),
  handleRedirect:wrap((c,url)=>c.handleRedirectCallback(url))
};
W.auth=W.auth||api; W.auth0ClientPromise=_clientPromise;
W.dispatchEvent(new CustomEvent("auth0:ready",{detail:{config:auth0Opts}}));
}();
