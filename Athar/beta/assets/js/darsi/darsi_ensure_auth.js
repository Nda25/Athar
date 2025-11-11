// ملاحظة: يُفترض أن require-auth.js يُنشئ window.auth0Client بعد تسجيل الدخول.
// هذه الدوال تضمن وجود العميل وتستخرج توكنًا صالحًا لإرساله مع الطلبات المحمية.
async function ensureAuth0Client() {
  if (window.auth0Client) return window.auth0Client;
  if (!window.createAuth0Client) throw new Error("Auth0 SDK not loaded");
  window.auth0Client = await window.createAuth0Client({
    domain: window.AUTH0_DOMAIN || "<YOUR_DOMAIN>.auth0.com",
    clientId: window.AUTH0_CLIENTID || "<YOUR_CLIENT_ID>",
    audience: window.AUTH0_AUDIENCE || undefined,
    cacheLocation: "localstorage",
    useRefreshTokens: true,
  });
  return window.auth0Client;
}
async function getAuthToken() {
  const client = await ensureAuth0Client();
  // حاول Access Token أولاً
  try {
    const at = await client.getAccessTokenSilently({
      detailedResponse: false,
      authorizationParams: window.AUTH0_AUDIENCE
        ? { audience: window.AUTH0_AUDIENCE }
        : {},
    });
    if (at) return at;
  } catch (_) {}
  // وإلا خذ Id Token
  try {
    const claims = await client.getIdTokenClaims();
    if (claims && claims.__raw) return claims.__raw;
  } catch (_) {}
  throw new Error("Missing token");
}
