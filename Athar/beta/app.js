 /* =========================================
   athar — app.js (نسخة منقحة ونهائية)
   ========================================= */
/* ==== إعدادات عامة ==== */
const SHEET_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbyzjAlY2ilPYkxKGBdo2EsOLQZd1Zq7awfX3nc7bxIWWsQy3qlh8a8XyZFRMwrQ5cCyMg/exec";
const SHEET_API_KEY    = "NADA-ATHAR-2025!"; // نفس المفتاح في GAS

const ATHAR_APP_URL = "athar.html";
const PRICING_URL   = "pricing.html";

/* وصول المالك (اختياري) */
const OWNER_EMAILS = [];                 // لو حابة
const OWNER_PHONES = ["0556795993"];     // لازم نص "05..."
const OWNER_KEY    = "OWNER1201";        // كود يمنح وضع المالك

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


/* ==== Auth0 Integration ==== */
async function initAuth0(){
  // 1) تأكد أن مكتبة Auth0 محمّلة
  if (typeof window.createAuth0Client !== 'function') {
    console.warn('Auth0 SDK not loaded');
    return;
  }

  // 2) إنشاء عميل Auth0
  const auth0Client = await createAuth0Client({
    domain: "dev-2f0fmbtj6u8o7en4.us.auth0.com",
    client_id: "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU",
    cacheLocation: "localstorage"
  });

  // 3) معالجة الرجوع من Auth0 (إن وُجد)
  if (window.location.search.includes("code=") && window.location.search.includes("state=")) {
    try {
      await auth0Client.handleRedirectCallback();
    } catch (err) {
      console.error("Auth0 redirect error:", err);
    }
    // تنظيف الاستعلام من الرابط
    window.history.replaceState({}, document.title, location.origin + location.pathname);
  }

  // 4) ربط الأزرار
  const loginBtn  = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (loginBtn){
    loginBtn.addEventListener("click", async () => {
      try {
        await auth0Client.loginWithRedirect({
          authorizationParams: { redirect_uri: window.location.origin }
        });
      } catch (err) {
        console.error("Auth0 login error:", err);
      }
    });
  }

  if (logoutBtn){
    logoutBtn.addEventListener("click", async () => {
      try {
        // نزّل الحالة المحلية أولاً
        store.auth = false;
        store.user = null;
        refreshNav();
      } catch (_) {}
      // ثم خروج Auth0
      try {
        await auth0Client.logout({
          logoutParams: { returnTo: window.location.origin }
        });
      } catch (err) {
        console.error("Auth0 logout error:", err);
      }
    });
  }

  // 5) تحديث الحالة المحلية حسب مصادقة Auth0
  let isAuth = false;
  try {
    isAuth = await auth0Client.isAuthenticated();
  } catch (err) {
    console.error("Auth0 isAuthenticated error:", err);
  }

  if (isAuth){
    try {
      const user = await auth0Client.getUser();
      store.user = {
        name:   user?.name || "",
        email:  user?.email || "",
        phone:  user?.phone_number || "",
        school: user?.school || ""
      };
     // داخل initAuth0() بعد:
store.user = {
  name: user.name || "",
  email: user.email || "",
  phone: user.phone_number || "",
  school: user.school || ""
};
store.auth = true;

// >>> أضيفي هذا السطر:
supaEnsureUser({ email: store.user.email, full_name: store.user.name || "", role: "user" });

refreshNav();
      store.auth = true;
    } catch (err) {
      console.error("Auth0 getUser error:", err);
      store.auth = false;
      store.user = null;
    }
  } else {
    // غير مصدّق
    store.auth = false;
    // لا نلمس بيانات user لو عندك استخدامات أخرى، لكن الأفضل نوحّدها
    if (!store.user) store.user = null;
  }

  // 6) حدثي الواجهة
  refreshNav();
}

