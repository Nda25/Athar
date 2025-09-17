/* =========================================
   athar — app.js (نسخة منقحة ونهائية)
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
  if (body.classList.contains('dark')) {
    body.classList.remove('dark');
    root.classList.add('dark');
  }
})();

/* ===== 1) تفعيل الوضع الداكن/الفاتح (🌓) مع حفظ في localStorage ===== */
(function initTheme(){
  var root  = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem('theme'); } catch(_) {}
  if (saved === 'dark') { root.classList.add('dark'); }
  else { root.classList.remove('dark'); }
})();


   
// يعتمد على CDN: https://cdn.auth0.com/js/auth0-spa-js/2.1/auth0-spa-js.production.js
// ويربط أحداث الدخول/التسجيل/الخروج + الاشتراك

const AUTH0_DOMAIN  = "dev-2f0fmbtj6u8o7en4.us.auth0.com";
const AUTH0_CLIENT  = "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU";

window.initAuth0 = async function initAuth0(){
  console.log('[Auth0] initAuth0: start');

  if (typeof window.createAuth0Client !== 'function') {
    console.error('[Auth0] SDK not loaded.');
    return;
  }

  // العميل
  window.auth0Client = await createAuth0Client({
    domain: AUTH0_DOMAIN,
    clientId: AUTH0_CLIENT,
    cacheLocation: "localstorage",
    authorizationParams: { redirect_uri: window.location.origin }
  });

  // معالجة redirect (أغلب الوقت لن تُستعمل مع popup)
  if (location.search.includes('code=') && location.search.includes('state=')) {
    try {
      const { appState } = await auth0Client.handleRedirectCallback();
      history.replaceState({}, document.title, appState?.returnTo || '/');
    } catch (e) {
      console.error('[Auth0] handleRedirectCallback error:', e);
    }
  }

  try { await auth0Client.checkSession(); } catch (e) {}

  // أزرار عامة في الهيدر
  const loginBtn    = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const logoutBtn   = document.getElementById('logout');

  if (loginBtn){
    loginBtn.type = 'button';
    loginBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await auth0Client.loginWithPopup({ authorizationParams: { screen_hint: 'login' } });
      try { await auth0Client.checkSession(); } catch (e) {}
      const u = await auth0Client.getUser();
      if (u && typeof window.supaEnsureUser === 'function') {
        await supaEnsureUser({ email: u.email, full_name: u.name || u.nickname || null });
      }
      location.reload();
    });
  }

  if (registerBtn){
    registerBtn.type = 'button';
    registerBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await auth0Client.loginWithPopup({ authorizationParams: { screen_hint: 'signup' } });
      try { await auth0Client.checkSession(); } catch (e) {}
      const u = await auth0Client.getUser();
      if (u && typeof window.supaEnsureUser === 'function') {
        await supaEnsureUser({ email: u.email, full_name: u.name || u.nickname || null });
      }
      location.reload();
    });
  }

  if (logoutBtn){
    logoutBtn.type = 'button';
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await auth0Client.logout({ logoutParams: { returnTo: window.location.origin } });
      } catch (err) {
        console.warn('[Auth0] logout error:', err);
        location.href = '/';
      }
    });
  }

  // شارة حالة الاشتراك في الصفحات اللي فيها العنصر
  (async () => {
    try {
      const u = await auth0Client.getUser();
      if (u && typeof window.supaEnsureUser === 'function') {
        await supaEnsureUser({
          email: u.email,
          full_name: u.name || u.nickname || null,
          role: 'user',
          subscription_type: (u['https://n-athar.co/app_metadata']?.plan) || null
        });
      }
      const meta   = u?.['https://n-athar.co/app_metadata'] || u?.app_metadata || {};
      const active = !!meta.sub_active;
      const badge  = document.getElementById('sub-state');
      if (badge){
        badge.style.display    = 'inline-block';
        badge.textContent      = active ? 'نشط' : 'غير مفعل';
        badge.style.background = active ? '#dcfce7' : '#fee2e2';
        badge.style.color      = active ? '#166534' : '#991b1b';
        badge.style.borderColor= active ? '#bbf7d0' : '#fecaca';
      }
    } catch (err) {
      console.error('[Auth0→Supabase] sync error:', err);
    }
  })();

  console.log('[Auth0] initAuth0: done');
};

// دوال إضافية متاحة عالميًا
window.isSubActiveAsync = async function(){
  try { await auth0Client.checkSession(); } catch (e) {}
  const u = await auth0Client.getUser();
  const meta = u?.['https://n-athar.co/app_metadata'] || u?.app_metadata || {};
  return !!meta.sub_active;
};

