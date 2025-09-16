// مودالات
window.openModal  = (id) => { const n = $(id); if (n) n.classList.add('show'); };
window.closeModal = (id) => { const n = $(id); if (n) n.classList.remove('show'); };
document.addEventListener('click', (e)=>{
  const btn = e.target.closest('.modal [data-close]');
  if(!btn) return;
  e.preventDefault();
  const m = btn.closest('.modal'); if(m) m.classList.remove('show');
});

// توست
window.toast = (msg)=>{
  let t = document.querySelector('.toast');
  if(!t){ t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=> t.classList.remove('show'), 1800);
};
