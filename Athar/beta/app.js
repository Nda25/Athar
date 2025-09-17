/* =========================================
   athar — app.js (نسخة موحّدة)
   ========================================= */

/* أدوات صغيرة */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

/* ==============================
   Theme: init + toggle (موحّد)
   ============================== */
(function unifyDarkClass(){
  const root = document.documentElement, body = document.body;
  if (body && body.classList.contains('dark')) {
    body.classList.remove('dark');
    root.classList.add('dark');
  }
})();
(function initTheme(){
  const root = document.documentElement;
  let saved = null; try { saved = localStorage.getItem('theme'); } catch(_){}
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

/* توست بسيط لو ما كان معرّف */
if (!window.toast) {
  window.toast = function(msg){
    let t = document.querySelector('.toast');
    if(!t){ t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(()=> t.classList.remove('show'), 1800);
  };
}

/* مودالات (اختياري) */
if (!window.openModal)  window.openModal  = (id)=>{ const n=$(id); if(n) n.classList.add('show'); };
if (!window.closeModal) window.closeModal = (id)=>{ const n=$(id); if(n) n.classList.remove('show'); };
$$('.modal [data-close]').forEach(btn => btn.addEventListener('click', e=>{
  e.preventDefault();
  const m = btn.closest('.modal'); if(m) m.classList.remove('show');
}));

/* ==============================
   Auth0 — في مكان واحد
   ============================== */
const AUTH0_DOMAIN = "dev-2f0fmbtj6u8o7en4.us.auth0.com";
const AUTH0_CLIENT = "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU";

let auth0Client = null;

async function initAuth0(){
  // SDK لازم يكون محمّل من الـCDN في index.html
  if (typeof window.createAuth0Client !== 'function') {
    console.error('[Auth0] SDK غير محمّل (تأكدي من سكربت الـCDN في index.html)');
    return;
  }
  try {
    auth0Client = await createAuth0Client({
      domain: AUTH0_DOMAIN,
      clientId: AUTH0_CLIENT,
      cacheLocation: "localstorage",
      authorizationParams: { redirect_uri: window.location.origin }
    });

    // تنظيف العودة من Auth0 (إن وُجد code/state)
    if (/\b(code|state)=/.test(window.location.search)) {
      try {
        await auth0Client.handleRedirectCallback();
        history.replaceState({}, document.title, location.pathname + location.hash);
      } catch (e) {
        console.warn('[Auth0] redirect cleanup:', e);
      }
    }
    console.log('[Auth0] ready');
  } catch (err) {
    console.error('[Auth0] init error:', err);
  }
}

async function login(e){
  e?.preventDefault?.();
  if (!auth0Client) await initAuth0();
  await auth0Client?.loginWithRedirect({ authorizationParams: { screen_hint: 'login' } });
}

async function register(e){
  e?.preventDefault?.();
  if (!auth0Client) await initAuth0();
  await auth0Client?.loginWithRedirect({ authorizationParams: { screen_hint: 'signup' } });
}

async function logout(e){
  e?.preventDefault?.();
  if (!auth0Client) await initAuth0();
  await auth0Client?.logout({ logoutParams: { returnTo: window.location.origin } });
}

async function updateAuthUi(){
  const loginBtn    = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const logoutBtn   = document.getElementById('logout');
  try{
    const ok = await auth0Client?.isAuthenticated();
    if (loginBtn)    loginBtn.style.display    = ok ? 'none' : '';
    if (registerBtn) registerBtn.style.display = ok ? 'none' : '';
    if (logoutBtn)   logoutBtn.style.display   = ok ? ''     : 'none';
  }catch(_){
    if (loginBtn)    loginBtn.style.display    = '';
    if (registerBtn) registerBtn.style.display = '';
    if (logoutBtn)   logoutBtn.style.display   = 'none';
  }
}

/* ==============================
   Entry Point
   ============================== */
document.addEventListener('DOMContentLoaded', async () => {
  // الثيم
  bindThemeToggle();

  // تهيئة Auth0
  await initAuth0();

  // ربط الأزرار
  const loginBtn    = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const logoutBtn   = document.getElementById('logout');

  if (loginBtn)    loginBtn.addEventListener('click', login);
  if (registerBtn) registerBtn.addEventListener('click', register);
  if (logoutBtn)   logoutBtn.addEventListener('click', logout);

  // حالة الأزرار
  updateAuthUi();

  // في حال عندك دالة wire إضافية بملفات ثانية
  if (typeof window.wire === 'function') window.wire();
});
