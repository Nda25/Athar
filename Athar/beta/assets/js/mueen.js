// مُعين — واجهة
(function(){
  const DAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"];
  const $ = (s)=>document.querySelector(s);
  const $$= (s)=>document.querySelectorAll(s);
  const status = $('#status');

  const lessonsBox = $('#lessons-box');
  const fCount   = $('#f-count');
  const fMode    = $('#f-mode');

  function lessonRow(i){
    const wrap = document.createElement('div');
    wrap.className='field';
    wrap.innerHTML = `
      <label>اسم الدرس ${i+1}</label>
      <input class="lesson-name" data-idx="${i}" placeholder="اكتب اسم الدرس بدقة">
    `;
    return wrap;
  }
  function drawLessonInputs(){
    lessonsBox.innerHTML='';
    const n = +fCount.value || 1;
    if (fMode.value === 'manual'){
      for(let i=0;i<n;i++) lessonsBox.appendChild(lessonRow(i));
    }else{
      const tip = document.createElement('div');
      tip.className='muted';
      tip.textContent='سيحاول مُعين جلب الدروس آليًا من المنهج (تجريبي).';
      lessonsBox.appendChild(tip);
    }
  }
  fCount.addEventListener('change', drawLessonInputs);
  fMode.addEventListener('change', drawLessonInputs);
  drawLessonInputs();

  // توكن Auth0 — توافقية (تعالج "getToken is not a function")
  async function getAuthToken(){
    if (!window.auth) return null;
    try {
      if (typeof window.auth.getTokenSilently === 'function') {
        return await window.auth.getTokenSilently({ authorizationParams:{ audience:'https://api.n-athar' } });
      }
      if (typeof window.auth.getToken === 'function') {
        return await window.auth.getToken({ audience:'https://api.n-athar' });
      }
    } catch(e){
      try {
        if (typeof window.auth.getTokenWithPopup === 'function') {
          return await window.auth.getTokenWithPopup({ authorizationParams:{ audience:'https://api.n-athar' } });
        }
      } catch(_) {}
    }
    return null;
  }

  function chip(txt){
    const c=document.createElement('span');
    c.className='chip'; c.textContent=txt; return c;
  }

  // عرض الخطة
  function renderPlan(data){
    $('#out').style.display='';
    const meta = $('#meta'); meta.innerHTML='';
    meta.appendChild(chip(data.meta.subject));
    meta.appendChild(chip(`الصف: ${data.meta.grade}`));
    meta.appendChild(chip(`دروس الأسبوع: ${data.meta.count}`));

    const host = $('#plan'); host.innerHTML='';
    data.days.forEach((d,i)=>{
      const card = document.createElement('div');
      card.className='card-day';
      card.innerHTML = `
        <div class="day-head">
          <h3 style="margin:0">${DAYS[i]} — <span class="muted">Segment ${i+1}</span></h3>
        </div>
        <h4 style="margin:6px 0">الأهداف</h4>
        <ul class="list goals"></ul>

        <h4 style="margin:6px 0">المفردات الجديدة</h4>
        <ul class="list vocab"></ul>

        <h4 style="margin:6px 0">النتائج المتوقعة</h4>
        <p class="outcomes muted"></p>

        <h4 style="margin:6px 0">واجب منزلي مقترح</h4>
        <p class="hw muted"></p>

        <div class="actions-row" style="margin-top:8px">
          <button class="btn small" data-edit="${i}">تعديل سريع</button>
          <button class="btn small" data-copy="${i}">نسخ ${DAYS[i]}</button>
        </div>
      `;
      host.appendChild(card);
      const ulG = card.querySelector('.goals');
      const ulV = card.querySelector('.vocab');
      (d.goals||[]).forEach(g=>{ const li=document.createElement('li'); li.textContent=g; ulG.appendChild(li); });
      (d.vocab||[]).forEach(v=>{ const li=document.createElement('li'); li.textContent=v; ulV.appendChild(li); });
      card.querySelector('.outcomes').textContent = d.outcomes || '';
      card.querySelector('.hw').textContent       = d.homework || '';
    });

    // تعديل سريع
    host.addEventListener('click', (e)=>{
      const i = +e.target.dataset.edit;
      if (Number.isFinite(i)){
        const day = data.days[i];
        const g = prompt(`عدّل الأهداف ليوم ${DAYS[i]} (سطر لكل هدف):`, (day.goals||[]).join('\n'));
        if (g!=null) day.goals = g.split('\n').map(s=>s.trim()).filter(Boolean);
        const v = prompt(`عدّل المفردات ليوم ${DAYS[i]} (سطر لكل مفردة — سيتم تقاطعها مع مفردات الدرس):`, (day.vocab||[]).join('\n'));
        if (v!=null) day.vocab = v.split('\n').map(s=>s.trim()).filter(Boolean);
        renderPlan(data);
      }
      const j = +e.target.dataset.copy;
      if (Number.isFinite(j)){
        const day = data.days[j];
        const txt =
`${DAYS[j]} — ${data.meta.subject} (${data.meta.grade})

الأهداف:
- ${(day.goals||[]).join('\n- ')}

المفردات الجديدة:
- ${(day.vocab||[]).join('\n- ')}

النتائج المتوقعة:
${day.outcomes||''}

واجب منزلي:
${day.homework||''}
`;
        navigator.clipboard.writeText(txt);
        toast('نُسخ يوم '+DAYS[j]+' ✓');
      }
    });

    // نسخ كامل
    $('#btn-copy-all').onclick = ()=>{
      const big = data.days.map((day,i)=>(
`${DAYS[i]}

الأهداف:
- ${(day.goals||[]).join('\n- ')}

المفردات:
- ${(day.vocab||[]).join('\n- ')}

النتائج المتوقعة:
${day.outcomes||''}

الواجب:
${day.homework||''}
`
      )).join('\n\n---\n\n');
      navigator.clipboard.writeText(big);
      toast('نسخ الخطة كاملة ✓');
    };
  }

  // نداء الدالة
  $('#btn-generate').addEventListener('click', async ()=>{
    status.textContent='جارٍ التوليد.';
    const token = await getAuthToken();
    if (!token){ status.textContent='غير مصرح — سجّلي الدخول'; toast('غير مصرح — سجّلي الدخول'); return; }

    const subject = $('#f-subject').value.trim();
    const grade   = $('#f-grade').value;
    const count   = +$('#f-count').value || 1;
    let lessons   = [];

    if (fMode.value==='manual'){
      lessons = [...$$('.lesson-name')].map(i=>i.value.trim()).filter(Boolean);
    }

    try{
      const res = await fetch('/.netlify/functions/mueen-plan', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+token },
        body: JSON.stringify({ subject, grade, count, lessons, mode:fMode.value })
      });
      if (!res.ok){
        const t = await res.text().catch(()=> '');
        throw new Error(t||'server error');
      }
      const data = await res.json();
      renderPlan(data);
      status.textContent = 'تم ✓';
    }catch(e){
      console.error(e);
      status.textContent='تعذر التوليد';
      toast('تعذر التوليد');
    }
  });

  // أزرار الدخول/الخروج
  const btnLogin  = $('#btn-login');
  const btnLogout = $('#btn-logout');
  btnLogin.addEventListener('click', ()=> window.auth?.login({ authorizationParams:{ screen_hint:'login', redirect_uri: window.location.href }}));
  btnLogout.addEventListener('click', ()=> window.auth?.logout({ logoutParams:{ returnTo: window.location.href }}));

  // عرض حالة الدخول
  async function boot(){
    try{
      const ok = await window.auth.isAuthenticated();
      btnLogin.style.display = ok? 'none' : '';
      btnLogout.style.display= ok? '' : 'none';
    }catch{}
  }
  boot();

  // توست بسيط
  const box = document.getElementById('toast');
  window.toast = (msg, ms=1600)=>{ box.textContent = msg; box.style.display='block';
    clearTimeout(window.__t); window.__t=setTimeout(()=>box.style.display='none', ms); };
})();
