// helpers: تعريف واحد فقط
window.$  = (sel, root=document) => root.querySelector(sel);
window.$$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
