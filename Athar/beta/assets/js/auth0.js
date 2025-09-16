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
