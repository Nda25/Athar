/* ====== إعداد عام ====== */
const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbzkBo_-YDkHskhhy2-ln4kMAyovIu1DQg4ogU5kG103WERjRG2UGjmT2n2uCTRqC6gWtg/exec";
const GAS_API_KEY  = "NADA-ATHAR-2025!"; // غيريه لقيمة قوية
const ATHAR_APP_URL = "https://n-athar.co";
const PRICING_URL   = "pricing.html";

// عنوان Google Apps Script API (من نشر الـ Web App)
const API_URL = "https://script.google.com/macros/s/AKfycbzkBo_-YDkHskhhy2-ln4kMAyovIu1DQg4ogU5kG103WERjRG2UGjmT2n2uCTRqC6gWtg/exec";

/* وصول المالك (دخول بلا قيود) – اختياري */
const OWNER_EMAILS = [];       // ضعي بريدك هنا إن رغبتِ
const OWNER_PHONES = [];       // أو جوالك بصيغة 05XXXXXXXX
const OWNER_KEY    = "";       // مفتاح يمنح وضع المالك عند إدخاله كـ “كود”

const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

/* ====== الوضع الداكن ====== */
(function themeInit(){
  const root = document.documentElement;
  const saved = localStorage.getItem('athar:theme');
  if(saved === 'dark'){ root.classList.add('dark'); }
  const t = $('#themeToggle');
  if(t){
    t.addEventListener('click', ()=>{
      root.classList.toggle('dark');
      localStorage.setItem('athar:theme', root.classList.contains('dark') ? 'dark' : 'light');
    });
  }
})();

/* ====== التخزين المحلي ====== */
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
  }
};

/* ====== تهيئة الشريط ====== */
(function navbarState(){
  const navAuth = $('#nav-auth');
  const profileLink = $('#nav-profile');
  if(!navAuth || !profileLink) return;
  if(store.auth && store.user){
    navAuth.style.display = 'none';
    profileLink.style.display = 'inline-flex';
    $$('.js-user-name').forEach(s => s.textContent = store.user.name || store.user.email || store.user.phone || 'مستخدم');
  }else{
    navAuth.style.display = 'inline-flex';
    profileLink.style.display = 'none';
  }
})();

/* ====== نافذة منبثقة ====== */
function openModal(id){ $(id).classList.add('show'); }
function closeModal(id){ $(id).classList.remove('show'); }
$$('.modal [data-close]').forEach(btn => btn.addEventListener('click', e=>{
  e.preventDefault();
  const m = btn.closest('.modal'); if(m) m.classList.remove('show');
}));

/* ====== تحقق إدخال ====== */
function isValidEmail(x){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x); }
function isValidPhone(x){ return /^05\d{8}$/.test(x); }

/* ====== أكواد التجربة ====== */
const CODES = {
  "IBNROSHD": { maxUsers: 100, perUserGenerations: 10, expiresAt: "2026-01-31T23:59:59+03:00" },
  "TNS":      { maxUsers: 100, perUserGenerations: 20, expiresAt: "2026-01-31T23:59:59+03:00" }
};
const PLAN_NAMES = { weekly:"أسبوعي", monthly:"شهري", semi:"نصف سنوي", annual:"سنوي" };

/* ====== الصلاحيات ====== */
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
function hasAccess(){
  return store.auth && (isOwner() || isSubActive() || isTrialActive());
}

/* ====== إرسال صف إلى Google Sheets ====== */
async function sendRowToSheet(payload){
  try{
    await fetch(GAS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: GAS_API_KEY,   // المفتاح يُرسل داخل الـJSON
        ...payload
      })
    });
  }catch(err){
    console.error('Sheet API error:', err);
  }
}

/* ====== تفعيل كود تجربة ====== */
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

  // سجل كحدث (trial_redeem)
  sendRowToSheet({
    // الترتيب يطابق سكربتك في الشيت
    date: new Date().toISOString(),
    name: store.user?.name || '',
    email: email,
    phone: store.user?.phone || '',
    school: store.user?.school || '',
    promo: code,
    plan: '',           // لا شيء هنا
    startsAt: '',       // لا شيء
    endsAt: '',         // لا شيء
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

  // يمكن تسجيل الاستهلاك كحدث (اختياري)
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
    totalPaid: n, // نستخدمه كعداد بسيط هنا
    consent: store.user?.marketingConsent ? true : false
  });
}