/* ===== 1) تفعيل الوضع الداكن/الفاتح (🌓 ثابت) مع حفظ في localStorage ===== */
(function initTheme(){
  var root  = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem('theme'); } catch(_) {}
  if (saved === 'dark') { root.classList.add('dark'); }
  else { root.classList.remove('dark'); }

  document.addEventListener('DOMContentLoaded', function(){
    var btn = document.getElementById('themeToggle');
    if(!btn) return;
    btn.addEventListener('click', function(e){
      e.preventDefault();
      var dark = root.classList.toggle('dark');
      try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch(_) {}
      var t = document.getElementById('toast');
      if(t){
        t.textContent = dark ? 'تم تفعيل الوضع الداكن' : 'تم تفعيل الوضع الفاتح';
        t.classList.add('show'); setTimeout(function(){ t.classList.remove('show'); }, 1200);
      }
    });
  });
})();


/* ==== التخزين المحلي ==== */
const store = {
  get user(){ try{ return JSON.parse(localStorage.getItem('athar:user')||'null'); }catch{return null} },
  set user(u){ localStorage.setItem('athar:user', JSON.stringify(u)); },
  get sub(){ try{ return JSON.parse(localStorage.getItem('athar:sub')||'null'); }catch{return null} },
  set sub(s){ localStorage.setItem('athar:sub', JSON.stringify(s)); },
  get trial(){ try{ return JSON.parse(localStorage.getItem('athar:trial')||'null'); }catch{return null} },
  set trial(t){ localStorage.setItem('athar:trial', JSON.stringify(t)); },
  get auth(){ return localStorage.getItem('athar:auth') === '1'; },
  set auth(v){ localStorage.setItem('athar:auth', v ? '1' : '0'); },
  get owner(){ return localStorage.getItem('athar:owner') === '1'; },
  set owner(v){ localStorage.setItem('athar:owner', v ? '1' : '0'); },
  get codesUsers(){ try{ return JSON.parse(localStorage.getItem('athar:codes-users')||'{}'); }catch{return {}; } },
  set codesUsers(obj){ localStorage.setItem('athar:codes-users', JSON.stringify(obj)); },
  clear(){
    localStorage.removeItem('athar:user');
    localStorage.removeItem('athar:sub');
    localStorage.removeItem('athar:trial');
    localStorage.removeItem('athar:auth');
    localStorage.removeItem('athar:owner');
  }
};
/* ==== قاعدة بيانات محلية لكل مستخدم (localStorage) ==== */
// مفتاح تخزين خاص بكل مستخدم (بناءً على الإيميل أو guest)
function userKey(){
  const u = store.user;
  const email = (u && u.email) ? u.email.trim().toLowerCase() : 'guest';
  return `athar:data:${email}`;
}

