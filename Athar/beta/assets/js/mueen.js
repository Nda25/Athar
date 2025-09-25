// مُعين — واجهة التوليد والعرض
(function(){
  const $ = (s)=>document.querySelector(s);
  const $$=(s)=>document.querySelectorAll(s);
  const status = (t)=> { const el=$("#status"); if(el) el.textContent=t||""; };
  const toast = (m)=>{ const t=$("#toast"); if(!t) return; t.textContent=m; t.style.display='block'; clearTimeout(window.__tt); window.__tt=setTimeout(()=>t.style.display='none',1600); };

  // حقول الدروس
  const lessonsBox = $("#lessons-box");
  const countSel   = $("#f-count");
  const modeSel    = $("#f-mode");
  function drawLessonFields(){
    const n = +countSel.value || 1;
    const wrap = document.createElement("div");
    wrap.className="grid";
    for(let i=1;i<=n;i++){
      const f = document.createElement("div");
      f.className="field";
      f.innerHTML = `<label>اسم الدرس ${i}</label><input class="lesson-name" placeholder="اكتب اسم الدرس ${i}">`;
      wrap.appendChild(f);
    }
    lessonsBox.innerHTML = '';
    lessonsBox.appendChild(wrap);
  }
  countSel.addEventListener('change', drawLessonFields);
  drawLessonFields();

  // تجميع المعطيات
  function readPayload(){
    const subject = $("#f-subject").value.trim();
    const grade   = $("#f-grade").value.trim();
    const names   = [...$$(".lesson-name")].map(i=>i.value.trim()).filter(Boolean);
    return {
      subject, grade, lessons: names, weekDays: ["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس"],
      mode: $("#f-mode").value
    };
  }

  // نسخة محسنة للحصول على توكن Auth0 — تتحمل اختلاف الدوال
  async function getJwt(){
    try{
      if (window.auth && typeof window.auth.getToken === 'function') {
        return await window.auth.getToken({ audience: "https://api.athar" });
      }
      if (window.auth0Client && typeof window.auth0Client.getTokenSilently === 'function') {
        return await window.auth0Client.getTokenSilently({ audience:"https://api.athar" });
      }
    }catch(e){}
    return null;
  }

  // رسم خطة اليوم
  function dayBlock(d, idx){
    const div = document.createElement('div');
    div.className='day-card';
    div.innerHTML = `
      <h3 style="margin:4px 0 10px"><span class="badge">${d.day}</span> <strong>${d.lesson}</strong>${d.segment ? ` — <span class="muted">${d.segment}</span>`:''}</h3>
      <div class="editable" data-key="objectives" contenteditable="false"><strong>الأهداف</strong><ul>${(d.objectives||[]).map(x=>`<li>${x}</li>`).join('')}</ul></div>
      <div class="editable" data-key="vocab" contenteditable="false"><strong>المفردات الجديدة</strong><ul>${(d.vocab||[]).map(x=>`<li>${x}</li>`).join('')}</ul></div>
      <div class="editable" data-key="outcomes" contenteditable="false"><strong>النتائج المتوقعة</strong><p>${d.outcomes||''}</p></div>
      <div class="editable" data-key="homework" contenteditable="false"><strong>واجب منزلي مقترح</strong><p>${d.homework||''}</p></div>
      <div class="actions-row" style="margin-top:6px">
        <button class="btn" data-act="toggle-edit">تعديل سريع</button>
        <button class="btn" data-act="copy">نسخ ${d.day}</button>
      </div>
    `;
    // أزرار
    div.addEventListener('click', (e)=>{
      const act = e.target?.dataset?.act;
      if (!act) return;
      if (act==='toggle-edit'){
        div.querySelectorAll('.editable').forEach(el=>{
          el.contentEditable = (el.contentEditable!=='true');
        });
        e.target.textContent = div.querySelector('.editable').contentEditable==='true' ? 'إقفال التعديل' : 'تعديل سريع';
      }
      if (act==='copy'){
        const txt = div.innerText.trim();
        navigator.clipboard.writeText(txt).then(()=>toast('نُسخ اليوم ✓'));
      }
    });
    return div;
  }

  // رسم الخطة كاملة
  function renderPlan(data){
    const meta = $("#meta"); meta.innerHTML='';
    [data.subject, data.grade].forEach(x=>{ const b=document.createElement('span'); b.className='badge'; b.textContent=x; meta.appendChild(b); });

    const week = $("#week"); week.innerHTML='';
    (data.plan||[]).forEach((d,i)=> week.appendChild(dayBlock(d,i)));

    $("#out").style.display='';
  }

  // أزرار
  $("#btn-generate").addEventListener('click', async ()=>{
    status(''); const payload = readPayload();
    if (!payload.subject || payload.lessons.length===0){ toast('أدخلي المادة وأسماء الدروس'); return; }

    const jwt = await getJwt();
    if (!jwt){ toast('غير مصرّح — سجّلي الدخول'); return; }

    const btn = $("#btn-generate");
    btn.disabled = true; const old=btn.textContent; btn.textContent='جارٍ التحضير…';

    try{
      const res = await fetch('/.netlify/functions/mueen-plan', {
        method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+jwt},
        body: JSON.stringify(payload)
      });
      if (!res.ok){
        const t = await res.text();
        status('تعذّر التوليد'); console.error('mueen-plan', res.status, t);
        if (res.status===402) toast('حساب غير نشط'); else toast('تعذّر التوليد');
        return;
      }
      const data = await res.json();
      renderPlan(data);
      toast('تم توليد الخطة ✨');
    }catch(e){ console.error(e); toast('تعذّر التوليد'); }
    finally{ btn.disabled=false; btn.textContent=old; }
  });

  $("#btn-copy-all").addEventListener('click', ()=>{
    const txt = $("#week")?.innerText?.trim() || '';
    if (!txt){ toast('لا توجد خطة لنسخها'); return; }
    navigator.clipboard.writeText(txt).then(()=>toast('نُسخت الخطة كاملة ✓'));
  });
})();
