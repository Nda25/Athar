/* ====== إعداد عام ====== */
const ATHAR_APP_URL = "https://n-athar.co"; // رابط أثر العادي بعد تسجيل الدخول/الاشتراك

const $ = (sel, root=document) => root.querySelector(sel);
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

/* ====== تخزين محلي وهمي للحساب والاشتراك (للنسخة التجريبية) ====== */
/* ملاحظة أمنية: هذا تخزين واجهة فقط للتجربة. عند الربط الحقيقي سنستبدل هذه الدوال بAPI. */
const store = {
  get user(){ try{ return JSON.parse(localStorage.getItem('athar:user')||'null'); }catch{return null} },
  set user(u){ localStorage.setItem('athar:user', JSON.stringify(u)); },
  get sub(){ try{ return JSON.parse(localStorage.getItem('athar:sub')||'null'); }catch{return null} },
  set sub(s){ localStorage.setItem('athar:sub', JSON.stringify(s)); },
  get auth(){ return localStorage.getItem('athar:auth') === '1'; },
  set auth(v){ localStorage.setItem('athar:auth', v ? '1' : '0'); },
  clear(){ localStorage.removeItem('athar:user'); localStorage.removeItem('athar:sub'); localStorage.removeItem('athar:auth'); }
};

/* ====== تهيئة الشريط العلوي بناءً على الحالة ====== */
(function navbarState(){
  const navAuth = $('#nav-auth');
  const profileLink = $('#nav-profile');
  if(!navAuth || !profileLink) return;

  if(store.auth && store.user){
    navAuth.style.display = 'none';
    profileLink.style.display = 'inline-flex';
    // لو أنتِ على صفحة الملف الشخصي عبي الاسم
    const nameSpans = $$('.js-user-name');
    nameSpans.forEach(s => s.textContent = store.user.name || store.user.email || store.user.phone || 'مستخدم');
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

/* ====== تسجيل جديد ====== */
function handleRegister(e){
  e.preventDefault();
  const f = e.target;
  const name  = f.name.value.trim();
  const email = f.email.value.trim();
  const phone = f.phone.value.trim();
  const pass  = f.password.value.trim();

  if(!name || !email || !pass){
    return toast('أكملي الحقول المطلوبة.');
  }
  // حفظ المستخدم محليًا
  store.user = { name, email, phone, createdAt: new Date().toISOString() };
  store.auth = true;
  closeModal('#modal-register');
  toast('تم إنشاء الحساب ✅');
  // التحويل إلى أثر العادي
  location.href = ATHAR_APP_URL;
}

/* ====== تسجيل الدخول ====== */
function handleLogin(e){
  e.preventDefault();
  const f = e.target;
  const emailOrPhone = f.identity.value.trim();
  const pass = f.password.value.trim();
  const u = store.user;

  if(!u){ return toast('لا يوجد حساب مسجل. أنشئي حسابًا أولًا.'); }
  const ok = (emailOrPhone === u.email || emailOrPhone === (u.phone||'')); // تماثل مبسط
  if(!ok || !pass){ return toast('بيانات الدخول غير صحيحة.'); }

  store.auth = true;
  closeModal('#modal-login');
  toast('تم تسجيل الدخول ✅');
  location.href = ATHAR_APP_URL;
}

/* ====== زر الخروج / حذف الحساب ====== */
function logout(){ store.auth = false; toast('تم تسجيل الخروج'); setTimeout(()=>location.href='index.html', 400); }
function deleteAccount(){ store.clear(); toast('تم حذف الحساب نهائيًا'); setTimeout(()=>location.href='index.html', 500); }

/* ====== الاشتراك (وهمي الآن) ====== */
function subscribe(planKey){
  if(!store.auth || !store.user){
    openModal('#modal-register'); // لازم تسجيل
    return;
  }
  const start = new Date();
  const end = new Date(start);
  if(planKey==='weekly') end.setDate(end.getDate()+7);
  else if(planKey==='monthly') end.setMonth(end.getMonth()+1);
  else if(planKey==='semi') end.setMonth(end.getMonth()+6);
  else if(planKey==='annual') end.setFullYear(end.getFullYear()+1);

  store.sub = {
    plan: planKey,
    startedAt: start.toISOString(),
    endsAt: end.toISOString()
  };
  toast('تم تفعيل الاشتراك ✅');
  location.href = ATHAR_APP_URL;
}

/* ربط الأزرار (إن وُجدت في الصفحة) */
function wire(){
  const regForm = $('#register-form');
  if(regForm) regForm.addEventListener('submit', handleRegister);

  const loginForm = $('#login-form');
  if(loginForm) loginForm.addEventListener('submit', handleLogin);

  $$('#choose-plan [data-plan]').forEach(btn=>{
    btn.addEventListener('click', ()=> subscribe(btn.getAttribute('data-plan')));
  });

  const lo = $('#logout'); if(lo) lo.addEventListener('click', logout);
  const del = $('#delete'); if(del) del.addEventListener('click', deleteAccount);
}
document.addEventListener('DOMContentLoaded', wire);

/* ====== التوست ====== */
function toast(msg){
  let t = $('.toast'); if(!t){
    t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t);
  }
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=> t.classList.remove('show'), 1800);
}
