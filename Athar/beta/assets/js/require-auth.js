// /assets/js/require-auth.js
// =============================================
// Athar - Front-end Guard (with debug logs, slug paths)
// - يمنع فلاش المحتوى في الصفحات المحمية
// - يتحقق من هوية المستخدم + صلاحياته + حالة الاشتراك
// - يدعم الروابط بـ .html وبدونها (/admin و /admin.html)
// - يعالج ثغرة الرجوع bfcache
// - يسجل خطوات في Console لتشخيص أي مشكلة
// =============================================
(function AtharGuard(){
  // ===== إعداد Auth0 =====
  const AUTH0_DOMAIN = "dev-2f0fmbtj6u8o7en4.us.auth0.com";
  const AUTH0_CLIENT = "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU";
const API_AUDIENCE = "https://api.n-athar";
  const REDIRECT_URI = window.location.origin + window.location.pathname;

  // DEBUG
  const DEBUG = true;
  const log  = (...a)=>{ if (DEBUG) console.info("[AtharGuard]", ...a); };
  const warn = (...a)=>{ console.warn("[AtharGuard]", ...a); };
  const err  = (...a)=>{ console.error("[AtharGuard]", ...a); };

  // نعرض الإعدادات عموميًا إن احتاجتها سكربتات أخرى
  window.__CFG = Object.assign({}, window.__CFG || {}, {
    auth0_domain: AUTH0_DOMAIN,
    auth0_clientId: AUTH0_CLIENT,
    api_audience: API_AUDIENCE
  });

  // ===== تحويل المسار إلى "slug" موحّد =====
  // "/" أو "/index" أو "/index.html" => "index"
  // "/admin" أو "/admin.html"        => "admin"
  function fileSlug(){
    let p = location.pathname.replace(/\/+$/,''); // شيل السلاش الأخير
    if (p === "" || p === "/") return "index";
    const last = p.split("/").pop();              // "admin" أو "admin.html"
    return last.replace(/\.html?$/i, "").toLowerCase();
  }

  // ===== تعريف الصفحات حسب "slug" =====
  const PUBLIC = new Set([
    "index", "pricing", "programs",
    "privacy", "terms", "refund-policy", "whatsapp"
  ]);

  const LOGIN_ONLY = new Set(["profile"]); // يتطلب دخول فقط
  const TOOLS = new Set(["athar","darsi","masar","miyad","ethraa","mulham"]);
  const ADMIN = "admin";

  // ===== Claims namespace =====
  const NS           = "https://n-athar.co/";
  const CLAIM_STATUS = NS + "status";   // نتوقع 'active' لفتح الأدوات
  const CLAIM_ROLES  = NS + "roles";    // array
  const CLAIM_ADMIN  = NS + "admin";    // boolean

  // ===== Helpers =====
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

  // حاجب فوري يمنع فلاش المحتوى
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
    document.getElementById("athar-guard")?.remove();
    document.getElementById("athar-guard-style")?.remove();
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
authorizationParams: { redirect_uri: REDIRECT_URI, scope: "openid profile email offline_access" }
    };
    if (API_AUDIENCE) options.authorizationParams.audience = API_AUDIENCE;
    const c = await f(options);
    window.auth0Client = c; window.auth = c;
    return c;
  }

  async function cleanupRedirectIfNeeded(client){
    if (location.search.includes("code=") && location.search.includes("state=")) {
      try { await client.handleRedirectCallback(); }
      catch (e) { /* لا نوقف الصفحة */ }
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
    const slug = fileSlug();
    log("slug:", slug);

    // الصفحات العامة: فقط نظّف العودة من Auth0 لو موجودة ثم اسمح بالعرض
    if (PUBLIC.has(slug)) {
      try { const tmp = await buildClient(); await cleanupRedirectIfNeeded(tmp); } catch {}
      log("Public -> allowed");
      unmountGuardOverlay();
      return;
    }

    // باقي الصفحات تتطلب تحقق
    let client;
    try { client = await buildClient(); await cleanupRedirectIfNeeded(client); }
    catch (e) { err("Auth0 init failed:", e?.message || e); unmountGuardOverlay(); return; }

    // profile: تسجيل دخول فقط
    if (LOGIN_ONLY.has(slug)) {
      let authed = false;
      try { authed = await client.isAuthenticated(); } catch {}
      if (!authed) {
        log("profile requires login -> redirect login");
        try {
          await client.loginWithRedirect({ authorizationParams: { screen_hint:"login", redirect_uri: REDIRECT_URI } });
          return;
        } catch (e) {
          return toPricing("الرجاء تسجيل الدخول للوصول إلى هذه الصفحة.");
        }
      }
      log("profile allowed");
      unmountGuardOverlay();
      return;
    }

    // أدوات/أدمن: تحتاج تسجيل دخول
    let authed = false, claims = null;
    try { authed = await client.isAuthenticated(); } catch {}
    if (!authed) {
      log("Protected requires login -> redirect login");
      try {
        await client.loginWithRedirect({ authorizationParams: { screen_hint:"login", redirect_uri: REDIRECT_URI } });
        return;
      } catch (e) {
        return toPricing("الرجاء تسجيل الدخول للوصول إلى هذه الصفحة.");
      }
    }

    try { claims = await client.getIdTokenClaims(); } catch {}

    // admin
    if (slug === ADMIN) {
      if (!isAdmin(claims)) {
        log("admin blocked: missing admin claim/role");
        return toPricing("هذه الصفحة متاحة للمشرفين فقط.");
      }
      log("admin allowed");
      unmountGuardOverlay();
      return;
    }

    // الأدوات: لازم status = active
    if (TOOLS.has(slug)) {
      const st = userStatus(claims);
      if (st !== "active") {
        log("tool blocked: status=", st);
        return toPricing("حسابك غير مُفعّل بعد. الرجاء الاشتراك أو انتظار التفعيل.");
      }
      log("tool allowed");
      unmountGuardOverlay();
      return;
    }

    // أي صفحة غير مصنفة = نتعامل معها كمحمية وتتطلب اشتراك نشط
    const st = userStatus(claims);
    if (st !== "active") {
      log("unlisted protected page blocked: status=", st);
      return toPricing("هذه الصفحة للمشتركين النشطين فقط.");
    }
    log("unlisted protected page allowed");
    unmountGuardOverlay();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enforce);
  } else {
    enforce();
  }

  // معالجة ثغرة الرجوع من الكاش (bfcache)
  window.addEventListener("pageshow", function(e){
    if (e.persisted) enforce();
  });
})();
