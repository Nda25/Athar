/* assets/js/require-auth.js — hardened */
(async () => {
  const domain   = "dev-2f0fmbtj6u8o7en4.us.auth0.com";
  const clientId = "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU";
  const redirectUri = window.location.origin + "/";

  // صفحات عامة بالاسم (بغض النظر عن المسار/المجلد)
  const PUBLIC_FILES = new Set(["", "index.html", "pricing.html", "programs.html"]);

  // ردّ توجيه مغلق (أضمن)
  function sendToPricing() {
    const target = "/pricing.html";
    location.replace(target);
  }

  // اكتشاف اسم الملف من المسار الحالي (يدعم مجلدات مثل /beta/)
  function currentFile() {
    const path = location.pathname.replace(/\/+$/, "");    // شيل السلاشات الزائدة
    const file = path.split("/").pop();                    // اسم الملف
    return file || "";                                     // "" تعني مجرّد "/" (index)
  }

  // حمّلي Auth0 SDK عند الحاجة
  async function ensureAuth0Sdk() {
    if (typeof window.createAuth0Client === "function") return true;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.auth0.com/js/auth0-spa-js/2.1/auth0-spa-js.production.js";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return true;
  }

  // 1) السماح للصفحات العامة فقط
  const file = currentFile();
  const isPublic = PUBLIC_FILES.has(file);
  if (isPublic) {
    // نظّف باراميترات Auth0 إن وُجدت (اختياري)
    try {
      await ensureAuth0Sdk();
      if (location.search.includes("code=") && location.search.includes("state=")) {
        const c = await createAuth0Client({
          domain, clientId,
          authorizationParams: { redirect_uri: redirectUri }
        });
        await c.handleRedirectCallback();
        history.replaceState({}, document.title, location.pathname);
      }
    } catch (_) {}
    return; // صفحات عامة: لا حماية
  }

  // 2) الصفحات المحمية — فشل = توجيه
  try {
    await ensureAuth0Sdk();
  } catch (e) {
    console.error("[Auth0] SDK load failed:", e);
    return sendToPricing(); // فشل تحميل SDK → وجّهي
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
    return sendToPricing(); // فشل إنشاء العميل → وجّهي
  }

  // 3) تنظيف الرجوع من Auth0
  try {
    if (location.search.includes("code=") && location.search.includes("state=")) {
      await auth0Client.handleRedirectCallback();
      history.replaceState({}, document.title, location.pathname);
    }
  } catch (e) {
    console.error("[Auth0] redirect handling error:", e);
    // حتى لو فشل التنظيف، كمّلي للتحقّق من الحالة
  }

  // 4) التحقّق من المصادقة
  try {
    const loggedIn = await auth0Client.isAuthenticated();
    if (!loggedIn) return sendToPricing();
  } catch (e) {
    console.error("[Auth0] isAuthenticated error:", e);
    return sendToPricing(); // أي خطأ هنا → توجيه
  }

  // 5) (اختياري) ربط المستخدم بـ Supabase
  try {
    const u = await auth0Client.getUser();
    if (typeof supaEnsureUser === "function" && u?.email) {
      await supaEnsureUser({ email: u.email, full_name: u.name || "", role: "user" });
    }
  } catch (e) {
    console.warn("[Auth0] link to Supabase failed:", e);
  }
})();
