/* assets/js/require-auth.js
   يحمي كل الصفحات ما عدا index.html (الرئيسية).
   غير المسارات والدومين والعميل إذا لزم.
*/
(async () => {
  // ضبط Auth0
  const domain   = "dev-2f0fmbtj6u8o7en4.us.auth0.com";
  const clientId = "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU";
  const defaultRedirectAfterLogin = window.location.origin + "/"; // يرجع للرئيسية بعد الدخول

  // الصفحات العامة المسموح بها بدون تسجيل دخول
  // (الرئيسية فقط كما طلبتِ)
const PUBLIC_PATHS = new Set([
  "/", 
  "/index.html", 
  "/pricing.html",
  "/programs.html"
]);

  // لو الصفحة عامة، اتركي المستخدم
  const path = location.pathname.replace(/\/+$/, "") || "/"; // توحيد المسار
  if (PUBLIC_PATHS.has(path)) {
    // مع ذلك: لو رجعنا من Auth0 بكود/ستيت ننظف الرابط
    try {
      if (location.search.includes("code=") && location.search.includes("state=")) {
        const c = await auth0.createAuth0Client({
          domain, clientId,
          authorizationParams: { redirect_uri: defaultRedirectAfterLogin }
        });
        await c.handleRedirectCallback();
        history.replaceState({}, document.title, location.pathname);
      }
    } catch (e) { /* نتجاهل */ }
    return;
  }

  // الصفحات المحمية: إن كان غير مسجّل → رجّعه للخطط (أو الرئيسية)
  const REDIRECT_IF_UNAUTH = "/plans.html"; // عدّليها لـ "/" إذا ما عندك صفحة خطط

  // ننشئ عميل Auth0 (لنلتقط العودة فقط لو رجع من تسجيل الدخول)
  const auth0Client = await auth0.createAuth0Client({
    domain, clientId,
    authorizationParams: { redirect_uri: defaultRedirectAfterLogin }
  });

  // معالجة رجوع الكود من Auth0 إن وجد (لتنظيف الرابط)
  if (location.search.includes("code=") && location.search.includes("state=")) {
    try {
      await auth0Client.handleRedirectCallback();
      history.replaceState({}, document.title, location.pathname);
    } catch (e) {
      console.error("Auth0 redirect error:", e);
    }
  }

  // تحقق إن كان مسجّل دخول
  const loggedIn = await auth0Client.isAuthenticated();

  if (!loggedIn) {
    // لا نسلّمه للّوجن تلقائيًا — رجّعيه لصفحة الخطط/الرئيسية
    // (هناك يقرر يضغط تسجيل/دخول)
    const target = REDIRECT_IF_UNAUTH.startsWith("http")
      ? REDIRECT_IF_UNAUTH
      : window.location.origin + REDIRECT_IF_UNAUTH;
    window.location.replace(target);
    return;
  }

  // (اختياري) لو تحبين: بعد الدخول نرجّعه لنفس الصفحة التي حاول فتحها
  // نقدر نستخدم appState عند loginWithRedirect بأزرار الدخول عندك.
})();
// بعد ما تجيبي بيانات المستخدم من Auth0
const email = user.email;           // من Auth0
const name  = user.name || user.nickname || "";

// خزّني/حدّثي المستخدم في Supabase
supaEnsureUser({ email, full_name: name, role: "user" });
