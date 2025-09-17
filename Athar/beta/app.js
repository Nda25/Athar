/* =========================================
   athar — app.js (نسخة خفيفة بعد إزالة التخزين)
   ========================================= */

/* أدوات صغيرة */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

/* ==============================
   Theme: init + toggle (موحّد)
   ============================== */

// 0) توحيد مكان كلاس dark (لا يكون على <body>)
(function unifyDarkClass(){
  var root = document.documentElement;
  var body = document.body;
  if (body && body.classList.contains('dark')) {
    body.classList.remove('dark');
    root.classList.add('dark');
  }
})();

/* 1) تفعيل الوضع الداكن/الفاتح (🌓) مع حفظ في localStorage */
(function initTheme(){
  var root  = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem('theme'); } catch(_) {}
  if (saved === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
})();

/* ===== زر الثيم (🌓) ===== */
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

/* ==== توست (إن ما كان معرّف من ui.js) ==== */
if (!window.toast) {
  window.toast = function(msg){
    let t = document.querySelector('.toast');
    if(!t){ t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(()=> t.classList.remove('show'), 1800);
  };
}

/* ==== مودالات (إن ما كانت معرّفة في ui.js) ==== */
if (!window.openModal)  window.openModal  = (id)=>{ const n=$(id); if(n) n.classList.add('show'); };
if (!window.closeModal) window.closeModal = (id)=>{ const n=$(id); if(n) n.classList.remove('show'); };
$$('.modal [data-close]').forEach(btn => btn.addEventListener('click', e=>{
  e.preventDefault();
  const m = btn.closest('.modal'); if(m) m.classList.remove('show');
}));

/* ==============================
   تشغيل بعد تحميل الصفحة + ربط أزرار Auth0
   ============================== */
document.addEventListener('DOMContentLoaded', () => {
  // الثيم
  bindThemeToggle();

  // أزرار Auth0
  const loginBtn    = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const logoutBtn   = document.getElementById('logout');

  function wireClicks(){
    if (loginBtn)    loginBtn.onclick    = (e)=>{ e.preventDefault(); window.auth?.login({ authorizationParams:{ screen_hint:'login'  } }); };
    if (registerBtn) registerBtn.onclick = (e)=>{ e.preventDefault(); window.auth?.login({ authorizationParams:{ screen_hint:'signup' } }); };
    if (logoutBtn)   logoutBtn.onclick   = async (e)=>{ e.preventDefault(); await window.auth?.logout(); };
  }

  async function updateAuthUi(){
    try{
      const ok = await window.auth.isAuthenticated();
      if (loginBtn)    loginBtn.style.display    = ok ? 'none' : '';
      if (registerBtn) registerBtn.style.display = ok ? 'none' : '';
      if (logoutBtn)   logoutBtn.style.display   = ok ? ''     : 'none';
    }catch(_){
      if (loginBtn)    loginBtn.style.display    = '';
      if (registerBtn) registerBtn.style.display = '';
      if (logoutBtn)   logoutBtn.style.display   = 'none';
    }
  }

  function onReady(){ wireClicks(); updateAuthUi(); }

  // اربطي بعد جاهزية Auth0 (يرسله assets/js/auth0.js)
  if (window.auth0ClientPromise) {
    window.addEventListener('auth0:ready', onReady, { once:true });
  } else {
    onReady();
  }

  // إن كان فيه wire() مُعرّفة بملف آخر، شغّلها
  if (typeof window.wire === 'function') window.wire();
});