const userDB = {
  getAll(){
    try{ return JSON.parse(localStorage.getItem(userKey())||'{}'); }
    catch(_){ return {}; }
  },
  setAll(obj){
    localStorage.setItem(userKey(), JSON.stringify(obj||{}));
  },
  get(page, fallback={}){
    const all = this.getAll();
    return all[page] ?? fallback;
  },
  set(page, data){
    const all = this.getAll();
    all[page] = data;
    this.setAll(all);
  },
  merge(page, partial){
    const cur = this.get(page, {});
    this.set(page, Object.assign({}, cur, partial));
  },
  remove(page){
    const all = this.getAll();
    delete all[page];
    this.setAll(all);
  },
  clearThisUser(){
    this.setAll({});
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

/* ==== تحديث الشريط حسب حالة الدخول (عام) ==== */
function refreshNav(){
  const logged      = store.auth && !!store.user;
  const authSpan    = document.getElementById('nav-auth');
  const profileBtn  = document.getElementById('nav-profile');
  const programsBtn = document.getElementById('nav-programs');
  const atharBtn    = document.getElementById('nav-athar');

  if (authSpan)    authSpan.style.display    = logged ? 'none'        : 'inline-flex';
  if (profileBtn)  profileBtn.style.display  = logged ? 'inline-flex' : 'none';
  if (programsBtn) programsBtn.style.display = logged ? 'inline-flex' : 'none';
  if (atharBtn)    atharBtn.style.display    = logged ? 'inline-flex' : 'none';

  if (logged){
    $$('.js-user-name').forEach(s=>{
      s.textContent = store.user?.name || store.user?.email || store.user?.phone || 'مستخدم';
    });
  }
}
/* ==== تهيئة الشريط ==== */
(function navbarState(){
  refreshNav(); // استدعاء واحد بدل التكرار
})();

/* ==== النوافذ ==== */
function openModal(id){ $(id).classList.add('show'); }
function closeModal(id){ $(id).classList.remove('show'); }
$$('.modal [data-close]').forEach(btn => btn.addEventListener('click', e=>{
  e.preventDefault();
  const m = btn.closest('.modal'); if(m) m.classList.remove('show');
}));

/* ==== تحققات ==== */
function isValidEmail(x){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x); }
function isValidPhone(x){ return /^05\d{8}$/.test(x); }

/* ==== أكواد التجربة (اختياري) ==== */
const CODES = {
  "IBNROSHD": { maxUsers: 100, perUserGenerations: 10, expiresAt: "2026-01-31T23:59:59+03:00" },
  "TNS":      { maxUsers: 100, perUserGenerations: 20, expiresAt: "2026-01-31T23:59:59+03:00" },

  // === كود فاميلي (15 مستخدم، توليد مفتوح) ===
  "FAMILY":   { maxUsers: 15, perUserGenerations: Infinity, expiresAt: "2026-12-31T23:59:59+03:00" },

  // === كود دندونه (مستخدم واحد فقط، 5 توليدات) ===
  "دندونه":   { maxUsers: 1,   perUserGenerations: 5,  expiresAt: "2026-12-31T23:59:59+03:00" },
  "DANDONAH": { maxUsers: 1,   perUserGenerations: 5,  expiresAt: "2026-12-31T23:59:59+03:00" }
};
const PLAN_NAMES = { weekly:"أسبوعي", monthly:"شهري", semi:"نصف سنوي", annual:"سنوي" };

/* ==== الصلاحيات ==== */
function isOwner(){
  const u = store.user;
  if(!u) return false;
  if(OWNER_EMAILS.includes(u.email)) return true;
  if(OWNER_PHONES.includes(u.phone)) return true;
  return store.owner;
}
function isSubActive(){
  const s = store.sub; if(!s) return false;
  try{ return new Date() <= new Date(s.endsAt); }catch(_){ return false; }
}
function isTrialActive(){
  const t = store.trial; if(!t) return false;
  try{
    const notExpired = new Date() <= new Date(t.expiresAt);
    return notExpired && (t.remaining||0) > 0;
  }catch(_){ return false; }
}
function hasAccess(){ return store.auth && (isOwner() || isSubActive() || isTrialActive()); }

/* ==== إرسال صف إلى Google Sheets ==== */
/* ترتيب الحقول: [تاريخ السجل, الاسم, البريد, الجوال, المدرسة, الكود, الخطة, بداية الاشتراك, نهاية الاشتراك, المبلغ, أوافق على الرسائل] */
async function sendRowToSheet(payload){
  try{
    const res = await fetch(SHEET_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: SHEET_API_KEY,
        date:      payload.date      || new Date().toISOString(),
        name:      payload.name      || '',
        email:     payload.email     || '',
        phone:     payload.phone     || '',
        school:    payload.school    || '',
        promo:     payload.promo     || '',
        plan:      payload.plan      || '',
        startsAt:  payload.startsAt  || '',
        endsAt:    payload.endsAt    || '',
        totalPaid: payload.totalPaid || 0,
        consent:   !!payload.consent
      })
    });

    let json = {};
    try { json = await res.json(); } catch(_){}
    console.log('Sheet response:', json);
    if (!json.ok) {
      console.error('Sheet API error:', json);
      if (typeof toast === 'function') toast('تعذّر الحفظ في الشيت.');
    }
  }catch(err){
    console.error('Sheet API fetch error:', err);
    if (typeof toast === 'function') toast('تعذّر الاتصال بالشيت.');
  }
}

