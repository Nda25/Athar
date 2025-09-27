/* ============================
 * Athar - app.js (final clean)
 * يعتمد على:
 *  - require-auth.js (ينشئ window.auth ويطلق auth0:ready)
 *  - assets/js/supabase-client.js (فيه supaEnsureUser / supaEnsureUserProfile / supaLogToolUsage)
 *  - ui.js / theme.js / storage.js (اختياري)
 * ============================ */

/* ====== Hard Reset (مرة واحدة فقط بعد ترقية) ====== */
(function hardResetOnce(){
  try {
    const FLAG = "ATHAR_V2_READY";
    if (!localStorage.getItem(FLAG)) {
      localStorage.clear();
      sessionStorage.clear();

      if ('indexedDB' in window && indexedDB.databases) {
        indexedDB.databases().then(dbs => {
          dbs.forEach(db => { if (db && db.name) indexedDB.deleteDatabase(db.name); });
        });
      }
      localStorage.setItem(FLAG, "1");
      console.log("[Athar] One-time storage reset done.");
    }
  } catch (_) {}
})();

/* ====== إعدادات Auth0 (تُقرأ إن وُجدت) ====== */
if (typeof window.AUTH0_DOMAIN === 'undefined') {
  window.AUTH0_DOMAIN = "dev-2f0fmbtj6u8o7en4.us.auth0.com";
}
if (typeof window.AUTH0_CLIENT === 'undefined') {
  window.AUTH0_CLIENT = "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU";
}
const AUTH0_DOMAIN = window.AUTH0_DOMAIN;
const AUTH0_CLIENT = window.AUTH0_CLIENT;

/* ====== Callback ثابت للدخول/التسجيل + وجهة الخروج ====== */
const CALLBACK = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:8888/profile.html'    // أثناء التطوير المحلي
  : 'https://n-athar.co/profile.html';       // على الإنتاج

const RETURN_TO = CALLBACK.startsWith('http://localhost:8888')
  ? 'http://localhost:8888'
  : 'https://n-athar.co';

console.log('[Auth] redirect_uri =', CALLBACK);
console.log('[Auth] returnTo     =', RETURN_TO);

/* ====== أدوات صغيرة ====== */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

/* ============================== Theme ============================== */
(function unifyDarkClass(){
  const root = document.documentElement, body = document.body;
  if (body && body.classList.contains('dark')) {
    body.classList.remove('dark');
    root.classList.add('dark');
  }
})();
(function initTheme(){
  const root = document.documentElement;
  let saved = null; 
  try { saved = localStorage.getItem('theme'); } catch(_){}
  if (saved === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
})();
function bindThemeToggle(){
  const root = document.documentElement;
  const btn  = document.getElementById('themeToggle');
  if (!btn) return;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const dark = root.classList.toggle('dark');
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch(_){}
    if (typeof window.toast === 'function') {
      toast(dark ? 'تم تفعيل الوضع الداكن' : 'تم تفعيل الوضع الفاتح');
    }
  });
}

