/* =========================================
   athar — app.js (FINAL)
   Auth0 + Supabase + Coupons + Programs
   ========================================= */

/* ====== الإعدادات العامة ====== */
// TODO: حدّثي هذه حسب بيئتك
const AUTH0_DOMAIN   = "dev-2f0fmbtj6u8o7en4.us.auth0.com";        // Auth0
const AUTH0_CLIENTID = "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU";         // Auth0

const SUPABASE_URL   = "https://YOUR_SUPABASE_PROJECT.supabase.co"; // Supabase
const SUPABASE_ANON  = "YOUR_SUPABASE_ANON_KEY";                    // Supabase

// مسارات صفحاتك
const APP_URL    = "/athar.html";
const PRICING_URL= "/pricing.html";
const PLANS_URL  = "/plans";
const PAY_URL    = "/pay";

// برامجك الستة (مفاتيح + روابط)
const PROGRAMS = {
  mulhim:   "/programs/mulhim.html",
  murtakiz: "/programs/murtakiz.html",
  munطلق:  "/programs/munطلق.html", // لو الاسم حروف عربية بالمسار تأكدي من الترميز
  ithraa:   "/programs/ithraa.html",
  miaad:    "/programs/miaad.html",
  masar:    "/programs/masar.html",
};

// إعطاء صلاحية المالك يدوياً (اختياري)
const OWNER_EMAILS = [];              // مثل ["you@example.com"]
const OWNER_PHONES = ["0556795993"];  // مثال

/* ====== أدوات صغيرة ====== */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

/* ====== توست (UI) ====== */
function toast(msg){
  let t = $('.toast');
  if(!t){ t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=> t.classList.remove('show'), 1800);
}

/* ==============================
   ثيم: وضع داكن/فاتح
   ============================== */
