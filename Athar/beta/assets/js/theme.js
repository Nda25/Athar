// توحيد مكان كلاس dark (لو كان على <body>)
(function unifyDarkClass(){
  var root = document.documentElement;
  var body = document.body;
  if (!body) return;
  if (body.classList.contains('dark')) {
    body.classList.remove('dark');
    root.classList.add('dark');
  }
})();

// تهيئة الثيم من localStorage
(function initTheme(){
  var root  = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem('theme'); } catch(_) {}
  if (saved === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
})();

// ربط زر 🌓
window.bindThemeToggle = function bindThemeToggle(){
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
};
