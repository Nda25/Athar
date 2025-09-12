/* ====== إعدادات عامة ====== */
const ATHAR_APP_URL = "https://n-athar.co"; // رابط "أثر" الأساسي بعد الدخول/الاشتراك
const PRICING_URL   = "pricing.html";       // صفحة الخطط

/* ====== وصول المالك (دخول بلا قيود) ======
   ضعي بريدك/جوالك هنا ليتم منحك وصولًا دائمًا.
   أو عيّني مفتاحًا سريًّا (OWNER_KEY)؛ إذا أُدخل ككود تسجيل يفعّل وضع "مالك" لهذا الجهاز.
*/
const OWNER_EMAILS = [/* "you@example.com" */];
const OWNER_PHONES = [/* "05xxxxxxxxx"  */];
const OWNER_KEY    = ""; // مثال: "ATHAR-SECRET-2025" (اتركيه فارغًا لتعطيله)

const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

/* ====== إدارة الوضع الداكن/الفاتح ====== */
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
  // استخدام محلي لعدد المستفيدين من كل كود (للجهاز الحالي)
  get codesUsers(){ try{ return JSON.parse(localStorage.getItem('athar:codes-users')||'{}'); }catch{return {}; } },
  set codesUsers(obj){ localStorage.setItem('athar:codes-users', JSON.stringify(obj)); },

  clear(){
    localStorage.removeItem('athar:user');
    localStorage.removeItem('athar:sub');
    localStorage.removeItem('athar:trial');
    localStorage.removeItem('athar:auth');
    // لا نحذف athar:owner عمداً
  }
};

/* ====== تهيئة الشريط العلوي ====== */
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

/* ====== نافذة منبثقة عامة ====== */
function openModal(id){ $(id).classList.add('show'); }
function closeModal(id){ $(id).classList.remove('show'); }
$$('.modal [data-close]').forEach(btn => btn.addEventListener('click', e=>{
  e.preventDefault();
  const m = btn.closest('.modal'); if(m) m.classList.remove('show');
}));

/* ====== التحقق من الإدخالات ====== */
function isValidEmail(x){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x); }
function isValidPhone(x){ return /^05\d{8}$/.test(x); } // 05XXXXXXXX

/* ====== أكواد التجربة (إعدادات) ======
   maxUsers: أقصى عدد مستفيدين من الكود (محليًا على هذا الجهاز فقط هنا)
   perUserGenerations: عدد التوليدات لكل مستخدم
   expiresAt: تاريخ الانتهاء (توقيت الرياض +03:00)
*/
const CODES = {
  "IBNROSHD": { maxUsers: 100, perUserGenerations: 10, expiresAt: "2026-01-31T23:59:59+03:00" },
  "TNS":      { maxUsers: 100, perUserGenerations: 20, expiresAt: "2026-01-31T23:59:59+03:00" }
};
const PLAN_NAMES = { weekly:"أسبوعي", monthly:"شهري", semi:"نصف سنوي", annual:"سنوي" };

