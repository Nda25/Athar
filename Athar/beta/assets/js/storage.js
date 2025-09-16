// قاعدة بيانات محلية بسيطة للفورمات
function userKey(){ return 'athar:data'; }
window.userDB = {
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

// أدوات تحقق
window.isValidEmail = (x)=> /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x);
window.isValidPhone = (x)=> /^05\d{8}$/.test(x);

// أوتو-حفظ (اختياري للصفحات اللي فيها فورمات)
window.readForm = function readForm(container){
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
    if(el.type === 'radio'){ if(el.checked) data[key] = el.value; else if(!(key in data)) data[key] = ''; return; }
    if(el.type === 'number'){ data[key] = (el.value === '' ? '' : +el.value); return; }
    data[key] = el.value;
  });
  return data;
};

window.fillForm = function fillForm(container, data){
  const root = (typeof container === 'string') ? document.querySelector(container) : container;
  if(!root || !data) return;
  Object.entries(data).forEach(([k,v])=>{
    const els = root.querySelectorAll(`[name="${k}"], #${CSS.escape(k)}`);
    if(!els.length) return;
    els.forEach(el=>{
      if(el.tagName === 'SELECT'){
        if(el.multiple && Array.isArray(v)){ Array.from(el.options).forEach(o=>o.selected = v.includes(o.value)); }
        else { el.value = (v ?? ''); }
        return;
      }
      if(el.type === 'checkbox'){
        const group = root.querySelectorAll(`input[type="checkbox"][name="${el.name}"]`);
        if(group.length > 1 && Array.isArray(v)){ el.checked = v.includes(el.value || true); }
        else { el.checked = !!v; }
        return;
      }
      if(el.type === 'radio'){ el.checked = (el.value == v); return; }
      el.value = (v == null ? '' : v);
    });
  });
};

window.bindAutoSave = function bindAutoSave(pageKey, container){
  const root = (typeof container === 'string') ? document.querySelector(container) : container;
  if(!root) return;
  fillForm(root, userDB.get(pageKey, {}));
  let t=null;
  const save = ()=>{ clearTimeout(t); t = setTimeout(()=> userDB.set(pageKey, readForm(root)), 250); };
  root.addEventListener('input', save);
  root.addEventListener('change', save);
};