/* ==== تفعيل كود تجربة ==== */
function redeemCode(codeRaw){
  const code = (codeRaw||"").trim().toUpperCase();
  if(!code) return { ok:false, msg:"أدخلي الكود." };
  if(OWNER_KEY && code === OWNER_KEY){ store.owner = true; return { ok:true, owner:true, msg:"تم منحك صلاحيات المالك." }; }

  const cfg = CODES[code];
  if(!cfg) return { ok:false, msg:"الكود غير معروف." };
  if(new Date() > new Date(cfg.expiresAt)) return { ok:false, msg:"انتهت صلاحية هذا الكود." };

  const usage = store.codesUsers;
  const usedList = Array.isArray(usage[code]) ? usage[code] : [];
  const email = store.user?.email || "";
  if(!email) return { ok:false, msg:"يجب إنشاء الحساب أولاً." };
  if(!usedList.includes(email) && usedList.length >= cfg.maxUsers){
    return { ok:false, msg:"اكتمل عدد المستفيدين من هذا الكود." };
  }

  const cur = store.trial;
  if(cur && cur.code === code && isTrialActive()){
    return { ok:true, msg:"الكود مفعّل لديك مسبقًا." };
  }

  store.trial = {
    code,
    remaining: cfg.perUserGenerations,
    activatedAt: new Date().toISOString(),
    expiresAt: cfg.expiresAt
  };

  if(!usedList.includes(email)) usedList.push(email);
  usage[code] = usedList;
  store.codesUsers = usage;

  // سجل الحدث
  sendRowToSheet({
    date: new Date().toISOString(),
    name: store.user?.name || '',
    email: email,
    phone: store.user?.phone || '',
    school: store.user?.school || '',
    promo: code,
    plan: 'trial_redeem',
    startsAt: '',
    endsAt: '',
    totalPaid: 0,
    consent: store.user?.marketingConsent ? true : false
  });

  return { ok:true, msg:"تم تفعيل الكود بنجاح." };
}

/* استهلاك توليدة */
function consumeGeneration(n=1){
  const t = store.trial;
  if(!t){ toast('لا توجد تجربة مفعّلة.'); return; }
  if(!isTrialActive()){ toast('انتهت صلاحية التجربة.'); return; }
  t.remaining = Math.max(0, (t.remaining||0) - n);
  store.trial = t;
  toast(`تم استخدام ${n} توليدة. المتبقّي: ${t.remaining}`);

  const leftEl = $('#t-left'); if(leftEl) leftEl.textContent = t.remaining;

  sendRowToSheet({
    date: new Date().toISOString(),
    name: store.user?.name || '',
    email: store.user?.email || '',
    phone: store.user?.phone || '',
    school: store.user?.school || '',
    promo: t.code,
    plan: 'trial_consume',
    startsAt: '',
    endsAt: '',
    totalPaid: n,
    consent: store.user?.marketingConsent ? true : false
  });
}