window.subscribe = async function(planKey){
  const authed = await auth0Client.isAuthenticated();
  if (!authed) {
    return auth0Client.loginWithRedirect({
      authorizationParams: { screen_hint:'signup', redirect_uri: location.origin + '/pricing.html' },
      appState: { returnTo: '/pricing.html' }
    });
  }
  try { await auth0Client.checkSession(); } catch (e) {}
  const u = await auth0Client.getUser();
  const meta = u?.['https://n-athar.co/app_metadata'] || u?.app_metadata || {};
  const subscribed = !!meta.sub_active;

  if (subscribed) return location.assign('/pricing.html');

  if (document.querySelector('#modal-coupon') && typeof window.openModal === 'function') {
    openModal('#modal-coupon');
  } else {
    location.assign('/pricing.html');
  }
};

window.logout = async function(e){
  e?.preventDefault?.();
  try { await auth0Client.logout({ logoutParams: { returnTo: window.location.origin } }); }
  catch(err){ console.warn('logout failed:', err); location.href = '/'; }
};

window.deleteAccount = async function(){
  if (!confirm('سيتم حذف حسابك نهائيًا. هل أنتِ متأكدة؟')) return;
  try {
    const token = await auth0Client.getTokenSilently();
    const res = await fetch('/.netlify/functions/delete-account', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(await res.text());
    toast('تم حذف الحساب نهائيًا');
  } catch (e) {
    console.error(e); toast('تعذّر حذف الحساب الآن.');
  } finally { await logout(); }
};

// ربط العناصر الخاصة بالصفحات
window.wire = function wire(){
  // نماذج تقليدية (إن وجدت)
  const regForm   = $('#register-form'); if (regForm)   regForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const promo = (regForm.promo?.value || "").trim().toUpperCase();
    if (promo) sessionStorage.setItem('pending_coupon', promo);
    await auth0Client.loginWithRedirect({
      authorizationParams: { screen_hint: 'signup', redirect_uri: window.location.origin + '/pricing.html' },
      appState: { returnTo: '/pricing.html', coupon: promo || null }
    });
  });

  const loginForm = $('#login-form'); if (loginForm) loginForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    await auth0Client.loginWithRedirect({
      authorizationParams: { screen_hint: 'login', redirect_uri: window.location.origin },
      appState: { returnTo: '/' }
    });
  });

  // أزرار اختيار الباقات
  $$('#choose-plan [data-plan]').forEach(btn=>{
    btn.addEventListener('click', ()=> window.subscribe(btn.getAttribute('data-plan')));
  });

  // زر نسيان كلمة المرور (إن وُجد)
  const forgotLink = document.getElementById('forgotPasswordLink');
  if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      const redirectUri = window.location.origin;
      window.location.href =
        `https://${AUTH0_DOMAIN}/u/reset-password?client_id=${AUTH0_CLIENT}&returnTo=${redirectUri}`;
    });
  }
};
/* ==== أوتو-حفظ لأي صفحة فورم (نسخة محسّنة) ==== */
// يجمع قيم input/textarea/select داخل عنصر معيّن
function readForm(container){
  const data = {};
  const root = (typeof container === 'string') ? document.querySelector(container) : container;
  if(!root) return data;

  root.querySelectorAll('input, textarea, select').forEach(el=>{
    const key = el.name || el.id;
    if(!key) return;

    if(el.tagName === 'SELECT'){
      data[key] = el.multiple ? Array.from(el.selectedOptions).map(o=>o.value) : el.value;
      return;
    }
    if(el.type === 'checkbox'){
      const group = root.querySelectorAll(`input[type="checkbox"][name="${el.name}"]`);
      if(group.length > 1){
        data[key] = Array.from(group).filter(i=>i.checked).map(i=>i.value || true);
      }else{
        data[key] = !!el.checked;
      }
      return;
    }
    if(el.type === 'radio'){
      if(el.checked) data[key] = el.value;
      else if(!(key in data)) data[key] = '';
      return;
    }
    if(el.type === 'number'){
      data[key] = (el.value === '' ? '' : +el.value);
      return;
    }
    data[key] = el.value;
  });

  return data;
}

// يملأ الحقول من كائن بيانات
function fillForm(container, data){
  const root = (typeof container === 'string') ? document.querySelector(container) : container;
  if(!root || !data) return;

  Object.entries(data).forEach(([k,v])=>{
    const els = root.querySelectorAll(`[name="${k}"], #${CSS.escape(k)}`);
    if(!els.length) return;

    els.forEach(el=>{
      if(el.tagName === 'SELECT'){
        if(el.multiple && Array.isArray(v)){
          Array.from(el.options).forEach(o=>o.selected = v.includes(o.value));
        }else{
          el.value = (v ?? '');
        }
        return;
      }
      if(el.type === 'checkbox'){
        const group = root.querySelectorAll(`input[type="checkbox"][name="${el.name}"]`);
        if(group.length > 1 && Array.isArray(v)){
          el.checked = v.includes(el.value || true);
        }else{
          el.checked = !!v;
        }
        return;
      }
      if(el.type === 'radio'){
        el.checked = (el.value == v);
        return;
      }
      el.value = (v == null ? '' : v);
    });
  });
}