/* ============================== Toast ============================== */
if (!window.toast) {
  window.toast = function(msg){
    let t = document.querySelector('.toast');
    if(!t){ t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(()=> t.classList.remove('show'), 1800);
  };
}

/* ============================== Modals ============================== */
if (!window.openModal)  window.openModal  = (id)=>{ const n=$(id); if(n) n.classList.add('show'); };
if (!window.closeModal) window.closeModal = (id)=>{ const n=$(id); if(n) n.classList.remove('show'); };
$$('.modal [data-close]').forEach(btn => btn.addEventListener('click', e=>{
  e.preventDefault();
  const m = btn.closest('.modal'); if(m) m.classList.remove('show');
}));

/* ========================= Supabase Helpers ========================= */
/** يحفظ/يحدّث المستخدم في Supabase اعتماداً على بيانات Auth0 */
async function supaEnsureUserFromAuth0() {
  try {
    const u = await window.auth?.getUser();
    if (!u || !u.email) return;

    if (typeof window.supaEnsureUser === 'function') {
      await window.supaEnsureUser({
        email: String(u.email).toLowerCase(),
        full_name: u.name || u.nickname || null
      });
    } else if (typeof window.supaEnsureUserProfile === 'function') {
      await window.supaEnsureUserProfile({
        sub: u.sub,
        email: String(u.email).toLowerCase(),
        name: u.name || u.nickname || null,
        picture: u.picture || null
      });
    }
  } catch (_) {}
}

/* =============== زر لوحة التحكم (أدمن) =============== */
/** إظهار/إخفاء زر لوحة التحكم حسب الـ claims (بعد تأكد تسجيل الدخول) */
async function toggleAdminButton() {
  const adminBtn = document.getElementById("adminBtn");
  if (!adminBtn) return;

  try {
    // لا تواصلي لو مافي جلسة دخول مؤكدة
    if (!window.auth?.isAuthenticated) {
      adminBtn.style.display = "none";
      return;
    }
    const authed = await window.auth.isAuthenticated();
    if (!authed) {
      adminBtn.style.display = "none";
      return;
    }

    // بعدها فقط استرجعي الـ claims واحسبي isAdmin
    const claims = await window.auth.getIdTokenClaims();

    const NS  = "https://n-athar.co/";
    const ALT = "https://athar.co/";

    console.log('[admin] claims:', claims);
    console.log('[admin] roles:', claims?.[NS+"roles"] || claims?.[ALT+"roles"]);
    console.log('[admin] admin flag:', claims?.[NS+"admin"] ?? claims?.[ALT+"admin"]);

    const roles   = claims?.[NS+"roles"] || claims?.[ALT+"roles"] || [];
    const isAdmin = (Array.isArray(roles) && roles.includes("admin"))
                 || claims?.[NS+"admin"] === true
                 || claims?.[ALT+"admin"] === true;

    adminBtn.style.display = isAdmin ? "inline-flex" : "none";
  } catch (err) {
    console.error("Error checking admin role:", err);
    adminBtn.style.display = "none";
  }
}

/* =============== أزرار الدخول/التسجيل/الخروج =============== */
function bindAuthButtons() {
  const loginBtn    = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const logoutBtn   = document.getElementById('logout');

  function setButtons(isAuth) {
    if (loginBtn)    loginBtn.style.display    = isAuth ? 'none' : '';
    if (registerBtn) registerBtn.style.display = isAuth ? 'none' : '';
    if (logoutBtn)   logoutBtn.style.display   = isAuth ? ''     : 'none';

    const profileLink = document.getElementById('nav-profile');
    if (profileLink) profileLink.style.display = isAuth ? '' : 'none';
  }
  window.__setAuthButtons = setButtons;
  setButtons(false);

  const inviteCode = new URLSearchParams(location.search).get('code') || undefined;

  // === زر الدخول ===
  if (loginBtn) {
    loginBtn.onclick = () =>
      window.auth?.loginWithRedirect
        ? window.auth.loginWithRedirect({
            authorizationParams: {
              screen_hint: 'login',
              redirect_uri: CALLBACK
            }
          })
        : window.auth?.login?.({
            authorizationParams: {
              screen_hint: 'login',
              redirect_uri: CALLBACK
            }
          });
  }

  // === زر التسجيل ===
  if (registerBtn) {
    registerBtn.onclick = () =>
      window.auth?.loginWithRedirect
        ? window.auth.loginWithRedirect({
            authorizationParams: {
              screen_hint: 'signup',
              redirect_uri: CALLBACK,
              ...(inviteCode ? { code: inviteCode } : {})
            }
          })
        : window.auth?.login?.({
            authorizationParams: {
              screen_hint: 'signup',
              redirect_uri: CALLBACK,
              ...(inviteCode ? { code: inviteCode } : {})
            }
          });
  }

  // === زر الخروج ===
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      if (window.auth?.logout) return window.auth.logout();
      if (window.auth0Client?.logout) {
        return window.auth0Client.logout({ logoutParams:{ returnTo: RETURN_TO }});
      }
    };
  }

  window.addEventListener('auth0:ready', async () => {
    try {
      const ok = await (window.auth?.isAuthenticated ? window.auth.isAuthenticated() : window.auth0Client?.isAuthenticated());
      setButtons(!!ok);
    } catch {
      setButtons(false);
    }
  }, { once: true });

  (async () => {
    try {
      if (window.auth?.isAuthenticated) {
        const ok = await window.auth.isAuthenticated();
        setButtons(!!ok);
      }
    } catch {
      setButtons(false);
    }
  })();
}