/* ==== التسجيل ==== */
function handleRegister(e){
  e.preventDefault();
  const f = e.target;
  const name    = (f.name?.value   || "").trim();
  const email   = (f.email?.value  || "").trim();
  const phone   = (f.phone?.value  || "").trim();
  const school  = (f.school?.value || "").trim();
  const pass    = (f.password?.value || "").trim();
  const promo   = (f.promo?.value  || "").trim();
  const consent = !!f.consent?.checked;

  if(!name || !email || !phone || !school || !pass) return toast('كل الحقول مطلوبة.');
  if(!isValidEmail(email)) return toast('اكتبي بريدًا صحيحًا.');
  if(!isValidPhone(phone)) return toast('رقم الجوال يجب أن يبدأ بـ 05 ويكون 10 أرقام.');

  const old = store.user;
  if(old && old.email && old.email !== email){
    return toast('يوجد حساب محفوظ. سجّلي خروجًا أو امسحي البيانات قبل إنشاء حساب جديد.');
  }

  const createdAt = new Date().toISOString();
  store.user = { name, email, phone, school, password: pass, marketingConsent: consent, promo, createdAt };
  store.auth = true;

  if(promo){
    const r = redeemCode(promo);
    toast(r.msg);
  }

  closeModal('#modal-register');

  sendRowToSheet({
    date: createdAt,
    name, email, phone, school,
    promo,
    plan: '',
    startsAt: '',
    endsAt: '',
    totalPaid: 0,
    consent
  });

setTimeout(()=>{
  location.href = 'index.html';
}, 250);
}

/* ==== الدخول ==== */
function handleLogin(e){
  e.preventDefault();
  const f   = e.target;
  const id  = (f.identifier?.value || "").trim();   // إيميل أو 05xxxxxxxx
  const pass= (f.password?.value   || "").trim();
  const u   = store.user;

  if(!u)           return toast('لا يوجد حساب مسجل. أنشئي حسابًا أولًا.');
  if(!id || !pass) return toast('كل الحقول مطلوبة.');

  const isPhone = /^05\d{8}$/.test(id);
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id);
  if(!isPhone && !isEmail){
    return toast('أدخلي بريدًا صحيحًا أو رقمًا يبدأ بـ 05 (10 أرقام).');
  }

  const matchId = isPhone
    ? id === (u.phone || "")
    : id.toLowerCase() === (u.email || "").toLowerCase();

  const passOk = pass === (u.password || "");
  if(!(matchId && passOk)) return toast('بيانات الدخول غير صحيحة.');

store.auth = true;
closeModal('#modal-login');
toast('أهلًا وسهلًا بك في «أثــر» 🪄');

// بعد تسجيل الدخول → رجوع للرئيسية
setTimeout(()=>{
  location.href = 'index.html';
}, 200);
}

/* ==== الاشتراك ==== */
/* حالياً يطلب Netlify Function اسمها create-checkout. إن ما كانت موجودة، سيظهر توست بخطأ.
   بعد ربط مزوّد الدفع (ميسر)، سيعيد لك رابط الدفع ونجاح العملية يمر عبر afterPay أدناه. */
async function subscribe(planKey){
  if(!store.auth || !store.user){ openModal('#modal-register'); return; }

  try{
    const res = await fetch('/.netlify/functions/create-checkout', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        provider: 'moyasar',
        plan: planKey,
        email: store.user.email,
        phone: store.user.phone,
        name: store.user.name
      })
    });
    if(!res.ok){
      const txt = await res.text();
      throw new Error('خطأ في إنشاء جلسة الدفع: ' + txt);
    }
    const { checkout_url } = await res.json();
    if(!checkout_url) throw new Error('لم يتم استلام رابط الدفع');
    location.href = checkout_url;
  }catch(err){
    console.error(err);
    toast('تعذّر فتح صفحة الدفع.');
  }
}