// يربط الأوتو-حفظ بصفحة محددة
function bindAutoSave(pageKey, container){
  const root = (typeof container === 'string') ? document.querySelector(container) : container;
  if(!root) return;

  // استرجاع قديم
  fillForm(root, userDB.get(pageKey, {}));

  // حفظ عند التغيير (بـ debounce خفيف)
  let t=null;
  const save = ()=>{
    clearTimeout(t);
    t = setTimeout(()=> userDB.set(pageKey, readForm(root)), 250);
  };
  root.addEventListener('input', save);
  root.addEventListener('change', save);
}

/* ==== قاعدة بيانات محلية بسيطة للفورمات ==== */
function userKey(){ return 'athar:data'; } // مفتاح عام (بدون store.user)
const userDB = {
  getAll(){
    try{ return JSON.parse(localStorage.getItem(userKey())||'{}'); }
    catch(_){ return {}; }
  },
  setAll(obj){
    localStorage.setItem(userKey(), JSON.stringify(obj||{}));
  },
  get(page, fallback={}){ const all = this.getAll(); return all[page] ?? fallback; },
  set(page, data){ const all = this.getAll(); all[page] = data; this.setAll(all); },
  merge(page, partial){ const cur = this.get(page, {}); this.set(page, Object.assign({}, cur, partial)); },
  remove(page){ const all = this.getAll(); delete all[page]; this.setAll(all); },
  clearThisUser(){ this.setAll({}); }
};

/* ==== تحققات ==== */
function isValidEmail(x){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x); }
function isValidPhone(x){ return /^05\d{8}$/.test(x); }

/* ==== التسجيل ==== */
// استبدال كامل — لا تخزين محلي ولا شيت
async function handleRegister(e){
  e.preventDefault();
  const f = e.target;

  // حقل كوبون (اختياري)
  const promo = (f.promo?.value || "").trim().toUpperCase();
  if (promo) sessionStorage.setItem('pending_coupon', promo);

  // افتحي تسجيل Auth0 مباشرة
  await auth0Client.loginWithRedirect({
    authorizationParams: {
      screen_hint: 'signup',
      redirect_uri: window.location.origin + '/pricing.html'
    },
    appState: { returnTo: '/pricing.html', coupon: promo || null }
  });
}

/* ==== الدخول ==== */
// دخول عبر Auth0
async function handleLogin(e){
  e?.preventDefault?.();
  await auth0Client.loginWithRedirect({
    authorizationParams: { screen_hint: 'login', redirect_uri: window.location.origin },
appState: { returnTo: '/' }
  });
}

/* ==== الاشتراك (مؤقت بدون مزوّد دفع) ==== */
async function subscribe(planKey){
  // 1) لازم Auth0
  const authed = await auth0Client.isAuthenticated();
  if (!authed) {
    return auth0Client.loginWithRedirect({
      // قبل: location.origin + 'pricing.html'
authorizationParams: { screen_hint:'signup', redirect_uri: location.origin + '/pricing.html' },
appState: { returnTo: '/pricing.html' }
    });
  }

  // 2) نقرأ حالة الاشتراك من الكليم
  try { await auth0Client.checkSession(); } catch (e) {}
  const u = await auth0Client.getUser();
  const meta = u?.['https://n-athar.co/app_metadata'] || u?.app_metadata || {};
  const subscribed = !!meta.sub_active;

  if (subscribed) {
    // مستخدم مشترك: ودّيه لصفحة الحساب/الفواتير
    return location.assign('/pricing.html');
  }

  // 3) غير مشترك: وجّهيه للخطط/مودال الكوبون
  if (typeof openModal === 'function' && document.querySelector('#modal-coupon')) {
    openModal('#modal-coupon');
  } else {
    location.assign('/pricing.html');
  }
}

/* ==== ربط الأحداث (نسخة Auth0) ==== */
async function isSubActiveAsync(){
  try { await auth0Client.checkSession(); } catch (e) {}
  const u = await auth0Client.getUser();
  const meta = u?.['https://n-athar.co/app_metadata'] || u?.app_metadata || {};
  return !!meta.sub_active;
}

