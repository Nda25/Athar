/* ====== Athar Hard Reset (once) ====== */
(function hardResetOnce(){
  try {
    const FLAG = "ATHAR_V2_READY";   // اسم علامة الإصدار الجديد
    if (!localStorage.getItem(FLAG)) {
      // امسحي كل التخزين المحلي والـ session
      localStorage.clear();
      sessionStorage.clear();

      // حاولي حذف قواعد IndexedDB (لو المتصفح يدعم)
      if ('indexedDB' in window && indexedDB.databases) {
        indexedDB.databases().then(dbs => {
          dbs.forEach(db => { if (db && db.name) indexedDB.deleteDatabase(db.name); });
        });
      }

      // ثبّتي العلامة حتى ما يتكرر المسح كل مرة
      localStorage.setItem(FLAG, "1");
      console.log("[Athar] One-time storage reset done.");
    }
  } catch (_) {}
})();

/* إعدادات Auth0 (احتياط لو احتجتها سكربتات ثانية) */
if (typeof window.AUTH0_DOMAIN === 'undefined') {
  window.AUTH0_DOMAIN = "dev-2f0fmbtj6u8o7en4.us.auth0.com";
}
if (typeof window.AUTH0_CLIENT === 'undefined') {
  window.AUTH0_CLIENT = "rXaNXLwIkIOALVTWبRDA8SwJnERnI1NU";
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

/* ============================== Supabase Sync ============================== */
/* يحفظ/يحدّث المستخدم في Supabase اعتماداً على بيانات Auth0 */
async function supaEnsureUserFromAuth0() {
  try {
    const u = await window.auth?.getUser();
    if (!u || !u.email) return;
    // استخدمي الدالة المعرّفة في assets/js/supabase-client.js
    if (typeof window.supaEnsureUserProfile === 'function') {
      await window.supaEnsureUserProfile({
        sub: u.sub,
        email: String(u.email).toLowerCase(),
        name: u.name || u.nickname || null,
        picture: u.picture || null
      });
    }
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

  /* تحديث حالة الأزرار عند جاهزية Auth0 (مرّة واحدة) */
  window.addEventListener('auth0:ready', async () => {
    try {
      const ok = await window.auth.isAuthenticated();
      setButtons(ok); // تُظهر/تُخفي login/register/logout + #nav-profile
    } catch {
      setButtons(false);
    }
  }, { once: true });

  /* بعد جاهزية Auth0: احفظ المستخدم وسجّل مشاهدة الصفحة */
  window.addEventListener('auth0:ready', async () => {
    await supaEnsureUserFromAuth0();

    // اسم الملف الحالي (مثلاً: /miyad.html → "miyad")
    const file = (location.pathname.split('/').pop() || '').toLowerCase();
    const base = file.replace('.html', '');

    // خرائط أسماء مألوفة (لو تبين اسم أداة مختلف عن اسم الملف)
    const aliases = {
      athar: 'muntalaq',  // مُنطلق
      darsi: 'murtakaz',  // مُرتكز
      // البقية نفس اسم الملف: miyad, masar, ethraa, mulham
    };

    const tool = aliases[base] || base;
    if (tool && typeof window.supaLogToolUsage === 'function') {
      window.supaLogToolUsage(`${tool}:view`);
    }
  });

  /* ✅ إظهار زر لوحة التحكم إن كان الدور Admin (بدون لمس الأدوار نفسها) */
  window.addEventListener('auth0:ready', async () => {
    try {
      const claims = await window.auth.getIdTokenClaims();

      // نفس الـ namespace المستخدم في Action
      const NS  = "https://n-athar.co/";
      // احتياطي لو بقايا توكن قديم
      const ALT = "https://athar.co/";

      console.log('[admin] claims:', claims);
      console.log('[admin] roles:', claims?.[NS+"roles"] || claims?.[ALT+"roles"]);
      console.log('[admin] admin flag:', claims?.[NS+"admin"] ?? claims?.[ALT+"admin"]);

      const roles   = claims?.[NS+"roles"] || claims?.[ALT+"roles"] || [];
      const isAdmin = roles.includes("admin") || (claims?.[NS+"admin"] === true) || (claims?.[ALT+"admin"] === true);

      const adminBtn = document.getElementById("adminBtn");
      if (adminBtn) adminBtn.style.display = isAdmin ? "inline-flex" : "none";
    } catch (err) { 
      console.error("Error checking admin role:", err); 
    }
  });

  /* باك-أب: لو الحدث فاتنا وكان window.auth جاهز، حدّثي الآن */
  if (window.auth) {
    try {
      const ok = await window.auth.isAuthenticated();
      setButtons(ok);
    } catch {
      setButtons(false);
    }
  }
});
