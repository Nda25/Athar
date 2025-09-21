// صفحات عامة (بدون تسجيل دخول)
const PUBLIC = new Set(["", "index.html", "pricing.html"]);

// صفحات البرامج المقفلة (ممنوعة للمستخدم pending)
const TOOL_PAGES = new Set([
  "athar.html",   // مُنطلق
  "darsi.html",   // مُرتكز
  "masar.html",   // مسار
  "miyad.html",   // ميعاد
  "ethraa.html",  // إثراء
  "mulham.html"   // مُلهم
]);

// ...

// 0) السماح للصفحات العامة + تنظيف العودة من Auth0
const file = fileName();
if (PUBLIC.has(file)) {
  try { const c = await tempClient(); await cleanupRedirect(c); } catch {}
  return;
}

// 1) أي صفحة غير عامة: لازم تسجيل دخول
//   (profile.html و programs.html مسموحة بمجرد تسجيل الدخول حتى لو status=pending)
let isAuth = false, claims = null, user = null;
// ... (نفس الكود لجلب isAuth/claims/user)

const roles   = (claims && claims[NS + "roles"]) || [];
const isAdmin = Array.isArray(roles) && roles.includes("admin") || claims?.[NS + "admin"] === true;
const status  = (claims && claims[NS + "status"]) || "pending";

// admin.html للأدمن فقط
if (location.pathname.endsWith("/admin.html")) {
  if (!isAdmin) return go("/index.html");
  return;
}

// profile.html: مسموحة لأي مستخدم مسجّل
if (file === "profile.html") {
  return;
}

// programs.html: مسموحة لأي مستخدم مسجّل (حتى pending)
if (file === "programs.html") {
  return;
}

// الصفحات الستة للأدوات: لازم active أو أدمن
if (TOOL_PAGES.has(file)) {
  if (isAdmin || status === "active") return;
  return goProfile("not_active");
}

// أي صفحات أخرى غير معروفة: تبنّي نفس شرط الأدوات
if (!isAdmin && status !== "active") {
  return goProfile("not_active");
}
