/* =========================================
   athar — app.js (نسخة خفيفة بعد التنظيف)
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
   قاعدة بيانات محلية للفورمات
   ============================== */
function userKey(){ return 'athar:data'; } // مفتاح عام
const userDB = {
  getAll(){
    try{ return JSON.parse(localStorage.getItem(userKey())||'{}'); }
    catch(_){ return {}; }
  },
  setAll(obj){ localStorage.setItem(userKey(), JSON.stringify(obj||{})); },
  get(page, fallback={}){ const all = this.getAll(); return all[page] ?? fallback; },
  set(page, data){ const all = this.getAll(); all[page] = data; this.setAll(all); },
  merge(page, partial){ const cur = this.get(page, {}); this.set(page, Object.assign({}, cur, partial)); },
  remove(page){ const all = this.getAll(); delete all[page]; this.setAll(all); },
  clearThisUser(){ this.setAll({}); }
};

/* تحققات بسيطة */
function isValidEmail(x){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x); }
function isValidPhone(x){ return /^05\d{8}$/.test(x); }

/* ==============================
   أوتو-حفظ فورمات
   ============================== */
function readForm(container){
  const data = {};
  const root = (typeof container === 'string') ? document.querySelector(container) : container;
  if(!root) return data;

  root.querySelectorAll('input, textarea, select').forEach(el=>{
    const key = el.name || el.id; if(!key) return;

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

function bindAutoSave(pageKey, container){
  const root = (typeof container === 'string') ? document.querySelector(container) : container;
  if(!root) return;

  fillForm(root, userDB.get(pageKey, {}));
  let t=null;
  const save = ()=>{
    clearTimeout(t);
    t = setTimeout(()=> userDB.set(pageKey, readForm(root)), 250);
  };
  root.addEventListener('input', save);
  root.addEventListener('change', save);
}

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
    // في حال auth كان جاهز قبل هذا الملف
    onReady();
  }

  // إن كان فيه wire() مُعرّفة بملف آخر، شغّلها
  if (typeof window.wire === 'function') window.wire();
});
