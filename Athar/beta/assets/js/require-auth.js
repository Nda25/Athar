// /assets/js/require-auth.js
// =============================================
// Athar - Unified front-end guard for all pages
// - يمنع فلاش المحتوى في الصفحات المحمية
// - يتحقق من هوية المستخدم + صلاحياته + حالة الاشتراك
// - يعالج ثغرة زر الرجوع (bfcache/pageshow)
// - يرسل غير المصرح لهم إلى pricing.html مع رسالة
// =============================================

(function AtharGuard(){
  // ===== إعداد Auth0 (ثابتة حسب مشروعك) =====
  const AUTH0_DOMAIN = "dev-2f0fmbtj6u8o7en4.us.auth0.com";
  const AUTH0_CLIENT = "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU";
  const API_AUDIENCE = "https://api.athar"; // إن احتجتِه لاحقًا لدوال API محمية
  const REDIRECT_URI = window.location.origin + window.location.pathname;

  // نعرّضها عموميًا لو احتاجتها صفحات أخرى
  window.__CFG = Object.assign({}, window.__CFG || {}, {
    auth0_domain: AUTH0_DOMAIN,
    auth0_clientId: AUTH0_CLIENT,
    api_audience: API_AUDIENCE
  });

  // ===== تعريف الصفحات =====
  const PUBLIC_FILES = new Set([
    "", "index.html", "pricing.html", "programs.html",
    "privacy.html", "terms.html", "refund-policy.html", "whatsapp.html"
  ]);
  const LOGIN_ONLY_FILES = new Set(["profile.html"]); // يحتاج تسجيل دخول فقط
  const TOOL_FILES = new Set(["athar.html","darsi.html","masar.html","miyad.html","ethraa.html","mulham.html"]);
  const ADMIN_FILE = "admin.html";

  // ===== Claims namespace =====
  const NS           = "https://athar.co/";
  const CLAIM_STATUS = NS + "status";   // نتوقع 'active' لفتح الأدوات
  const CLAIM_ROLES  = NS + "roles";    // array
  const CLAIM_ADMIN  = NS + "admin";    // boolean

  // ===== Helpers =====
  const curFile = () => location.pathname.replace(/\/+$/, "").split("/").pop() || "";
  const toPricing = (msg) => {
    try { if (msg) sessionStorage.setItem("athar:msg", msg); } catch {}
    location.replace("/pricing.html");
  };
  const addMetaNoStore = () => {
    // تقليل فرص عرض صفحة محمية من الكاش
    const metas = [
      ['Cache-Control','no-store, no-cache, must-revalidate, max-age=0'],
      ['Pragma','no-cache'],
      ['Expires','0']
    ];
    metas.forEach(([httpEquiv,content])=>{
      const m = document.createElement('meta');
      m.httpEquiv = httpEquiv; m.content = content;
      document.head.appendChild(m);
    });
  };

  // حاجب فوري يمنع أي فلاش لمحتوى محمي قبل التحقق
  function mountGuardOverlay(){
    if (document.getElementById("athar-guard")) return;
    const s = document.createElement("style");
    s.id = "athar-guard-style";
    s.textContent = `
      #athar-guard{position:fixed;inset:0;background:#0b1324;display:flex;align-items:center;justify-content:center;z-index:2147483647}
      #athar-guard .box{color:#fff;font:500 14px/1.6 system-ui,-apple-system,Segoe UI,Roboto;opacity:.9;text-align:center}
      #athar-guard .spin{width:28px;height:28px;border:3px solid #ffffff33;border-top-color:#fff;border-radius:50%;margin:0 auto 10px;animation:ag-spin 0.9s linear infinite}
      @keyframes ag-spin{to{transform:rotate(360deg)}}
    `;
    document.head.appendChild(s);
    const d = document.createElement("div");
    d.id = "athar-guard";
    d.innerHTML = `<div class="box"><div class="spin"></div><div>جاري التحقق من الصلاحيات…</div></div>`;
    document.documentElement.appendChild(d);
  }
  function unmountGuardOverlay(){
    const d = document.getElementById("athar-guard"); if (d) d.remove();
    const s = document.getElementById("athar-guard-style"); if (s) s.remove();
  }

  // تحميل مكتبة Auth0 SPA إن لم تكن موجودة
  async function ensureAuth0SDK(){
    if (window.auth0?.createAuth0Client) return;
    await new Promise((res, rej) => {
      const sc = document.createElement("script");
      sc.src = "https://cdn.auth0.com/js/auth0-spa-js/2.1/auth0-spa-js.production.js";
      sc.onload = res; sc.onerror = rej; document.head.appendChild(sc);
    });
  }

  async function buildClient(){
    await ensureAuth0SDK();
    const c = await window.auth0.createAuth0Client({
      domain: AUTH0_DOMAIN,
      clientId: AUTH0_CLIENT,
      cacheLocation: "localstorage",
      useRefreshTokens: true,
      authorizationParams: { redirect_uri: REDIRECT_URI, scope: "openid profile email" }
    });
    window.auth0Client = c;
    window.auth = c; // توافق مع كود قديم
    return c;
  }

  async function cleanupRedirectIfNeeded(client){
    // معالجة العودة من Auth0 (code/state)
    if (location.search.includes("code=") && location.search.includes("state=")) {
      try {
        await client.handleRedirectCallback();
      } catch {}
      history.replaceState({}, document.title, location.pathname + location.hash);
    }
  }

  const isAdmin = (claims) => {
    const roles = claims?.[CLAIM_ROLES] || [];
    return roles.includes("admin") || claims?.[CLAIM_ADMIN] === true;
  };
  const userStatus = (claims) => claims?.[CLAIM_STATUS] || "";

  // ===== المنطق الأساسي =====
  async function enforce(){
    addMetaNoStore();         // تقليل الرجوع من الكاش
    mountGuardOverlay();      // حاجب فوري
    const file = curFile();

    // الصفحات العامة: فقط نظّف العودة من Auth0 لو موجودة ثم اسمح بالعرض
    if (PUBLIC_FILES.has(file)) {
      try { const tmp = await buildClient(); await cleanupRedirectIfNeeded(tmp); } catch {}
      unmountGuardOverlay();
      return;
    }

    // باقي الصفحات تتطلب تحقق
    const client = await buildClient();
    await cleanupRedirectIfNeeded(client);

    let authed = false, claims = null;
    try { authed = await client.isAuthenticated(); } catch {}

    const redirectToLogin = async () => {
      try {
        await client.loginWithRedirect({
          authorizationParams: { screen_hint:"login", redirect_uri: REDIRECT_URI }
        });
      } catch {
        toPricing("الرجاء تسجيل الدخول للوصول إلى هذه الصفحة.");
      }
    };

    // صفحات تسجيل الدخول فقط
    if (LOGIN_ONLY_FILES.has(file)) {
      if (!authed) return redirectToLogin();
      unmountGuardOverlay();
      return;
    }

    // أدوات + أدمن = تتطلب تسجيل دخول
    if (!authed) return redirectToLogin();

    // اجلب Claims
    try { claims = await client.getIdTokenClaims(); } catch {}

    // أدمن
    if (file === ADMIN_FILE) {
      if (!isAdmin(claims)) {
        return toPricing("هذه الصفحة متاحة للمشرفين فقط.");
      }
      unmountGuardOverlay();
      return;
    }

    // أدوات: لازم status = active
    if (TOOL_FILES.has(file)) {
      const st = userStatus(claims);
      if (st !== "active") {
        return toPricing("حسابك غير مُفعّل بعد. الرجاء الاشتراك أو انتظار التفعيل.");
      }
      unmountGuardOverlay();
      return;
    }

    // أي صفحة أخرى غير مصنفة = نعاملها كأداة (احترازياً)
    const st = userStatus(claims);
    if (st !== "active") {
      return toPricing("هذه الصفحة للمشتركين النشطين فقط.");
    }
    unmountGuardOverlay();
  }

  // تشغيل أولي
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enforce);
  } else {
    enforce();
  }

  // معالجة ثغرة الرجوع من الكاش (bfcache)
  window.addEventListener("pageshow", function(e){
    // لو الصفحة رجعت من الكاش، نعيد الفحص والرديركت إن لزم
    if (e.persisted) {
      enforce();
    }
  });
})();
