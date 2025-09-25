// assets/js/mueen.js
(function(){
  const dayNames = ["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس"];
  const $ = (s)=>document.querySelector(s);
  const $$=(s)=>Array.from(document.querySelectorAll(s));
  const statusEl = $('#status');

  // يبني حقول الدروس حسب العدد
  function buildLessonInputs(){
    const n = +$('#f-count').value;
    const box = $('#lesson-box'); box.innerHTML='';
    for(let i=1;i<=n;i++){
      const wrap = document.createElement('div'); wrap.className='field';
      wrap.innerHTML = `<label>اسم الدرس ${i}</label><input class="lesson-name" placeholder="اكتب اسم الدرس ${i}">`;
      box.appendChild(wrap);
    }
  }
  buildLessonInputs();
  $('#f-count').addEventListener('change', buildLessonInputs);
  $('#f-mode').addEventListener('change', (e)=>{
    const manual = e.target.value === 'manual';
    $$('.lesson-name').forEach(inp=> inp.disabled = !manual);
  });

  // Get token safely (Auth0 SPA v2)
  async function getAuthToken(){
    if (!window.auth) return null;
    // require-auth.js يضع auth ككائن جاهز
    try{
      const ok = await window.auth.isAuthenticated();
      if (!ok) { return null; }
      // متوافق مع v2: getTokenSilently
      if (typeof window.auth.getTokenSilently === 'function') {
        return await window.auth.getTokenSilently({ authorizationParams:{ audience:"https://api.athar" }});
      }
      // fallback wrapper إن كانت الواجهة قد وفّرت getToken
      if (typeof window.auth.getToken === 'function') {
        return await window.auth.getToken({ audience:"https://api.athar" });
      }
    }catch(e){}
    return null;
  }

  function chip(t){ const s=document.createElement('span'); s.className='chip'; s.textContent=t; return s; }

  // تعديل سريع قبل النسخ
  function quickEdit(container, dayObj){
    const btn = document.createElement('button');
    btn.className='btn small'; btn.textContent='تعديل سريع';
    btn.addEventListener('click', ()=>{
      const newGoal = prompt('عدّل هدف اليوم (اختياري):', (dayObj.goals||[]).join(' • '));
      if (newGoal!=null){
        dayObj.goals = newGoal.split('•').map(t=>t.trim()).filter(Boolean);
        renderDay(container, dayObj, true);
      }
    });
    return btn;
  }

  function copyText(t){
    navigator.clipboard.writeText(t); toast('تم النسخ ✓');
  }
  function toast(m){ const box = document.getElementById('toast'); box.textContent=m; box.style.display='block'; setTimeout(()=>box.style.display='none',1500); }

  function renderDay(host, d, replace=false){
    const html = `
      <h3 style="margin:0 0 6px">${d.dayName} — <span style="color:var(--accent)">${d.lessonName}${d.segment?` (Segment ${d.segment})`:''}</span></h3>
      <div class="chips">
        <span class="chip">${d.subject}</span>
        <span class="chip">${d.grade}</span>
      </div>
      <h4>الأهداف</h4>
      <ul>${(d.goals||[]).map(g=>`<li>${g}</li>`).join('')}</ul>
      <h4>المفردات الجديدة</h4>
      <ul>${(d.vocab||[]).map(v=>`<li>${v}</li>`).join('')}</ul>
      <h4>النتائج المتوقعة</h4>
      <p>${d.outcomes||''}</p>
      <h4>واجب منزلي مقترح</h4>
      <p>${d.homework||''}</p>
    `;
    if (replace) {
      host.querySelector('.content').innerHTML = html;
      return;
    }
    const card = document.createElement('div'); card.className='day-card';
    card.innerHTML = `<div class="content">${html}</div>`;
    const tools = document.createElement('div'); tools.className='tools';
    const btnCopy = document.createElement('button'); btnCopy.className='btn small'; btnCopy.textContent=`نسخ يوم ${d.dayName}`;
    btnCopy.addEventListener('click', ()=>{
      const text = card.innerText.trim();
      copyText(text);
    });
    tools.appendChild(quickEdit(card, d));
    tools.appendChild(btnCopy);
    card.appendChild(tools);
    host.appendChild(card);
  }

  async function callPlan(body){
    const token = await getAuthToken();
    statusEl.textContent = 'جارٍ إعداد الخطة…';
    const res = await fetch('/.netlify/functions/mueen-plan', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        ...(token ? {'Authorization':'Bearer '+token} : {})
      },
      body: JSON.stringify(body)
    });
    const txt = await res.text();
    let data = {};
    try{ data = JSON.parse(txt); }catch{ throw new Error(txt||'Bad JSON'); }
    if (!res.ok) throw new Error(data?.error || 'تعذّر التوليد');
    return data;
  }

  $('#btn-generate').addEventListener('click', async ()=>{
    try{
      const subject = $('#f-subject').value.trim();
      const grade   = $('#f-grade').value;
      const count   = +$('#f-count').value;
      const mode    = $('#f-mode').value; // manual|ai
      if (!subject) { statusEl.textContent='اكتبي اسم المادة'; return; }

      let lessons = [];
      if (mode==='manual'){
        lessons = $$('.lesson-name').map(i=>i.value.trim()).filter(Boolean).slice(0,count);
        if (lessons.length!==count){ statusEl.textContent='أكملي أسماء الدروس'; return; }
      }else{
        lessons = []; // الدالة ستجلب أسماء الدروس
      }

      const payload = { subject, grade, lessons, mode, days:5 };
      const out = await callPlan(payload);

      // meta
      const meta = $('#meta'); meta.innerHTML=''; 
      meta.appendChild(chip(out.meta.subject));
      meta.appendChild(chip(out.meta.grade));
      meta.appendChild(chip('خطة ٥ أيام'));
      if (out.meta.note) meta.appendChild(chip(out.meta.note));

      // render days
      const week = $('#week'); week.innerHTML='';
      (out.days||[]).forEach(d=> renderDay(week, d));

      $('#result').style.display='';
      statusEl.innerHTML = '<span class="ok">تم توليد الخطة ✓</span>';

      // نسخ الخطة كاملة
      $('#copy-all').onclick = ()=>{
        const text = $('#week').innerText.trim();
        copyText(text);
      };
    }catch(e){
      console.error(e);
      statusEl.textContent = 'تعذّر التوليد، حاولي ثانية.';
    }
  });
})();
