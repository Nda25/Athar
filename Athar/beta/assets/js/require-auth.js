// /assets/js/require-auth.js
// =============================================
// Athar - Front-end Guard (with debug logs)
// - يمنع فلاش المحتوى في الصفحات المحمية
// - يتحقق من هوية المستخدم + صلاحياته + حالة الاشتراك
// - يعالج ثغرة زر الرجوع (bfcache/pageshow)
// - يسجّل خطوات واضحة في Console لمعرفة سبب المنع
// =============================================
(function AtharGuard(){
  // ===== إعداد Auth0 =====
  const AUTH0_DOMAIN = "dev-2f0fmbtj6u8o7en4.us.auth0.com";
  const AUTH0_CLIENT = "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU";
  const API_AUDIENCE = "https://api.athar"; // (اختياري) لنداءات API
  const REDIRECT_URI = window.location.origin + window.location.pathname;

  // DEBUG: فعّلي السجل التفصيلي (اعيديها false لإسكاته)
  const DEBUG = true;
  const log = (...a)=>{ if (DEBUG) console.info("[AtharGuard]", ...a); };
  const warn = (...a)=>{ console.warn("[AtharGuard]", ...a); };
  const err  = (...a)=>{ console.error("[AtharGuard]", ...a); };

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

  // يحتاج تسجيل دخول فقط (بدون اشتراك نشط)
  const LOGIN_ONLY_FILES = new Set(["profile.html"]);

  // الأدوات — تتطلب status=active
  const TOOL_FILES = new Set([
    "athar.html","darsi.html","masar.html","miyad.html","ethraa.html","mulham.html"
    // لو عندك صفحة "منطلق" باسم معين ضيفيها هنا بالضبط مثل اسم الملف
    // "muntaq.html"
  ]);

  const ADMIN_FILE = "admin.html";

  // ===== Claims namespace =====
  const NS           = "https://athar.co/";
  const CLAIM_STATUS = NS + "status";   // نتوقع 'active' لفتح الأدوات
  const CLAIM_ROLES  = NS + "roles";    // array
  const CLAIM_ADMIN  = NS + "admin";    // boolean

  // ===== Helpers =====
  const curFile = () => {
    const f = location.pathname.replace(/\/+$/,"").split("/").pop() || "";
    return f;
  };
  const toPricing = (msg) => {
    try { if (msg) sessionStorage.setItem("athar:msg", msg); } catch {}
    location.replace("/pricing.html");
  };
  const addMetaNoStore = () => {
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
    if (window.auth0?.createAuth0Client || window.createAuth0Client) return;
    await new Promise((res, rej) => {
      const sc = document.createElement("script");
      sc.src = "https://cdn.auth0.com/js/auth0-spa-js/2.1/auth0-spa-js.production.js";
      sc.onload = res; sc.onerror = rej; document.head.appendChild(sc);
    });
  }

  async function buildClient(){
    await ensureAuth0SDK();
    const f = window.auth0?.createAuth0Client || window.createAuth0Client;
    if (!f) throw new Error("Auth0 SPA SDK not available");
    const options = {
      domain: AUTH0_DOMAIN,
      clientId: AUTH0_CLIENT,
      cacheLocation: "localstorage",
      useRefreshTokens: true,
      authorizationParams: { redirect_uri: REDIRECT_URI, scope: "openid profile email" }
    };
    if (API_AUDIENCE) options.authorizationParams.audience = API_AUDIENCE;
    const c = await f(options);
    window.auth0Client = c; window.auth = c;
    return c;
  }

  async function cleanupRedirectIfNeeded(client){
    if (location.search.includes("code=") && location.search.includes("state=")) {
      try {
        await client.handleRedirectCallback();
        log("Handled Auth0 redirect callback");
      } catch (e) {
        warn("Auth0 callback error:", e?.message || e);
      }
      history.replaceState({}, document.title, location.pathname + location.hash);
    }
  }

  const isAdmin = (claims) => {
    const roles = claims?.[CLAIM_ROLES] || [];
    return roles.includes("admin") || claims?.[CLAIM_ADMIN] === true;
  };
  const userStatus = (claims) => claims?.[CLAIM_STATUS] || "";

  async function enforce(){
    addMetaNoStore();
    mountGuardOverlay();
    const file = curFile();
    log("File:", file);

    // الصفحات العامة: فقط نظّف العودة من Auth0 لو موجودة ثم اسمح بالعرض
    if (PUBLIC_FILES.has(file)) {
      try {
        const tmp = await buildClient();
        await cleanupRedirectIfNeeded(tmp);
      } catch (e) {
        warn("Public page: build/cleanup error:", e?.message || e);
      }
      log("Public page -> allowed");
      unmountGuardOverlay();
      return;
    }

    // باقي الصفحات تتطلب تحقق
    let client;
    try {
      client = await buildClient();
      await cleanupRedirectIfNeeded(client);
    } catch (e) {
      err("Failed to init Auth0 client:", e?.message || e);
      unmountGuardOverlay();
      return;
    }

    let authed = false, claims = null, user = null;
    try { authed = await client.isAuthenticated(); } catch (e) { warn("isAuthenticated error:", e?.message || e); }

    if (LOGIN_ONLY_FILES.has(file)) {
      // profile.html: يكفي تسجيل الدخول
      if (!authed) {
        log("profile.html requires login -> redirecting to login");
        try {
          await client.loginWithRedirect({ authorizationParams: { screen_hint: "login", redirect_uri: REDIRECT_URI } });
          return;
        } catch (e) {
          warn("Login redirect failed:", e?.message || e);
          return toPricing("الرجاء تسجيل الدخول للوصول إلى هذه الصفحة.");
        }
      }
      try { user = await client.getUser(); } catch {}
      log("profile.html allowed for user:", user?.email || user?.sub || "(unknown)");
      unmountGuardOverlay();
      return;
    }

    // أدوات + أدمن = تتطلب تسجيل دخول
    if (!authed) {
      log("Protected page requires login -> redirecting to login");
      try {
        await client.loginWithRedirect({ authorizationParams: { screen_hint: "login", redirect_uri: REDIRECT_URI } });
        return;
      } catch (e) {
        warn("Login redirect failed:", e?.message || e);
        return toPricing("الرجاء تسجيل الدخول للوصول إلى هذه الصفحة.");
      }
    }

    // اجلب Claims
    try { claims = await client.getIdTokenClaims(); } catch (e) { warn("getIdTokenClaims failed:", e?.message || e); }
    try { user = await client.getUser(); } catch {}

    log("User:", user?.email || user?.sub || "(unknown)");
    log("status claim:", userStatus(claims), "| isAdmin:", isAdmin(claims));

    // أدمن
    if (file === ADMIN_FILE) {
      if (!isAdmin(claims)) {
        warn("admin.html blocked: missing admin role/claim");
        return toPricing("هذه الصفحة متاحة للمشرفين فقط.");
      }
      log("admin.html allowed");
      unmountGuardOverlay();
      return;
    }

    // أدوات: لازم status = active
    if (TOOL_FILES.has(file)) {
      const st = userStatus(claims);
      if (st !== "active") {
        warn("Tool blocked: status not active (status=", st, ")");
        return toPricing("حسابك غير مُفعّل بعد. الرجاء الاشتراك أو انتظار التفعيل.");
      }
      log("Tool allowed");
      unmountGuardOverlay();
      return;
    }

    // أي صفحة أخرى غير مصنفة = نعاملها كأداة (احترازياً)
    const st = userStatus(claims);
    if (st !== "active") {
      warn("Unlisted protected page blocked: status not active");
      return toPricing("هذه الصفحة للمشتركين النشطين فقط.");
    }
    log("Unlisted protected page allowed");
    unmountGuardOverlay();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enforce);
  } else {
    enforce();
  }

  // معالجة ثغرة الرجوع من الكاش (bfcache)
  window.addEventListener("pageshow", function(e){
    if (e.persisted) {
      log("pageshow (bfcache) -> re-enforce");
      enforce();
    }
  });
})();
