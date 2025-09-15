/* assets/js/require-auth.js
   يحمي كل الصفحات ما عدا العامة المذكورة أدناه.
*/
(async () => {
  const domain   = "dev-2f0fmbtj6u8o7en4.us.auth0.com";
  const clientId = "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU";
  const redirectUri = window.location.origin + "/"; // مكان الرجوع بعد الدخول

  // الصفحات العامة (تفتح بدون تسجيل)
  const PUBLIC_PATHS = new Set([
    "/", "/index.html", "/pricing.html", "/programs.html"
  ]);

  // لو الـ SDK مو محمّل، نحمّله ديناميكياً (فالباك)
  async function ensureAuth0Sdk() {
    if (typeof window.createAuth0Client === "function") return;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.auth0.com/js/auth0-spa-js/2.1/auth0-spa-js.production.js";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // لو الصفحة عامة: مرّري المستخدم + نظّفي الكولباك إن وجد
  const path = (location.pathname.replace(/\/+$/, "") || "/");
  if (PUBLIC_PATHS.has(path)) {
    try {
      await ensureAuth0Sdk();
      if (location.search.includes("code=") && location.search.includes("state=")) {
        const c = await createAuth0Client({ domain, clientId, authorizationParams:{ redirect_uri: redirectUri } });
        await c.handleRedirectCallback();
        history.replaceState({}, document.title, location.pathname);
      }
    } catch (_) { /* تجاهل */ }
    return;
  }

  // صفحة محمية
  try {
    await ensureAuth0Sdk();
    const auth0Client = await createAuth0Client({
      domain, clientId,
      cacheLocation: "localstorage",
      authorizationParams: { redirect_uri: redirectUri }
    });

    // تنظيف رجوع Auth0
    if (location.search.includes("code=") && location.search.includes("state=")) {
      try {
        await auth0Client.handleRedirectCallback();
        history.replaceState({}, document.title, location.pathname);
      } catch (e) {
        console.error("Auth0 redirect error:", e);
      }
    }

    const loggedIn = await auth0Client.isAuthenticated();
    if (!loggedIn) {
      // رجّعيه لصفحة الخطط (أو الرئيسية)
      location.replace("/pricing.html");
      return;
    }

    // مستخدم مصادَق → خذي بياناته (اختياري) واربطِه في Supabase
    try {
      const u = await auth0Client.getUser();
      if (typeof supaEnsureUser === "function" && u?.email) {
        await supaEnsureUser({
          email: u.email,
          full_name: u.name || "",
          role: "user"
        });
      }
    } catch (e) {
      console.warn("Link to Supabase failed:", e);
    }
  } catch (e) {
    console.error("require-auth failed:", e);
    // كخطة بديلة: لو صار خطأ، ما نعلّق المستخدم
    // تقدرين بدل هذا تعيديه للرئيسية
  }
})();