/* ====== التسجيل ====== */
function handleRegister(e){
  e.preventDefault();
  const f = e.target;
  const name    = f.name.value.trim();
  const email   = f.email.value.trim();
  const phone   = f.phone.value.trim();
  const school  = f.school.value.trim();
  const pass    = f.password.value.trim();
  const promo   = (f.promo?.value || "").trim();
  const consent = !!f.consent?.checked;

  if(!name || !email || !phone || !school || !pass) return toast('كل الحقول مطلوبة.');
  if(!isValidEmail(email)) return toast('رجاءً اكتبي بريدًا صحيحًا.');
  if(!isValidPhone(phone)) return toast('رقم الجوال يجب أن يبدأ بـ 05 ويكون 10 أرقام.');

  const old = store.user;
  if(old && old.email && old.email !== email){
    return toast('يوجد حساب محفوظ. سجّلي خروجًا أو امسحي البيانات قبل إنشاء حساب جديد.');
  }

  const createdAt = new Date().toISOString();
  store.user = { name, email, phone, school, marketingConsent: consent, promo, createdAt };
  store.auth = true;

  // لو فيه كود يفعّل
  if(promo){
    const r = redeemCode(promo);
    toast(r.msg);
  }

  closeModal('#modal-register');

  // إرسال صف "تسجيل"
  sendRowToSheet({
    date: createdAt,
    name, email, phone, school,
    promo,
    plan: null,
    startsAt: null,
    endsAt: null,
    totalPaid: 0,
    consent
  });

  setTimeout(()=>{
    if(hasAccess()) location.href = ATHAR_APP_URL;
    else            location.href = PRICING_URL;
  }, 250);
}

/* ====== الدخول ====== */
function handleLogin(e){
  e.preventDefault();
  const f = e.target;
  const email = f.email.value.trim();
  const phone = f.phone.value.trim();
  const pass  = f.password.value.trim();
  const u = store.user;

  if(!u) return toast('لا يوجد حساب مسجل. أنشئي حسابًا أولًا.');
  if(!email || !phone || !pass) return toast('كل الحقول مطلوبة.');
  if(email !== u.email || phone !== (u.phone||'')) return toast('بيانات الدخول غير صحيحة.');

  store.auth = true;
  closeModal('#modal-login');
  toast('تم تسجيل الدخول ✅');

  if(hasAccess()) setTimeout(()=> location.href = ATHAR_APP_URL, 200);
  else            setTimeout(()=> location.href = PRICING_URL, 200);
}

/* ====== الاشتراك ====== */
function subscribe(planKey){
  if(!store.auth || !store.user){ openModal('#modal-register'); return; }

  const start = new Date();
  const end = new Date(start);
  if(planKey==='weekly')  end.setDate(end.getDate()+7);
  else if(planKey==='monthly') end.setMonth(end.getMonth()+1);
  else if(planKey==='semi')    end.setMonth(end.getMonth()+6);
  else if(planKey==='annual')  end.setFullYear(end.getFullYear()+1);

  store.sub = { plan: planKey, startedAt: start.toISOString(), endsAt: end.toISOString() };

  // تقدير المبلغ (اختياري الآن – عدليه كما تشائين)
  const prices = { weekly:10, monthly:30, semi:170, annual:340 };
  const amount = prices[planKey] ?? 0;

  // إرسال صف "اشتراك"
  sendRowToSheet({
    date: new Date().toISOString(),
    name: store.user.name,
    email: store.user.email,
    phone: store.user.phone,
    school: store.user.school,
    promo: store.user.promo || '',
    plan: planKey,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    totalPaid: amount,
    consent: store.user.marketingConsent ? true : false
  });

  toast('تم تفعيل الاشتراك ✅');
  setTimeout(()=> location.href = ATHAR_APP_URL, 250);
}

/* ====== خروج/حذف ====== */
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

/* ====== ربط ====== */
function wire(){
  const regForm = $('#register-form'); if(regForm) regForm.addEventListener('submit', handleRegister);
  const loginForm = $('#login-form'); if(loginForm) loginForm.addEventListener('submit', handleLogin);
  $$('#choose-plan [data-plan]').forEach(btn=> btn.addEventListener('click', ()=> subscribe(btn.getAttribute('data-plan'))));
  const lo = $('#logout'); if(lo) lo.addEventListener('click', logout);
  const del = $('#delete'); if(del) del.addEventListener('click', deleteAccount);
  const useOne = $('#use-one'); if(useOne) useOne.addEventListener('click', ()=> consumeGeneration(1));

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

/* ====== توست ====== */
function toast(msg){
  let t = $('.toast'); 
  if(!t){ t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; 
  t.classList.add('show');
  setTimeout(()=> t.classList.remove('show'), 1800);
}
