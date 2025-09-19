if (typeof window.AUTH0_DOMAIN === 'undefined') {
  window.AUTH0_DOMAIN = "dev-2f0fmbtj6u8o7en4.us.auth0.com";
}
if (typeof window.AUTH0_CLIENT === 'undefined') {
  window.AUTH0_CLIENT = "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU";
}

const AUTH0_DOMAIN = window.AUTH0_DOMAIN;
const AUTH0_CLIENT = window.AUTH0_CLIENT;
/* أدوات صغيرة */
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

/* ============================== Auth0 ============================== */

let auth0Client = null;

// ننتظر حتى تتوفر window.auth0.createAuth0Client
async function waitForAuth0SDK(max = 50) {
  for (let i = 0; i < max && !(window.auth0 && typeof window.auth0.createAuth0Client === 'function'); i++) {
    await new Promise(r => setTimeout(r, 100)); // ~5 ثواني
  }
  return (window.auth0 && typeof window.auth0.createAuth0Client === 'function');
}

async function initAuth0(){
  const ready = await waitForAuth0SDK();
  if (!ready) {
    console.error("[Auth0] SDK still not loaded");
    return;
  }

  try {
    auth0Client = await window.auth0.createAuth0Client({
      domain: AUTH0_DOMAIN,
      clientId: AUTH0_CLIENT,
      cacheLocation: "localstorage",
      authorizationParams: { 
        redirect_uri: window.location.origin,
        scope: "openid profile email offline_access"
      }
    });

    // تنظيف العودة من Auth0
    if (/[?&](code|state)=/.test(location.search)) {
      try {
        await auth0Client.handleRedirectCallback();
        history.replaceState({}, document.title, location.pathname + location.hash);
      } catch (e) {
        console.warn("[Auth0] redirect cleanup:", e);
      }
    }

    // API مبسّطة على window.auth
    const api = {
      login:  (opts)=> auth0Client.loginWithRedirect(opts||{}),
      logout: (opts)=> auth0Client.logout({ logoutParams:{ returnTo: window.location.origin }, ...(opts||{}) }),
      isAuthenticated: ()=> auth0Client.isAuthenticated(),
      getUser: ()=> auth0Client.getUser(),
      getToken: (opts)=> auth0Client.getTokenSilently(opts||{})
    };
    window.auth = window.auth || api;

    // أعلن الجاهزية
    window.dispatchEvent(new CustomEvent("auth0:ready"));
    console.log("[Auth0] ready");
  } catch (err) {
    console.error("[Auth0] init error:", err);
  }
}
// يحفظ/يحدّث المستخدم في Supabase اعتماداً على بيانات Auth0
async function supaEnsureUserFromAuth0() {
  try {
    const u = await window.auth?.getUser();
    if (!u || !u.email) return;
    await supaEnsureUser({
      email: String(u.email).toLowerCase(),
      full_name: u.name || u.nickname || null
    });
  } catch (_) {}
}
/* ============================== Entry ============================== */
document.addEventListener('DOMContentLoaded', async () => {
  bindThemeToggle();

  // عناصر الأزرار
  const loginBtn    = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const logoutBtn   = document.getElementById('logout');

  // حالة ابتدائية آمنة
function setButtons(isAuth) {
  if (loginBtn)    loginBtn.style.display    = isAuth ? 'none' : '';
  if (registerBtn) registerBtn.style.display = isAuth ? 'none' : '';
  if (logoutBtn)   logoutBtn.style.display   = isAuth ? ''     : 'none';

  const profileLink = document.getElementById('nav-profile');
  if (profileLink) profileLink.style.display = isAuth ? '' : 'none';
}
  setButtons(false); // دخول/تسجيل ظاهر، خروج مخفي

  // نقرأ كود الدعوة من رابط الصفحة (إن وُجد)
  const inviteCode = new URLSearchParams(location.search).get('code') || undefined;

  // اربطي الأزرار الآن (حتى لو Auth0 يتأخر)
  if (loginBtn) {
    loginBtn.onclick = () => window.auth?.login({
      authorizationParams: {
        screen_hint: 'login',
        redirect_uri: window.location.origin
      }
    });
  }
  if (registerBtn) {
    registerBtn.onclick = () => window.auth?.login({
      authorizationParams: {
        screen_hint: 'signup',
        redirect_uri: window.location.origin,
        ...(inviteCode ? { code: inviteCode } : {})
      }
    });
  }
  if (logoutBtn) {
    logoutBtn.onclick = () => window.auth?.logout();
  }
// اسمعي الجاهزية قبل التهيئة (عشان ما يفوتنا الحدث)// اسمعي الجاهزية قبل التهيئة (عشان ما يفوتنا الحدث)
window.addEventListener('auth0:ready', async () => {
  try {
    const ok = await window.auth.isAuthenticated();
    setButtons(ok); // تُظهر/تُخفي login/register/logout + #nav-profile
  } catch {
    setButtons(false);
  }
}, { once: true });
  
// بعد جاهزية Auth0: احفظ المستخدم وسجّل مشاهدة الصفحة حسب اسم الملف
window.addEventListener('auth0:ready', async () => {
  await supaEnsureUserFromAuth0();

  const path = location.pathname.toLowerCase();

  const pageToTool = {
    'miyad.html' : 'miyad',
    'masar.html' : 'masar',
    'ethraa.html': 'ethraa',
    'mulham.html': 'mulham',
    'athar.html' : 'muntalaq',
    'darsi.html' : 'murtakaz'
  };

  for (const [file, tool] of Object.entries(pageToTool)) {
    if (path.endsWith('/' + file) || path.endsWith(file)) {
      supaLogToolUsage(`${tool}:view`);
      break;
    }
  }
});
// فعليًا نهيّئ Auth0 (يطلق حدث auth0:ready داخله)
await initAuth0();

// باك-أب: لو الحدث فاتنا وكان window.auth جاهز، حدّثي الآن
if (window.auth) {
  try {
    const ok = await window.auth.isAuthenticated();
    setButtons(ok);
  } catch {
    setButtons(false);
  }
}
});