/* ==== ربط الأحداث ==== */
function wire(){
  const regForm   = $('#register-form'); if(regForm)  regForm.addEventListener('submit', handleRegister);
  const loginForm = $('#login-form');    if(loginForm) loginForm.addEventListener('submit', handleLogin);

  // أزرار الباقات (في pricing.html)
  $$('#choose-plan [data-plan]').forEach(btn=>{
    btn.addEventListener('click', ()=> subscribe(btn.getAttribute('data-plan')));
  });

  const lo  = $('#logout'); if(lo)  lo.addEventListener('click', logout);
  const del = $('#delete'); if(del) del.addEventListener('click', deleteAccount);

  const useOne = $('#use-one'); if(useOne) useOne.addEventListener('click', ()=> consumeGeneration(1));

  // شارة الحالة + المتبقي من التجربة
  const badge = $('#sub-state');
  if(badge){
    const active = (isSubActive() || isTrialActive() || isOwner());
    badge.style.display = 'inline-block';
    badge.textContent = active ? 'نشط' : 'منتهي';
    badge.style.background = active ? '#dcfce7' : '#fee2e2';
    badge.style.color = active ? '#166534' : '#991b1b';
    badge.style.borderColor = active ? '#bbf7d0' : '#fecaca';

    const left = store.trial?.remaining ?? null;
    const leftEl = $('#t-left'); if(leftEl && left !== null) leftEl.textContent = left;
  }
}
document.addEventListener('DOMContentLoaded', () => {
  wire();      // يربط أزرار ومودالات مشروعك
  initAuth0(); // بعدها نفعل Auth0 بأمان

  // 🔽 زر "نسيت كلمة المرور"
  const forgotLink = document.getElementById("forgotPasswordLink");
  if (forgotLink) {
    forgotLink.addEventListener("click", (e) => {
      e.preventDefault();

      const domain = "dev-2f0fmbtj6u8o7en4.us.auth0.com"; // دومين Auth0
      const clientId = "rXaNXLwIkIOALVTWbRDA8SwJnERnI1NU"; // Client ID
      const redirectUri = window.location.origin; // يرجع للموقع بعد الإعادة

      window.location.href = `https://${domain}/u/reset-password?client_id=${clientId}&returnTo=${redirectUri}`;
    });
  }
});

/* ====== بعد الدفع (Callback) ====== */
/* مثال: redirect إلى index.html?status=success&plan=monthly */
(function afterPay(){
  const p = new URLSearchParams(location.search);
  if(p.get('status') !== 'success') return;

  const plan = p.get('plan') || 'monthly';
  const start = new Date();
  const end = new Date(start);
  if(plan==='weekly')       end.setDate(end.getDate()+7);
  else if(plan==='monthly') end.setMonth(end.getMonth()+1);
  else if(plan==='semi')    end.setMonth(end.getMonth()+6);
  else if(plan==='annual')  end.setFullYear(end.getFullYear()+1);

  store.sub = { plan, startedAt: start.toISOString(), endsAt: end.toISOString() };

  // تسجيل عملية الدفع في الشيت
  sendRowToSheet({
    date: new Date().toISOString(),
    name: store.user?.name || '',
    email: store.user?.email || '',
    phone: store.user?.phone || '',
    school: store.user?.school || '',
    promo: store.user?.promo || '',
    plan,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    totalPaid: { weekly:10, monthly:30, semi:170, annual:340 }[plan] ?? 0, // عدّليها لاحقاً
    consent: store.user?.marketingConsent ? true : false
  });

  toast('تم الدفع وتفعيل الاشتراك ✅');
  setTimeout(()=> location.href = 'athar.html', 900);
})();
/* ==== خروج/حذف ==== */
function closeAnyOpenModal(){
  const open = document.querySelector('.modal.show');
  if(open){ open.classList.remove('show'); open.setAttribute('aria-hidden','true'); }
}

function logout(){
  store.auth = false;           // خروج فعلي
  toast('تم تسجيل الخروج');
  refreshNav();                 // حدّث الشريط
  closeAnyOpenModal();          // أقفل أي مودال
  setTimeout(()=>location.href='index.html', 400); // رجوع للرئيسية
}

function deleteAccount(){
  store.clear();                // حذف كل بيانات المستخدم المحلية
  toast('تم حذف الحساب نهائيًا');
  refreshNav();
  closeAnyOpenModal();
  setTimeout(()=>location.href='index.html', 500);
}

/* ==== توست (نسخة واحدة فقط) ==== */
function toast(msg){
  let t = $('.toast'); 
  if(!t){ t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; 
  t.classList.add('show');
  setTimeout(()=> t.classList.remove('show'), 1800);
}