(function unifyDarkClass(){
  const root = document.documentElement;
  const body = document.body;
  if (body.classList.contains('dark')) {
    body.classList.remove('dark');
    root.classList.add('dark');
  }
})();
(function initTheme(){
  const root  = document.documentElement;
  let saved = null;
  try { saved = localStorage.getItem('theme'); } catch(_) {}
  if (saved === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
})();
function bindThemeToggle(){
  const btn  = $('#themeToggle');
  if (!btn) return;
  btn.addEventListener('click', (e)=>{
    e.preventDefault();
    const root = document.documentElement;
    const dark = root.classList.toggle('dark');
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch(e){}
    toast(dark ? 'تم تفعيل الوضع الداكن' : 'تم تفعيل الوضع الفاتح');
  });
}

/* ==============================
   تحميل مكتبات خارجية
   ============================== */
function loadScript(src){
  return new Promise((resolve,reject)=>{
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
  });
}

/* ==============================
   Supabase: تهيئة + وظائف
   ============================== */
let supabase = null;
function initSupabase(){
  // تفادي إعادة الإنشاء
  if (supabase) return supabase;
  if (!window.supabase) { console.error("[Supabase] SDK not loaded"); return null; }
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  return supabase;
}

// حفظ/تحديث ملف العميل الأساسي في جدول profiles
// جدول مقترح: profiles (id [uuid], email [unique], name, phone, school, marketing_consent bool, created_at, updated_at)
async function upsertProfile({ email, name, phone, school, marketingConsent }){
  const sb = initSupabase(); if(!sb) return { ok:false, error:"Supabase not ready" };
  const payload = {
    email: (email||"").toLowerCase(),
    name:  name||"",
    phone: phone||"",
    school: school||"",
    marketing_consent: !!marketingConsent
  };
  const { data, error } = await sb.from('profiles').upsert(payload, { onConflict:'email' }).select().single();
  if (error){ console.error('[Supabase] upsertProfile:', error); return { ok:false, error }; }
  return { ok:true, data };
}

// لوج للأحداث - اختياري (جدول events: email, type, meta json, created_at)
async function logEvent({ email, type, meta }){
  const sb = initSupabase(); if(!sb) return;
  await sb.from('events').insert({ email:(email||"").toLowerCase(), type, meta: meta||{} });
}

/* ==============================
   Auth0: تهيئة + دخول/تسجيل/خروج + حالة
   ============================== */
let auth0Client = null;

async function initAuth0(){
  if (!window.createAuth0Client){ console.error('[Auth0] SDK not loaded.'); return; }

  auth0Client = await window.createAuth0Client({
    domain: AUTH0_DOMAIN,
    clientId: AUTH0_CLIENTID,
    cacheLocation: "localstorage",
    authorizationParams: { redirect_uri: window.location.origin }
  });

  // معالجة العودة
  if (location.search.includes('code=') && location.search.includes('state=')) {
    try {
      const { appState } = await auth0Client.handleRedirectCallback();
      const fromAppState = (appState && appState.coupon) ? String(appState.coupon).toUpperCase() : '';
      const fromSession  = (sessionStorage.getItem('pending_coupon') || '').toUpperCase();
      const coupon = fromAppState || fromSession;

      // نظافة رابط
      history.replaceState({}, document.title, appState?.returnTo || '/');

      // تفعيل الكوبون إن وُجد (سيرفرياً)
      if (coupon) {
        try {
          const r = await redeemCode(coupon);
          sessionStorage.removeItem('pending_coupon');
          if (r?.ok) location.assign(PAY_URL);
        } catch (e){ console.warn('redeem after callback failed:', e); }
      }
    } catch (e) {
      console.error('[Auth0] handleRedirectCallback error:', e);
    }
  }

  // جدد الجلسة لظهور الـ claims
  try { await auth0Client.checkSession(); } catch {}

  // ربط أزرار الدخول/التسجيل/الخروج
  const loginBtn    = $('#loginBtn');
  const registerBtn = $('#registerBtn');
  const logoutBtn   = $('#logout');

  if (loginBtn){
    loginBtn.type = 'button';
    loginBtn.addEventListener('click', async (e)=>{
      e.preventDefault();
      await auth0Client.loginWithRedirect({
        authorizationParams: { screen_hint:'login', redirect_uri: window.location.origin + PLANS_URL },
        appState: { returnTo: PLANS_URL }
      });
    });
  }
  if (registerBtn){
    registerBtn.type = 'button';
    registerBtn.addEventListener('click', async (e)=>{
      e.preventDefault();
      await auth0Client.loginWithRedirect({
        authorizationParams: { screen_hint:'signup', redirect_uri: window.location.origin + PLANS_URL },
        appState: { returnTo: PLANS_URL }
      });
    });
  }
  if (logoutBtn){
    logoutBtn.type = 'button';
    logoutBtn.addEventListener('click', async (e)=>{
      e.preventDefault();
      try {
        await auth0Client.logout({ logoutParams: { returnTo: window.location.origin } });
      } catch (err) {
        console.warn('[Auth0] logout error:', err);
        location.href = '/';
      }
    });
  }

  // بعد ما يتوثّق المستخدم: احفظي بروفايله في Supabase
  const isAuth = await auth0Client.isAuthenticated();
  if (isAuth) {
    const u = await auth0Client.getUser();
    // event: login
    try { await upsertProfile({
      email: u?.email, name: u?.name, phone: u?.phone_number, school: u?.school, marketingConsent: false
    }); } catch(_){}
    try { await logEvent({ email: u?.email, type: 'login', meta: { ua: navigator.userAgent } }); } catch(_){}
  }

  // حدّثي شارة الاشتراك
  updateSubBadge();
}

async function updateSubBadge(){
  try {
    const u = await auth0Client.getUser();
    const meta = u?.['https://athar.app/app_metadata'] || u?.app_metadata || {};
    const isOwner = isOwnerByIdentity(u);
    const active  = isOwner || !!meta.sub_active;

    const badge = $('#sub-state');
    if (badge){
      badge.style.display='inline-block';
      badge.textContent = active ? 'نشط' : 'غير مفعل';
      badge.style.background = active ? '#dcfce7' : '#fee2e2';
      badge.style.color      = active ? '#166534' : '#991b1b';
      badge.style.borderColor= active ? '#bbf7d0' : '#fecaca';
    }
  } catch(_){}
}

function isOwnerByIdentity(u){
  const email = (u?.email||"").toLowerCase();
  const phone = (u?.phone_number||"").trim();
  if (email && OWNER_EMAILS.map(e=>e.toLowerCase()).includes(email)) return true;
  if (phone && OWNER_PHONES.includes(phone)) return true;
  return false;
}

/* ==============================
   الاسترداد (كوبون) — عبر دالة خادمية
   ============================== */
// Netlify Function: /.netlify/functions/redeem
// تقوم بالتالي: تتحقق من الكوبون وتحدّث app_metadata.sub_active=true للمستخدم في Auth0.
// ومن جهتك هنا فقط تستدعينها بـ JWT من Auth0.
async function redeemCode(codeRaw){
  const code = (codeRaw||'').trim().toUpperCase();
  if(!code) return { ok:false, msg:'اكتبي الكوبون' };

  const authed = await auth0Client.isAuthenticated();
  if(!authed){
    await auth0Client.loginWithRedirect({
      authorizationParams:{ screen_hint:'signup', redirect_uri: location.href },
      appState:{ returnTo: location.pathname, coupon: code }
    });
    return { ok:false, msg:'تم توجيهك للتسجيل' };
  }
  const token = await auth0Client.getTokenSilently();
  const res = await fetch('/.netlify/functions/redeem',{
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${token}` },
    body: JSON.stringify({ code })
  });
  const j = await res.json().catch(()=> ({}));
  if(!res.ok || !j.ok) return { ok:false, msg: j.error || 'فشل التفعيل' };

  try { await auth0Client.checkSession(); } catch {}
  toast('تم تفعيل الكود ✅');
  updateSubBadge();
  return { ok:true, msg:'تم التفعيل' };
}

/* ==============================
   واجهة: تسجيل/دخول/اشتراك/برامج
   ============================== */

// نموذج التسجيل (يحفظ كوبون مؤقتًا ويرسل للتسجيل)
async function handleRegister(e){
  e.preventDefault();
  const f = e.target;
  const name    = (f.name?.value   || "").trim();
  const email   = (f.email?.value  || "").trim();
  const phone   = (f.phone?.value  || "").trim();
  const school  = (f.school?.value || "").trim();
  const coupon  = (f.promo?.value  || "").trim().toUpperCase();
  const consent = !!f.consent?.checked;

  // حفظ أولي للبروفايل في Supabase حتى قبل Auth0 (اختياري)
  if (email) { try { await upsertProfile({ email, name, phone, school, marketingConsent: consent }); } catch(_){} }

  if (coupon) sessionStorage.setItem('pending_coupon', coupon);

  await auth0Client.loginWithRedirect({
    authorizationParams: { screen_hint: 'signup', redirect_uri: window.location.origin + PAY_URL },
    appState: { returnTo: PAY_URL, coupon: coupon || null }
  });
}

// دخول بسيط
async function handleLogin(e){
  e?.preventDefault?.();
  await auth0Client.loginWithRedirect({
    authorizationParams: { screen_hint: 'login', redirect_uri: window.location.origin + PLANS_URL },
    appState: { returnTo: PLANS_URL }
  });
}

// زر اشتراك: لو غير مشترك → مودال كوبون/الخطط؛ لو مشترك → صفحة الدفع/الحساب
async function subscribe(planKey){
  const authed = await auth0Client.isAuthenticated();
  if (!authed) {
    return auth0Client.loginWithRedirect({
      authorizationParams: { screen_hint:'signup', redirect_uri: location.origin + PAY_URL },
      appState: { returnTo: PAY_URL }
    });
  }

  try { await auth0Client.checkSession(); } catch {}
  const u = await auth0Client.getUser();
  const meta = u?.['https://athar.app/app_metadata'] || u?.app_metadata || {};
  const isOwner = isOwnerByIdentity(u);
  const subscribed = isOwner || !!meta.sub_active;

  if (subscribed) return location.assign(PAY_URL);

  if (typeof openModal === 'function' && $('#modal-coupon')) {
    openModal('#modal-coupon');
  } else {
    location.assign(PLANS_URL);
  }
}

// حماية برامجك الستة (تُنادى قبل فتح صفحة/زر البرنامج)
async function requireAccessOrRedirect(programKey){
  const authed = await auth0Client.isAuthenticated();
  if (!authed){
    await auth0Client.loginWithRedirect({
      authorizationParams:{ screen_hint:'login', redirect_uri: location.origin + PLANS_URL },
      appState:{ returnTo: PLANS_URL }
    });
    return false;
  }
  try { await auth0Client.checkSession(); } catch {}

  const u = await auth0Client.getUser();
  const meta = u?.['https://athar.app/app_metadata'] || u?.app_metadata || {};
  const isOwner = isOwnerByIdentity(u);
  const active  = isOwner || !!meta.sub_active;
  if (!active){
    // غير مشترك: وجّهيه للخطط أو افتحي مودال كوبون
    if ($('#modal-coupon')) openModal('#modal-coupon'); else location.assign(PLANS_URL);
    return false;
  }
  // عنده وصول:
  return true;
}

// ربط أزرار البرامج (قابلة للتوسّع)
function bindProgramLinks(){
  Object.entries(PROGRAMS).forEach(([key, url])=>{
    const btn = document.querySelector(`[data-program="${key}"]`);
    if (!btn) return;
    btn.addEventListener('click', async (e)=>{
      e.preventDefault();
      if (await requireAccessOrRedirect(key)) location.assign(url);
    });
  });
}

/* ==============================
   مودالات
   ============================== */
function openModal(id){ $(id)?.classList.add('show'); }
function closeModal(id){ $(id)?.classList.remove('show'); }
function bindModals(){
  $$('.modal [data-close]').forEach(btn => btn.addEventListener('click', e=>{
    e.preventDefault();
    btn.closest('.modal')?.classList.remove('show');
  }));
}

/* ==============================
   نسيان كلمة المرور (Auth0)
   ============================== */
function bindForgotPassword(){
  const forgotLink = $('#forgotPasswordLink');
  if (!forgotLink) return;
  forgotLink.addEventListener('click', (e)=>{
    e.preventDefault();
    const redirectUri = window.location.origin;
    window.location.href =
      `https://${AUTH0_DOMAIN}/u/reset-password?client_id=${AUTH0_CLIENTID}&returnTo=${redirectUri}`;
  });
}

/* ==============================
   بعد تحميل الصفحة
   ============================== */
document.addEventListener('DOMContentLoaded', async ()=>{
  // اربطي UI
  bindThemeToggle();
  bindModals();
  bindProgramLinks();

  // اربطي نماذج الدخول/التسجيل
  $('#register-form')?.addEventListener('submit', handleRegister);
  $('#login-form')?.addEventListener('submit', handleLogin);

  // زر “نسيت كلمة المرور”
  bindForgotPassword();

  // حمّلي مكتبات Supabase + Auth0 ثم ابدئي
  try {
    if (!window.supabase) await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js");
  } catch { console.error("[Supabase] failed to load"); }

  try {
    if (!window.createAuth0Client) await loadScript("https://cdn.auth0.com/js/auth0-spa-js/2.1/auth0-spa-js.production.js");
  } catch { toast('تعذّر تحميل نظام الدخول، حاولي لاحقًا.'); }

  // فعّلي Supabase و Auth0
  initSupabase();
  await initAuth0();
});
