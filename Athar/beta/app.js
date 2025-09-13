/* =========================================
   athar — app.js (نسخة منقحة ونهائية)
   ========================================= */

/* ==== إعدادات عامة ==== */
const SHEET_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbw-soThyqiUPgf3PmdyRg1u9IlkrfRmLdwQQc1_vZwH3kTpZaUZTkpEQfzD2UIyQ3Iv8Q/exec";
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

/* ==== الوضع الداكن ==== */
(function themeInit(){
  const root = document.documentElement;
  const saved = localStorage.getItem('athar:theme');
  if(saved === 'dark') root.classList.add('dark');
  const t = $('#themeToggle');
  if(t){
    t.addEventListener('click', ()=>{
      root.classList.toggle('dark');
      localStorage.setItem('athar:theme', root.classList.contains('dark') ? 'dark' : 'light');
    });
  }
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

/* ==== تهيئة الشريط ==== */
(function navbarState(){
  const navAuth    = $('#nav-auth');
  const profileBtn = $('#nav-profile');
  const atharBtn   = $('#nav-athar');

  const logged = store.auth && !!store.user;

  if(navAuth)    navAuth.style.display    = logged ? 'none'       : 'inline-flex';
  if(profileBtn) profileBtn.style.display = logged ? 'inline-flex': 'none';
  if(atharBtn)   atharBtn.style.display   = logged ? 'inline-flex': 'none';

  if(logged){
    $$('.js-user-name').forEach(s => s.textContent = store.user.name || store.user.email || store.user.phone || 'مستخدم');
  }
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
  "TNS":      { maxUsers: 100, perUserGenerations: 20, expiresAt: "2026-01-31T23:59:59+03:00" }
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
    await fetch(SHEET_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: SHEET_API_KEY,        // ← مهم: يتطابق مع body.key في GAS
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
  }catch(err){
    console.error('Sheet API error:', err);
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
    if(hasAccess()) location.href = ATHAR_APP_URL;
    else            location.href = PRICING_URL;
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

  if(hasAccess()) setTimeout(()=> location.href = ATHAR_APP_URL, 200);
  else            setTimeout(()=> location.href = PRICING_URL,   200);
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
document.addEventListener('DOMContentLoaded', wire);

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
function logout(){
  store.auth = false;
  toast('تم تسجيل الخروج');
  setTimeout(()=>location.href='index.html', 400);
}
function deleteAccount(){
  store.clear();
  toast('تم حذف الحساب نهائيًا');
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
