/* assets/js/require-auth.js — نسخة دون تحميل SDK */

// إعدادات Auth0
const domain      = "dev-2f0fmbtj6u8o7en4.us.auth0.com";
const clientId    = "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU";
const redirectUri = window.location.origin + "/";

// صفحات عامة بالاسم (غير محمية)
const PUBLIC_FILES = new Set(["", "index.html", "pricing.html", "programs.html"]);

// توجيه آمن
function sendToPricing(){ location.replace("/pricing.html"); }

// اسم الملف الحالي
function currentFile(){
  const path = location.pathname.replace(/\/+$/, "");
  const file = path.split("/").pop();
  return file || "";
}

(async () => {
  const file = currentFile();
  const isPublic = PUBLIC_FILES.has(file);

  // الصفحات العامة: فقط تنظيف redirect عند الرجوع من Auth0
  if (isPublic) {
    try {
      if (typeof createAuth0Client === "function" &&
          location.search.includes("code=") &&
          location.search.includes("state=")) {
        const c = await createAuth0Client({
          domain, clientId,
          authorizationParams: { redirect_uri: redirectUri }
        });
        await c.handleRedirectCallback();
        history.replaceState({}, document.title, location.pathname);
      }
    } catch (_) {}
    return;
  }

  // الصفحات المحمية: نفترض أن SDK مُحمّل من الصفحة
  if (typeof createAuth0Client !== "function") {
    console.error("[Auth0] SDK is not loaded. Include the CDN <script> BEFORE this file.");
    return sendToPricing();
  }

  let auth0Client;
  try {
    auth0Client = await createAuth0Client({
      domain, clientId,
      cacheLocation: "localstorage",
      authorizationParams: { redirect_uri: redirectUri }
    });
  } catch (e) {
    console.error("[Auth0] create client failed:", e);
    return sendToPricing();
  }

  // تنظيف الرجوع من Auth0 (إن وُجد)
  try {
    if (location.search.includes("code=") && location.search.includes("state=")) {
      await auth0Client.handleRedirectCallback();
      history.replaceState({}, document.title, location.pathname);
    }
  } catch (e) { console.warn("[Auth0] redirect cleanup error:", e); }

  // تحقق الدخول
  try {
    const loggedIn = await auth0Client.isAuthenticated();
    if (!loggedIn) return sendToPricing();
  } catch (e) {
    console.error("[Auth0] isAuthenticated error:", e);
    return sendToPricing();
  }

  // (اختياري) ربط Supabase إذا متوفر
  try {
    const u = await auth0Client.getUser();
    if (typeof supaEnsureUser === "function" && u?.email) {
      await supaEnsureUser({ email: u.email, full_name: u.name || "", role: "user" });
    }
  } catch (e) {
    console.warn("[Auth0] link to Supabase failed:", e);
  }
})();