/* =============== تسجيل استخدام الأدوات (view) =============== */
async function logToolViewIfAny() {
  try {
    const file = (location.pathname.split('/').pop() || '').toLowerCase();
    const base = file.replace('.html', '');

    const aliases = {
      athar: 'muntalaq',  // مُنطلق
      darsi: 'murtakaz',  // مُرتكز
      // البقية نفس الاسم: miyad, masar, ethraa, mulham
    };

    const tool = aliases[base] || base;
    if (!tool) return;

    if (typeof window.supaLogToolUsage === 'function') {
      await window.supaLogToolUsage(`${tool}:view`);
    }
  } catch (_) {}
}

/* ============================== Entry ============================== */
document.addEventListener('DOMContentLoaded', async () => {
  bindThemeToggle();
  bindAuthButtons();

  window.addEventListener('auth0:ready', async () => {
    await supaEnsureUserFromAuth0();   // حفظ/تحديث المستخدم في Supabase
    await toggleAdminButton();         // إظهار زر الأدمن إن وُجدت الصلاحية
    await logToolViewIfAny();          // سجل مشاهدة الأداة (إن وُجدت)
  }, { once: true });

  if (window.auth) {                   // في حال كان جاهز قبل الحدث
    await toggleAdminButton();
  }
});

/* ======================= إعلان أعلى الموقع ======================= */
// إعلان أعلى الموقع — يظهر إذا كان هناك إعلان فعّال الآن
async function mountAnnouncementBar(){
  try{
    const res = await fetch('/.netlify/functions/admin-announcement?latest=1', { cache:'no-store' });
    if (!res.ok) return;
    const ann = await res.json();
    if (!ann?.active || !ann?.text) return;

    const bar = document.createElement('div');
    bar.dir='rtl';
    bar.style.cssText="background:#1f2937;color:#fff;padding:10px 14px;text-align:center;font-weight:800";
    bar.textContent = ann.text;
    document.body.prepend(bar);
  }catch(_){}
}
document.addEventListener('DOMContentLoaded', mountAnnouncementBar);

/* ======================= شريط تجربة 3 أيام (اختياري) ======================= */
// يظهر فقط إذا كانت حالة المستخدم "trial" ويوجد claim باسم trial_expires
async function mountTrialBanner(){
  try{
    if (!window.auth?.isAuthenticated) return;
    const ok = await window.auth.isAuthenticated();
    if (!ok) return;

    const claims = await window.auth.getIdTokenClaims();
    const NS  = "https://n-athar.co/";
    const ALT = "https://athar.co/";
    const status = claims?.[NS+"status"] ?? claims?.[ALT+"status"];
    if (status !== "trial") return;

    const expStr = claims?.[NS+"trial_expires"] ?? claims?.[ALT+"trial_expires"];
    if (!expStr) return; // لو ما وصل claim للتاريخ ما نعرض عداد

    const exp = new Date(expStr);
    if (isNaN(+exp)) return;

    function daysLeft(){
      const ms = exp.getTime() - Date.now();
      return Math.max(0, Math.ceil(ms / (1000*60*60*24)));
    }

    const dLeft = daysLeft();
    if (dLeft <= 0) return;

    const bar = document.createElement('div');
    bar.dir = 'rtl';
    bar.id  = 'trial-banner';
    bar.style.cssText = "background:#fde68a;color:#1f2937;padding:10px 14px;text-align:center;font-weight:700";
    bar.textContent = `أنتِ على الخطة التجريبية — تبقّى ${dLeft} يوم`;

    // لو فيه شريط إعلان، ضعي التجربة تحته مباشرة
    const first = document.body.firstElementChild;
    if (first) {
      first.insertAdjacentElement('afterend', bar);
    } else {
      document.body.prepend(bar);
    }

    // تحديث نص العدّاد يوميًا تقريبًا
    const timer = setInterval(() => {
      const n = daysLeft();
      if (n <= 0) { clearInterval(timer); bar.remove(); return; }
      bar.textContent = `أنتِ على الخطة التجريبية — تبقّى ${n} يوم`;
    }, 60 * 60 * 1000); // تحديث كل ساعة
  }catch(_){}
}
// نفّذي شريط التجربة بعد جاهزية Auth0 (لو claims متاحة)
window.addEventListener('auth0:ready', mountTrialBanner, { once:true });