function wire(){
  // 1) نماذج تقليدية (إن وجدت)
  const regForm   = $('#register-form'); if (regForm)   regForm.addEventListener('submit', handleRegister);
  const loginForm = $('#login-form');    if (loginForm) loginForm.addEventListener('submit', handleLogin);

  // 2) أزرار اختيار الباقات
  $$('#choose-plan [data-plan]').forEach(btn=>{
    btn.addEventListener('click', ()=> subscribe(btn.getAttribute('data-plan')));
  });

  // 3) حذف الحساب (لو فيه دالة جاهزة)
  const del = $('#delete');
  if (del && typeof deleteAccount === 'function') {
    del.addEventListener('click', deleteAccount);
  }
}
   
/* ==== النوافذ ==== */
function openModal(id){ $(id).classList.add('show'); }
function closeModal(id){ $(id).classList.remove('show'); }
$$('.modal [data-close]').forEach(btn => btn.addEventListener('click', e=>{
  e.preventDefault();
  const m = btn.closest('.modal'); if(m) m.classList.remove('show');
}));

/* ==== حذف/خروج (نسخة Auth0) ==== */
function closeAnyOpenModal(){
  const open = document.querySelector('.modal.show');
  if (open) { open.classList.remove('show'); open.setAttribute('aria-hidden','true'); }
}
async function logout(e){
  e?.preventDefault?.();
  closeAnyOpenModal();
  try {
    await auth0Client.logout({ logoutParams: { returnTo: window.location.origin } });
  } catch (err) {
    console.warn('logout failed:', err);
    location.href = '/';
  }
}
async function deleteAccount(){
  if (!confirm('سيتم حذف حسابك نهائيًا. هل أنتِ متأكدة؟')) return;
  closeAnyOpenModal();
  try {
    const token = await auth0Client.getTokenSilently();
    const res = await fetch('/.netlify/functions/delete-account', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(await res.text());
    toast('تم حذف الحساب نهائيًا');
  } catch (e) {
    console.error(e);
    toast('تعذّر حذف الحساب الآن.');
  } finally {
    await logout();
  }
}

/* ==== توست ==== */
function toast(msg){
  let t = $('.toast');
  if(!t){ t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=> t.classList.remove('show'), 1800);
}

/* ===== زر الثيم (🌓) ===== */
function bindThemeToggle(){
  const root = document.documentElement;
  const btn  = document.getElementById('themeToggle');
  if (!btn) return;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const dark = root.classList.toggle('dark');
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch(_){}
    toast(dark ? 'تم تفعيل الوضع الداكن' : 'تم تفعيل الوضع الفاتح');
  });
}
// يحمّل Auth0 SDK لو كان غير موجود
// تحميل مكتبة Auth0 ديناميكيًا (مرة واحدة)
// --- تحميل سكربت خارجي مع Promise ---
function loadScript(url){
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.onload  = () => resolve(url);
    s.onerror = () => reject(new Error('failed: '+url));
    document.head.appendChild(s);
  });
}

// --- نضمن تحميل Auth0 SDK قبل initAuth0 ---
// --- نضمن تحميل Auth0 SDK قبل initAuth0 ---
async function ensureAuth0SDK(){
  if (typeof window.createAuth0Client === 'function') return 'already-present';

  const candidates = [
    // ⚡ الموثوق أولاً: مجلدات رئيسية على CDN Auth0 (توجد دائمًا)
    'https://cdn.auth0.com/js/auth0-spa-js/2/auth0-spa-js.production.js',
    'https://cdn.auth0.com/js/auth0-spa-js/2.1/auth0-spa-js.production.js',
    'https://cdn.auth0.com/js/auth0-spa-js/2.2/auth0-spa-js.production.js',

    // احتياطي من unpkg (بدون رقم patch محدد)
    'https://unpkg.com/@auth0/auth0-spa-js@2/dist/auth0-spa-js.production.js',
    'https://unpkg.com/@auth0/auth0-spa-js@2.1/dist/auth0-spa-js.production.js',
  ];

  let lastErr = null;
  for (const url of candidates){
    try{
      const used = await loadScript(url);
      if (typeof window.createAuth0Client === 'function'){
        console.log('[Auth0] SDK loaded from:', used);
        return used;
      }
    }catch(e){
      console.warn('[Auth0] failed url:', url, e);
      lastErr = e;
    }
  }
  throw lastErr || new Error('Auth0 SDK failed to load from all candidates');
}

// ===== تشغيل بعد تحميل الصفحة =====
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof bindThemeToggle === 'function') bindThemeToggle();
  if (typeof wire           === 'function')  wire();

  try{
    await ensureAuth0SDK();   // ← نضمن تحميل مكتبة Auth0
    await initAuth0();        // ← الآن نهيّء Auth0 (ويربط أزرار دخول/تسجيل)
  }catch(err){
    console.error('[Auth0] load/init error:', err);
  }
});
