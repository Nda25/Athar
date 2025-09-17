/* =========================================
   athar — app.js (نسخة موحّدة ونهائية)
   ========================================= */

/* أدوات صغيرة */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

/* ==============================
   Theme: init + toggle
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

/* توست ومودال (fallback بسيط) */
if (!window.toast) {
  window.toast = function(msg){
    let t = document.querySelector('.toast');
    if(!t){ t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(()=> t.classList.remove('show'), 1800);
  };
}
if (!window.openModal)  window.openModal  = (id)=>{ const n=$(id); if(n) n.classList.add('show'); };
if (!window.closeModal) window.closeModal = (id)=>{ const n=$(id); if(n) n.classList.remove('show'); };
$$('.modal [data-close]').forEach(btn => btn.addEventListener('click', e=>{
  e.preventDefault();
  const m = btn.closest('.modal'); if(m) m.classList.remove('show');
}));

/* ==============================
   Auth0 config
   ============================== */
const AUTH0_DOMAIN = "dev-2f0fmbtj6u8o7en4.us.auth0.com";
const AUTH0_CLIENT = "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU";

let auth0Client = null;
async function waitForAuth0SDK(max=50){
  for (let i=0; i<max && typeof window.createAuth0Client !== 'function'; i++) {
    await new Promise(r => setTimeout(r, 100)); // بحد أقصى ~5 ثواني
  }
  return (typeof window.createAuth0Client === 'function');
}

/* دوال UI لحالة الأزرار */
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
   Entry Point — كل التشغيل هنا
   ============================== */
document.addEventListener('DOMContentLoaded', async () => {
  // الثيم
  bindThemeToggle();

  // Auth0: كل التهيئة + ربط الأزرار هنا
  (async function initAuth0Inside(){
    const ready = await waitForAuth0SDK();
    if (!ready) { console.error("[Auth0] SDK still not loaded"); return; }

    try {
      auth0Client = await window.createAuth0Client({
        domain: AUTH0_DOMAIN,
        clientId: AUTH0_CLIENT,
        cacheLocation: "localstorage",
        authorizationParams: {
          redirect_uri: window.location.origin,
          scope: "openid profile email offline_access"
        }
      });

      // تنظيف العودة من redirect إن وُجد
      if (/[?&](code|state)=/.test(location.search)) {
        try {
          await auth0Client.handleRedirectCallback();
          history.replaceState({}, document.title, location.pathname + location.hash);
        } catch (e) {
          console.warn("[Auth0] redirect error:", e);
        }
      }

      // API مبسطة على window.auth
      const api = {
        login:  (opts)=> auth0Client.loginWithRedirect(opts||{}),
        logout: (opts)=> auth0Client.logout({ logoutParams:{ returnTo: window.location.origin }, ...(opts||{}) }),
        isAuthenticated: ()=> auth0Client.isAuthenticated(),
        getUser: ()=> auth0Client.getUser(),
        getToken: (opts)=> auth0Client.getTokenSilently(opts||{})
      };
      window.auth = window.auth || api;
      window.dispatchEvent(new CustomEvent("auth0:ready"));
      console.log("[Auth0] ready");

      // ربط الأزرار الآن
      const loginBtn    = document.getElementById('loginBtn');
      const registerBtn = document.getElementById('registerBtn');
      const logoutBtn   = document.getElementById('logout');

      if (loginBtn)    loginBtn.onclick    = (e)=>{ e.preventDefault(); window.auth.login({ authorizationParams:{ screen_hint:"login" } }); };
      if (registerBtn) registerBtn.onclick = (e)=>{ e.preventDefault(); window.auth.login({ authorizationParams:{ screen_hint:"signup" } }); };
      if (logoutBtn)   logoutBtn.onclick   = (e)=>{ e.preventDefault(); window.auth.logout(); };

      // حدّث واجهة الأزرار
      updateAuthUi();

    } catch (err) {
      console.error("[Auth0] init error:", err);
    }
  })();

  // إن كان عندك wire() بصفحات ثانية
  if (typeof window.wire === 'function') window.wire();
});