/* ====== صلاحيات الوصول ====== */
function isOwner(){
  const u = store.user;
  if(!u) return false;
  if(OWNER_EMAILS.includes(u.email)) return true;
  if(OWNER_PHONES.includes(u.phone)) return true;
  return store.owner; // مفعّل عبر OWNER_KEY لهذا الجهاز
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

/* ====== تفعيل كود تجربة للمستخدم ====== */
function redeemCode(codeRaw){
  const code = (codeRaw||"").trim().toUpperCase();
  if(!code) return { ok:false, msg:"أدخلي الكود." };

  // مفتاح المالك
  if(OWNER_KEY && code === OWNER_KEY){
    store.owner = true;
    return { ok:true, owner:true, msg:"تم منحك صلاحيات المالك." };
  }

  const cfg = CODES[code];
  if(!cfg) return { ok:false, msg:"الكود غير معروف." };

  // انتهاء الصلاحية؟
  if(new Date() > new Date(cfg.expiresAt)) return { ok:false, msg:"انتهت صلاحية هذا الكود." };

  // تحقق "محلي" لعدد المستفيدين
  const usage = store.codesUsers;
  const usedList = Array.isArray(usage[code]) ? usage[code] : [];
  const email = store.user?.email || "";
  if(!email) return { ok:false, msg:"يجب إنشاء الحساب أولاً." };
  if(!usedList.includes(email) && usedList.length >= cfg.maxUsers){
    return { ok:false, msg:"اكتمل عدد المستفيدين من هذا الكود." };
  }

  // لا تمنح مرتين لنفس المستخدم
  const cur = store.trial;
  if(cur && cur.code === code && isTrialActive()){
    return { ok:true, msg:"الكود مفعّل لديك مسبقًا." };
  }

  // منح التجربة
  store.trial = {
    code,
    remaining: cfg.perUserGenerations,
    activatedAt: new Date().toISOString(),
    expiresAt: cfg.expiresAt
  };

  // حدّث قائمة المستفيدين "محليًا"
  if(!usedList.includes(email)) usedList.push(email);
  usage[code] = usedList;
  store.codesUsers = usage;

  return { ok:true, msg:"تم تفعيل الكود بنجاح." };
}

/* ====== استهلاك توليدة من التجربة ====== */
function consumeGeneration(n=1){
  const t = store.trial;
  if(!t) return toast('لا توجد تجربة مفعّلة.');
  if(!isTrialActive()) return toast('انتهت صلاحية التجربة.');
  t.remaining = Math.max(0, (t.remaining||0) - n);
  store.trial = t;
  toast(`تم استخدام ${n} توليدة. المتبقّي: ${t.remaining}`);
  // تحديث حي في صفحة الملف الشخصي
  const leftEl = $('#t-left'); if(leftEl) leftEl.textContent = t.remaining;
  if(t.remaining === 0){ const ss = $('#sub-state'); if(ss){ ss.textContent = 'منتهي'; ss.style.background='#fee2e2'; ss.style.color='#991b1b'; ss.style.borderColor='#fecaca'; } }
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

  if(!name || !email || !phone || !school || !pass) return toast('كل الحقول مطلوبة.');
  if(!isValidEmail(email)) return toast('رجاءً اكتبي بريدًا صحيحًا.');
  if(!isValidPhone(phone)) return toast('رقم الجوال يجب أن يبدأ بـ 05 ويكون 10 أرقام.');

  const old = store.user;
  if(old && old.email && old.email !== email){
    return toast('يوجد حساب محفوظ. سجّلي خروجًا أو امسحي البيانات قبل إنشاء حساب جديد.');
  }

  store.user = { name, email, phone, school, createdAt: new Date().toISOString() };
  store.auth = true;

  // لو فيه كود
  if(promo){
    const r = redeemCode(promo);
    if(!r.ok) { toast(r.msg); } else { toast(r.msg); }
  }

  closeModal('#modal-register');

  // توجيه بناءً على الصلاحية
  setTimeout(()=>{
    if(hasAccess()) location.href = ATHAR_APP_URL;
    else            location.href = PRICING_URL;
  }, 200);
}

/* ====== الدخول (إيميل + جوال + مرور) ====== */
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

  if(hasAccess()){
    toast('تم تسجيل الدخول ✅');
    setTimeout(()=> location.href = ATHAR_APP_URL, 200);
  }else{
    toast('بحاجة لاشتراك أو كود تجربة.');
    setTimeout(()=> location.href = PRICING_URL, 400);
  }
}

/* ====== الاشتراك (تنشيط خطة) ====== */
function subscribe(planKey){
  if(!store.auth || !store.user){
    openModal('#modal-register'); // لازم تسجيل
    return;
  }
  const start = new Date();
  const end = new Date(start);
  if(planKey==='weekly')  end.setDate(end.getDate()+7);
  else if(planKey==='monthly') end.setMonth(end.getMonth()+1);
  else if(planKey==='semi')    end.setMonth(end.getMonth()+6);
  else if(planKey==='annual')  end.setFullYear(end.getFullYear()+1);

  store.sub = { plan: planKey, startedAt: start.toISOString(), endsAt: end.toISOString() };

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

/* ====== ربط الأزرار ====== */
function wire(){
  const regForm = $('#register-form'); if(regForm) regForm.addEventListener('submit', handleRegister);
  const loginForm = $('#login-form'); if(loginForm) loginForm.addEventListener('submit', handleLogin);

  $$('#choose-plan [data-plan]').forEach(btn=>{
    btn.addEventListener('click', ()=> subscribe(btn.getAttribute('data-plan')));
  });

  const lo = $('#logout'); if(lo) lo.addEventListener('click', logout);
  const del = $('#delete'); if(del) del.addEventListener('click', deleteAccount);

  // زر استخدام توليدة (اختياري في الملف الشخصي)
  const useOne = $('#use-one'); if(useOne) useOne.addEventListener('click', ()=> consumeGeneration(1));

  // شارة حالة الاشتراك/التجربة في الملف الشخصي
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

/* ====== توست رسائل صغيرة ====== */
function toast(msg){
  let t = $('.toast'); 
  if(!t){ t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; 
  t.classList.add('show');
  setTimeout(()=> t.classList.remove('show'), 1800);
}
