/* مُتَّسِق – سجل المتابعة الذكي
   يعمل مع style.css و app.js
   لا يحتاج مكتبات خارجية.  */

// assets/js/mutasiq.js
(() => {
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const toast = (m)=>{
    const t = $('#toast');
    if(!t) return;
    t.textContent = m;
    t.classList.add('show');
    setTimeout(()=>t.classList.remove('show'),1800);
  };

// تبويب بسيط
document.addEventListener('DOMContentLoaded', () => {
  const tabs = $$('.tabs .btn');
  tabs.forEach(b => b.addEventListener('click', () => {
    tabs.forEach(x=>x.classList.remove('primary'));
    b.classList.add('primary');
    $$('.tab').forEach(x=>x.classList.remove('active'));
    $('#'+b.dataset.tab).classList.add('active');
  }));
});

// الحالة العامة
const state = {
  orientation: 'portrait',
  cellStyle: 'empty', // empty|dots|squares|marks
  rowRadius: 6,
  weeks: 10,
  weekMode: 'range', // range|label|number
  startDate: null,   // 'YYYY-MM-DD'
  columns: [
    { id: 'att',  title:'الحضور',   color:'#eef2ff', hidden:false },
    { id: 'part', title:'المشاركة', color:'#eff6ff', hidden:false },
    { id: 'hw',   title:'الواجبات', color:'#f0f9ff', hidden:false },
  ],
  classCount: 2,
  classes: [
    { name:'الفصل 1', students:[] },
    { name:'الفصل 2', students:[] },
  ],
  projectTitle: '',
  // الغلاف
  cover: {
    schoolLogo:null, schoolLogoPos:'center',
    moeLogo:null, moeLogoPos:'center',
    teacherName:'', schoolName:'', subjectName:'', semesterName:'', stageName:'',
    bgImage:null, bgOpacity:.45, bgColor:'#f6f7fb'
  },
  // التذكيرات
  rem: {
    r1:{ title:'مواعيد مهمة', body:'', color:'#dbeafe' },
    r2:{ title:'تذكيرات',     body:'', color:'#e0f2fe' },
    r3:{ title:'مهام الطلاب', body:'', color:'#fce7f3' },
    footerLine:'التعليم شرارة صغيرة… تُضيء عقولًا كبيرة.',
    footerName:'ندى المجيرش',
  },
  // الفواصل
  seps: [
    { title:'الفصل 1', color:'#f1f5f9' },
    { title:'الفصل 2', color:'#f1f5f9' },
  ]
};

// عناصر
const orientation = $('#orientation');
const cellStyle   = $('#cellStyle');
const rowRadius   = $('#rowRadius');
const weeks       = $('#weeks');
const weekMode    = $('#weekMode');
const startDate   = $('#startDate');
const colsWrap    = $('#cols');
const newCol      = $('#newCol');
const addCol      = $('#addCol');
const miniPrev    = $('#miniPreview');

const classCount  = $('#classCount');
const classLists  = $('#classLists');
const projectTitle= $('#projectTitle');

const schoolLogo  = $('#schoolLogo');
const schoolLogoPos = $('#schoolLogoPos');
const moeLogo     = $('#moeLogo');
const moeLogoPos  = $('#moeLogoPos');
const teacherName = $('#teacherName');
const schoolName  = $('#schoolName');
const subjectName = $('#subjectName');
const semesterName= $('#semesterName');
const stageName   = $('#stageName');
const coverBg     = $('#coverBg');
const coverOpacity= $('#coverOpacity');
const coverColor  = $('#coverColor');

const rem1Title=$('#rem1Title'), rem1Body=$('#rem1Body'), rem1Color=$('#rem1Color');
const rem2Title=$('#rem2Title'), rem2Body=$('#rem2Body'), rem2Color=$('#rem2Color');
const rem3Title=$('#rem3Title'), rem3Body=$('#rem3Body'), rem3Color=$('#rem3Color');
const footerLine=$('#footerLine'), footerName=$('#footerName');

const sepsWrap = $('#seps'); const sepColor = $('#sepColor');

const buildAll   = $('#buildAll');
const printPdf   = $('#printPdf');
const exportImgs = $('#exportImgs');
const exportCsv  = $('#exportCsv');
const pagesWrap  = $('#pages');

// ===== مرافقة: توليد أسابيع مع أو بدون تاريخ =====
function genWeeks(){
  const n = Math.max(1, Math.min(52, parseInt(weeks.value || state.weeks)));
  const mode = weekMode.value;
  const start = startDate.value ? new Date(startDate.value) : null;
  const result = [];
  for(let i=0;i<n;i++){
    if(mode==='label'){ result.push(`الأسبوع ${i+1}`); continue; }
    if(mode==='number'){ result.push(`${i+1}`); continue; }
    // range:
    if(start){
      const s = new Date(start); s.setDate(s.getDate() + i*7);
      const e = new Date(s); e.setDate(e.getDate()+4); // خمسة أيام
      result.push(fmtRange(s,e));
    }else{
      result.push(`الأسبوع ${i+1}`);
    }
  }
  return result;
}
function fmtRange(s,e){
  const pad = (x)=> String(x).padStart(2,'0');
  const sd = `${pad(s.getDate())}/${pad(s.getMonth()+1)}`; 
  const ed = `${pad(e.getDate())}/${pad(e.getMonth()+1)}`;
  return `${sd} – ${ed}`;
}

// ===== مُحرّر الأعمدة (سحب/لون/إخفاء/حذف) =====
function renderCols(){
  colsWrap.innerHTML = '';
  state.columns.forEach((c, idx)=>{
    const row = document.createElement('div');
    row.className = 'col-item'; row.draggable = true; row.dataset.index = idx;

    row.innerHTML = `
      <span class="drag" title="سحب">⠿</span>
      <input class="col-title" value="${c.title}">
      <input class="swatch" type="color" value="${c.color}">
      <button class="btn" data-act="hide">${c.hidden?'إظهار':'إخفاء'}</button>
      <button class="btn" data-act="del">حذف</button>
    `;

    // أحداث
    row.addEventListener('dragstart', e=>{
      row.classList.add('ghost'); e.dataTransfer.setData('text/plain', idx);
    });
    row.addEventListener('dragend', ()=> row.classList.remove('ghost'));
    row.addEventListener('dragover', e=> e.preventDefault());
    row.addEventListener('drop', e=>{
      e.preventDefault();
      const from = parseInt(e.dataTransfer.getData('text/plain'));
      const to   = parseInt(row.dataset.index);
      if(from===to) return;
      const moved = state.columns.splice(from,1)[0];
      state.columns.splice(to,0,moved);
      renderCols(); renderMiniPreview();
    });

    row.querySelector('.col-title').addEventListener('input', ev=>{
      c.title = ev.target.value.trim() || c.title;
      renderMiniPreview();
    });
    row.querySelector('.swatch').addEventListener('input', ev=>{
      c.color = ev.target.value;
      renderMiniPreview();
    });
    row.querySelector('[data-act="hide"]').addEventListener('click', ()=>{
      c.hidden = !c.hidden; renderCols(); renderMiniPreview();
    });
    row.querySelector('[data-act="del"]').addEventListener('click', ()=>{
      if(state.columns.length<=1){ toast('يجب أن يبقى عمود واحد على الأقل'); return; }
      state.columns.splice(idx,1); renderCols(); renderMiniPreview();
    });

    colsWrap.appendChild(row);
  });
}
addCol.addEventListener('click', ()=>{
  const t = newCol.value.trim();
  if(!t) return;
  state.columns.push({ id: 'c'+Date.now(), title:t, color:'#f8fafc', hidden:false });
  newCol.value=''; renderCols(); renderMiniPreview();
});

// ===== معاينة صغيرة لطالبين =====
function renderMiniPreview(){
  const weeksArr = genWeeks();
  // طالبين افتراضيين للمعاينة
  const students = ['— اسم الطالب ١ —', '— اسم الطالب ٢ —'];
  const visibleCols = state.columns.filter(c=>!c.hidden);

  const tbl = document.createElement('table');
  tbl.className = 'print-table'; tbl.style.borderRadius = state.rowRadius+'px';

  const thead = document.createElement('thead');
  const hr1 = document.createElement('tr');
  hr1.innerHTML = `<th class="name-col">الاسم</th>` + weeksArr.map(w=>`<th class="week-col">${w}</th>`).join('');
  thead.appendChild(hr1);

  const hr2 = document.createElement('tr');
  hr2.innerHTML = `<th></th>` + weeksArr.map(_=>`<th>${visibleCols.map(col=>`<div style="display:inline-block;min-width:42px;margin:2px 3px;padding:2px 4px;border-radius:6px;background:${col.color}">${col.title}</div>`).join('')}</th>`).join('');
  thead.appendChild(hr2);

  tbl.appendChild(thead);

  const tb = document.createElement('tbody');
  students.forEach(n=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td style="text-align:right;padding-inline:8px">${n}</td>` + weeksArr.map(_=>{
      const cell = document.createElement('td');
      cell.appendChild(sampleCell());
      return cell.outerHTML;
    }).join('');
    tb.appendChild(tr);
  });
  tbl.appendChild(tb);

  miniPrev.innerHTML = '';
  miniPrev.appendChild(tbl);
}
function sampleCell(){
  const wrap = document.createElement('div');
  if(state.cellStyle==='empty'){ return wrap; }
  if(state.cellStyle==='dots'){
    for(let i=0;i<visibleColsCount();i++){ const d=document.createElement('span'); d.className='cell-dot'; d.style.margin='0 2px'; wrap.appendChild(d); }
    return wrap;
  }
  if(state.cellStyle==='squares'){
    for(let i=0;i<visibleColsCount();i++){ const d=document.createElement('span'); d.className='cell-square'; d.style.margin='0 2px'; wrap.appendChild(d); }
    return wrap;
  }
  if(state.cellStyle==='marks'){ wrap.innerHTML='&nbsp;<span class="cell-mark">✓</span>&nbsp;<span class="cell-mark">✗</span>'; return wrap; }
}
function visibleColsCount(){ return state.columns.filter(c=>!c.hidden).length || 1; }

// ===== الفصول وأسماؤها =====
function renderClassesUI(){
  classLists.innerHTML = '';
  sepsWrap.innerHTML = '';
  for(let i=0;i<state.classCount;i++){
    if(!state.classes[i]) state.classes[i]={ name:`الفصل ${i+1}`, students:[] };
    if(!state.seps[i]) state.seps[i]={ title:`الفصل ${i+1}`, color: sepColor.value };

    const box = document.createElement('div'); box.className='field';
    box.innerHTML = `
      <label>أسماء الطلاب – ${state.classes[i].name}</label>
      <textarea data-idx="${i}" rows="10" placeholder="اكتب اسمًا في كل سطر"></textarea>
    `;
    classLists.appendChild(box);

    const s = document.createElement('div'); s.className='field';
    s.innerHTML = `
      <label>فاصل ${i+1}</label>
      <input data-idx="${i}" data-role="sep-title" value="${state.seps[i].title}">
      <input type="color" data-idx="${i}" data-role="sep-color" value="${state.seps[i].color}">
    `;
    sepsWrap.appendChild(s);
  }
  // تعبئة النصوص لو في ذاكرة
  $$('#classLists textarea').forEach((ta,i)=>{
    ta.value = state.classes[i].students.join('\n');
    ta.addEventListener('input', e=>{
      const names = e.target.value.split('\n').map(x=>x.trim()).filter(Boolean);
      state.classes[i].students = dedupe(names);
    });
  });
  // فواصل
  $$('#seps [data-role="sep-title"]').forEach(inp=>{
    inp.addEventListener('input', e=>{
      state.seps[e.target.dataset.idx].title = e.target.value;
    });
  });
  $$('#seps [data-role="sep-color"]').forEach(inp=>{
    inp.addEventListener('input', e=>{
      state.seps[e.target.dataset.idx].color = e.target.value;
    });
  });
}
function dedupe(arr){ const seen=new Set(); const out=[]; for(const x of arr){ if(!seen.has(x)){ seen.add(x); out.push(x); } } return out; }

// ===== بناء صفحات الطباعة =====
function buildPages(){
  pagesWrap.innerHTML = '';
  const orient = orientation.value;

  // 1) الغلاف
  pagesWrap.appendChild(buildCover(orient));

  // 2) التذكيرات
  pagesWrap.appendChild(buildReminders(orient));

  // 3) فواصل + جداول
  const weeksArr = genWeeks();
  state.classes.forEach((cls, i)=>{
    pagesWrap.appendChild(buildSeparator(orient, state.seps[i]?.title || `الفصل ${i+1}`, state.seps[i]?.color || sepColor.value));
    pagesWrap.appendChild(buildClassTable(orient, cls, weeksArr));
  });

  toast('تم تجهيز الصفحات. يمكنك الطباعة أو التصدير الآن.');
}

function buildCover(orient){
  const p = document.createElement('section');
  p.className = 'a4 ' + (orient==='landscape'?'landscape':'');

  // خلفية
  p.style.background = state.cover.bgColor;

  // صورة خلفية
  if(state.cover.bgImage){
    const bg = document.createElement('div');
    bg.style.position='absolute'; bg.style.inset='0'; bg.style.opacity=state.cover.bgOpacity;
    bg.style.background=`center/cover no-repeat url(${state.cover.bgImage})`;
    p.appendChild(bg);
  }

  const top = document.createElement('div'); top.style.position='relative'; top.style.zIndex='2';
  top.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:18px">
      <div style="flex:1; text-align:${posToAlign(state.cover.schoolLogoPos)}">${state.cover.schoolLogo?`<img src="${state.cover.schoolLogo}" style="max-height:54px">`:''}</div>
      <div style="flex:1; text-align:center"><h2 class="page-title" style="font-size:34px">سِجل المتابعة</h2></div>
      <div style="flex:1; text-align:${posToAlign(state.cover.moeLogoPos)}">${state.cover.moeLogo?`<img src="${state.cover.moeLogo}" style="max-height:54px">`:''}</div>
    </div>

    <div style="margin-top:30mm; text-align:center">
      <h3 style="margin:0 0 10px; font-size:28px; color:#1e40af; font-weight:800">${state.projectTitle||'مُتَّسِق'}</h3>
      <div style="display:grid; gap:8px; max-width:420px; margin:0 auto">
        ${lineOrNull(state.cover.teacherName,'اسم المعلم/ـة')}
        ${lineOrNull(state.cover.schoolName,'المدرسة')}
        ${lineOrNull(state.cover.subjectName,'المادة')}
        ${lineOrNull(state.cover.semesterName,'الفصل الدراسي')}
        ${lineOrNull(state.cover.stageName,'المرحلة الدراسية')}
      </div>
    </div>

    <div style="position:absolute; bottom:18mm; inset-inline:0; text-align:center">
      <div style="color:#475569; font-weight:700">${state.rem.footerLine}</div>
      <div style="margin-top:4px; color:#334155">${state.rem.footerName}</div>
    </div>
  `;
  p.appendChild(top);
  return p;
}

function buildReminders(orient){
  const p = document.createElement('section');
  p.className = 'a4 ' + (orient==='landscape'?'landscape':'');
  const g = document.createElement('div'); g.className='grid-3';

  const boxes = [
    {t:state.rem.r1.title, b:state.rem.r1.body, c:state.rem.r1.color},
    {t:state.rem.r2.title, b:state.rem.r2.body, c:state.rem.r2.color},
    {t:state.rem.r3.title, b:state.rem.r3.body, c:state.rem.r3.color},
  ];

  const title = document.createElement('h2'); title.className='page-title'; title.textContent='التذكيرات';
  p.appendChild(title);

  boxes.forEach(x=>{
    const d = document.createElement('div'); d.className='rem-box'; d.style.background=x.c;
    d.innerHTML = `<h3 style="margin:0 0 6px">${x.t||''}</h3>
                   <div style="white-space:pre-wrap; min-height:140px">${(x.b||'').trim()}</div>`;
    g.appendChild(d);
  });
  p.appendChild(g);

  // تذييل
  const foot = document.createElement('div'); foot.style.position='absolute'; foot.style.bottom='18mm'; foot.style.insetInline='0'; foot.style.textAlign='center';
  foot.innerHTML = `<div style="color:#475569; font-weight:700">${state.rem.footerLine}</div><div style="margin-top:4px; color:#334155">${state.rem.footerName}</div>`;
  p.appendChild(foot);

  return p;
}

function buildSeparator(orient, title, color){
  const p = document.createElement('section');
  p.className = 'a4 ' + (orient==='landscape'?'landscape':'');
  p.style.background = color || '#f1f5f9';
  const h = document.createElement('div'); h.className='sep-title'; h.textContent = title;
  p.appendChild(h);
  return p;
}

function buildClassTable(orient, cls, weeksArr){
  const host = document.createElement('section');
  host.className = 'a4 ' + (orient==='landscape'?'landscape':'');
  const pageTitle = document.createElement('h2'); pageTitle.className='page-title'; pageTitle.textContent = cls.name || 'فصل';
  host.appendChild(pageTitle);

  const visibleCols = state.columns.filter(c=>!c.hidden);
  const strips = chunk(weeksArr, 10);

  (cls.students||[]).forEach((studentName)=>{
    strips.forEach((weeks10, stripIndex)=>{
      const strip = document.createElement('div'); strip.className='strip';

      const head = document.createElement('div'); head.className='head';
      head.innerHTML = `
        <div>اسم الطالب</div>
        <div>مشروع</div>
        <div>اختبار</div>
        <div>بونس</div>
        <div>الأسابيع ${stripIndex*10+1}–${stripIndex*10+weeks10.length}</div>`;
      strip.appendChild(head);

      const row = document.createElement('div'); row.className='row';

      const cName = document.createElement('div'); cName.className='cell meta-title'; cName.textContent = studentName || '';
      const cProj = document.createElement('div'); cProj.className='cell meta-box';
      const cExam = document.createElement('div'); cExam.className='cell meta-box';
      const cBonus= document.createElement('div'); cBonus.className='cell meta-box';

      const cWeeks = document.createElement('div'); cWeeks.className='cell right';
      const weeksGrid = document.createElement('div'); weeksGrid.className='weeks';

      weeks10.forEach((wTitle)=>{
        const w = document.createElement('div'); w.className='week';
        const wt = document.createElement('div'); wt.className='wtitle'; wt.textContent = wTitle;
        w.appendChild(wt);

        const crits = document.createElement('div'); crits.className='criteria';
        visibleCols.forEach(col=>{
          const cr = document.createElement('div'); cr.className='crit';
          const badge = document.createElement('span'); badge.className='badge-col';
          badge.style.background = col.color; badge.textContent = col.title;
          const d5 = fiveDaysCell(state.cellStyle);
          cr.appendChild(badge); cr.appendChild(d5);
          crits.appendChild(cr);
        });

        w.appendChild(crits);
        weeksGrid.appendChild(w);
      });

      cWeeks.appendChild(weeksGrid);
      row.appendChild(cName);
      row.appendChild(cProj);
      row.appendChild(cExam);
      row.appendChild(cBonus);
      row.appendChild(cWeeks);

      strip.appendChild(row);
      host.appendChild(strip);
    });
  });

  const foot = document.createElement('div');
  foot.style.position='absolute'; foot.style.bottom='10mm'; foot.style.insetInline='0'; foot.style.textAlign='center';
  foot.innerHTML = `<div style="color:#475569; font-weight:700">${state.rem.footerLine}</div><div style="margin-top:4px; color:#334155">${state.rem.footerName}</div>`;
  host.appendChild(foot);

  return host;
}
function fiveDaysCell(style){
  const wrap = document.createElement('div'); wrap.className='d5';
  if(style==='marks'){
    wrap.innerHTML = '<span class="mk">✓</span><span class="mk">✗</span><span class="mk">&nbsp;</span><span class="mk">&nbsp;</span><span class="mk">&nbsp;</span>';
    return wrap;
  }
  for(let i=0;i<5;i++){
    const d = document.createElement('span');
    d.className = (style==='squares' ? 'sq' : 'dot');
    wrap.appendChild(d);
  }
  return wrap;
}
function renderCellGroup(style, count){
  if (style === 'empty') return '';
  let html = '';
  for (let i = 0; i < count; i++) {
    html += fiveDaysCell(style).outerHTML; // كل عمود تقييم = 5 أيام
  }
  return html;
}

function posToAlign(pos){ return pos==='right'?'right':pos==='left'?'left':'center'; }
function lineOrNull(val, label){
  if(!val) return '';
  return `<div style="display:flex; gap:8px; justify-content:center"><div class="chip-note">${label}</div><div>${val}</div></div>`;
}

// ===== ربط واجهة ← حالة
orientation.addEventListener('change', ()=> state.orientation = orientation.value);
cellStyle.addEventListener('change', ()=>{ state.cellStyle=cellStyle.value; renderMiniPreview(); });
rowRadius.addEventListener('input', ()=>{ state.rowRadius=parseInt(rowRadius.value||6); renderMiniPreview(); });
weeks.addEventListener('input', ()=> renderMiniPreview());
weekMode.addEventListener('change', ()=> renderMiniPreview());
startDate.addEventListener('change', ()=> renderMiniPreview());

classCount.addEventListener('change', ()=>{
  state.classCount = parseInt(classCount.value||2);
  state.classes.length = state.classCount;
  state.seps.length = state.classCount;
  for(let i=0;i<state.classCount;i++){
    if(!state.classes[i]) state.classes[i]={ name:`الفصل ${i+1}`, students:[] };
    if(!state.seps[i]) state.seps[i]={ title:`الفصل ${i+1}`, color: sepColor.value };
  }
  renderClassesUI();
});
projectTitle.addEventListener('input', ()=> state.projectTitle = projectTitle.value);

// غلاف
schoolLogo.addEventListener('change', e=> fileToDataURL(e.target.files[0]).then(url=>{ state.cover.schoolLogo=url; }));
schoolLogoPos.addEventListener('change', ()=> state.cover.schoolLogoPos = schoolLogoPos.value);
moeLogo.addEventListener('change', e=> fileToDataURL(e.target.files[0]).then(url=>{ state.cover.moeLogo=url; }));
moeLogoPos.addEventListener('change', ()=> state.cover.moeLogoPos = moeLogoPos.value);

teacherName.addEventListener('input', ()=> state.cover.teacherName = teacherName.value);
schoolName .addEventListener('input', ()=> state.cover.schoolName  = schoolName.value);
subjectName.addEventListener('input', ()=> state.cover.subjectName = subjectName.value);
semesterName.addEventListener('input',()=> state.cover.semesterName= semesterName.value);
stageName   .addEventListener('input',()=> state.cover.stageName   = stageName.value);

coverBg.addEventListener('change', e=> fileToDataURL(e.target.files[0]).then(url=>{ state.cover.bgImage=url; }));
coverOpacity.addEventListener('input', ()=> state.cover.bgOpacity = parseFloat(coverOpacity.value));
coverColor.addEventListener('input', ()=> state.cover.bgColor   = coverColor.value);

// تذكيرات
rem1Title.addEventListener('input', ()=> state.rem.r1.title = rem1Title.value);
rem1Body .addEventListener('input', ()=> state.rem.r1.body  = rem1Body.value);
rem1Color.addEventListener('input', ()=> state.rem.r1.color = rem1Color.value);
rem2Title.addEventListener('input', ()=> state.rem.r2.title = rem2Title.value);
rem2Body .addEventListener('input', ()=> state.rem.r2.body  = rem2Body.value);
rem2Color.addEventListener('input', ()=> state.rem.r2.color = rem2Color.value);
rem3Title.addEventListener('input', ()=> state.rem.r3.title = rem3Title.value);
rem3Body .addEventListener('input', ()=> state.rem.r3.body  = rem3Body.value);
rem3Color.addEventListener('input', ()=> state.rem.r3.color = rem3Color.value);
footerLine.addEventListener('input', ()=> state.rem.footerLine = footerLine.value);
footerName.addEventListener('input', ()=> state.rem.footerName = footerName.value);

// فواصل
sepColor.addEventListener('input', ()=>{/* اللون الافتراضي فقط */});

// بناء وتصدير
buildAll.addEventListener('click', ()=>{
  buildPages();
  // تسجيل استخدام (اختياري معلّق)
  // window.supaLogToolUsage && supaLogToolUsage('mutasiq:build');
});
printPdf.addEventListener('click', ()=>{
  if(!pagesWrap.children.length) buildPages();
  window.print();
  // window.supaLogToolUsage && supaLogToolUsage('mutasiq:export:pdf');
});
exportImgs.addEventListener('click', async ()=>{
  if(!pagesWrap.children.length) buildPages();
  // حفظ كل صفحة كصورة عبر toBlob من canvas (بدون مكتبات خارجية نستخدم html2canvas؟ غير مضمن)
  // حل خفيف: نفتح نافذة طباعة "كصورة" صعب بدون html2canvas، لذا نحفظ كـ PDF عبر الطباعة.
  alert('لحفظ كصور يُفضّل استخدام PDF ثم التحويل لصور. (يمكن إضافة html2canvas لاحقًا).');
});
exportCsv.addEventListener('click', ()=>{
  const csv = buildCsv();
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download = (state.projectTitle||'mutasiq') + '.csv'; a.click();
});

// ===== CSV (بيانات فقط) =====
function buildCsv(){
  const weeksArr = genWeeks();
  const visibleCols = state.columns.filter(c=>!c.hidden).map(c=>c.title);
  const head = ['الفصل','اسم الطالب', ...weeksArr.flatMap(w=>visibleCols.map(t=>`${w}-${t}`))];
  const rows = [head];

  state.classes.forEach((cls, idx)=>{
    (cls.students||[]).forEach(st=>{
      const arr = [cls.name||`الفصل ${idx+1}`, st];
      // خلايا فارغة
      for(let i=0;i<weeksArr.length*visibleCols.length;i++) arr.push('');
      rows.push(arr);
    });
  });

  return rows.map(r=>r.map(x=> `"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');
}
// ===== أدوات مساعدة =====
function fileToDataURL(file){
  return new Promise((res,rej)=>{
    if(!file) return res(null);
    const fr=new FileReader();
    fr.onload = ()=> res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

function chunk(arr, size=10){
  const out=[];
  for(let i=0;i<arr.length;i+=size) out.push(arr.slice(i,i+size));
  return out;
}

// 5 أيّام داخل كل خلية أسبوع (حسب النمط المختار)
function fiveDaysCell(style){
  const wrap = document.createElement('div'); wrap.className='d5';
  if(style==='marks'){
    wrap.innerHTML = '<span class="mk">✓</span><span class="mk">✗</span><span class="mk">&nbsp;</span><span class="mk">&nbsp;</span><span class="mk">&nbsp;</span>';
    return wrap;
  }
  for(let i=0;i<5;i++){
    const d = document.createElement('span');
    d.className = (style==='squares' ? 'sq' : 'dot');
    wrap.appendChild(d);
  }
  return wrap;
}

// تهيئة أولية// تهيئة أولية
(function init(){
  // تحميل من LocalStorage لو رغبتِ مستقبلًا
  renderCols(); renderMiniPreview();
  renderClassesUI();

  // قيم واجهة من الحالة
  orientation.value = state.orientation;
  cellStyle.value   = state.cellStyle;
  rowRadius.value   = state.rowRadius;
  weeks.value       = state.weeks;
  weekMode.value    = state.weekMode;

  classCount.value  = state.classCount;
  projectTitle.value= state.projectTitle;

  schoolLogoPos.value = state.cover.schoolLogoPos;
  moeLogoPos.value    = state.cover.moeLogoPos;
  coverOpacity.value  = state.cover.bgOpacity;
  coverColor.value    = state.cover.bgColor;

  rem1Title.value=state.rem.r1.title; rem1Color.value=state.rem.r1.color;
  rem2Title.value=state.rem.r2.title; rem2Color.value=state.rem.r2.color;
  rem3Title.value=state.rem.r3.title; rem3Color.value=state.rem.r3.color;
  footerLine.value=state.rem.footerLine; footerName.value=state.rem.footerName;
})();
})(); // إغلاق القوس الكبير
