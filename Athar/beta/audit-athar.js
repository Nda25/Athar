// tools/audit-athar.js
// يفحص المشروع سطر-سطر ويطبع تقرير لكل ملف: كامل/يحتاج تعديل + السبب
// تشغيل: node tools/audit-athar.js

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const GLOB_DIRS = [
  '',                     // الجذر
  'assets', 'assets/js',
  'netlify', 'netlify/functions'
];
const EXT = new Set(['.js', '.mjs', '.cjs', '.html', '.htm', '.ts']);

const checks = [
  {
    id: 'ellipsis',
    label: 'يحتوي مقاطع مبتورة (…) أو ...',
    test: (s) => /(\u2026|(^|\s)\.\.\.(\s|$))/.test(s),
    fix: 'استبدال المقاطع المبتورة بنسخ كاملة بدون … أو ...'
  },
  {
    id: 'audience-old',
    label: 'Audience خاطئ (api.athar)',
    test: (s) => /getToken\s*\(\s*\{\s*audience:\s*["']https?:\/\/api\.athar["']\s*\}\s*\)/.test(s),
    fix: 'بدّلي إلى audience: "https://api.n-athar" + fallback getTokenSilently'
  },
  {
    id: 'audience-missing-fallback',
    label: 'ينقص fallback لـ getTokenSilently',
    test: (s) => /getToken\s*\(\s*\{\s*audience:\s*["']https?:\/\/api\.n-athar["']\s*\}\s*\)/.test(s) && !/getTokenSilently/.test(s),
    fix: 'أضيفي || await client.getTokenSilently?.().catch(()=>null)'
  },
  {
    id: 'cors-wildcard',
    label: 'CORS نجمي (*) بدل ALLOWED_ORIGIN',
    test: (s, p) => p.includes(path.join('netlify','functions')) && /Access-Control-Allow-Origin['"]?\s*:\s*['"]\*/.test(s),
    fix: 'استخدمي _cors.js مع ALLOWED_ORIGIN من البيئة'
  },
  {
    id: 'missing-cors-helper',
    label: 'يفتقد لاستخدام _cors.js',
    test: (s, p) => p.includes(path.join('netlify','functions')) && !/require\(["']\.\/_cors(\.js)?["']\)/.test(s) && /exports\.handler/.test(s),
    fix: 'أضيفي: const { CORS, preflight } = require("./_cors.js"); واستخدامهما'
  },
  {
    id: 'esm-in-functions',
    label: 'استيراد ESM داخل netlify/functions',
    test: (s, p) => p.includes(path.join('netlify','functions')) && /\bimport\s+[^;]+from\s+['"][^'"]+['"]/.test(s),
    fix: 'حوّلي الملف لصيغة CommonJS (require/module.exports) أو فعّلي ESM للمشروع كامل'
  },
  {
    id: 'miyad-no-schedule',
    label: 'وظيفة ميعاد بلا جدول تشغيل',
    test: (s, p) => p.endsWith(path.join('netlify','functions','remind-miyad.js')) && !fs.existsSync(path.join(ROOT,'netlify.toml')),
    fix: 'أضيفي [[scheduled.functions]] في netlify.toml (كرون)'
  },
  {
    id: 'announcement-missing-mount',
    label: 'لا يوجد كود عرض للإعلان في الواجهة',
    test: (s, p) => (p.endsWith('.html') || p.includes(path.join('assets','js'))) && !/admin-announcement\?latest=1/.test(s),
    fix: 'أضيفي mountAnnouncementBar() لجلب آخر إعلان وعرضه'
  },
  {
    id: 'profile-invoices-fetch',
    label: 'جلب الفواتير في profile مع جدول غير صحيح أو استعلام قديم',
    test: (s, p) => p.endsWith('profile.html') && /invoices-list/.test(s) && !/from\("invoices"\)/.test(s),
    fix: 'تأكدي أن الوظيفة ترجع من جدول invoices وأن الواجهة تعرض same fields'
  },
  {
    id: 'trial-not-considered',
    label: 'حارس الوصول لا يعتبر trial',
    test: (s, p) => p.includes(path.join('assets','js','require-auth.js')) && !/trial/.test(s),
    fix: 'أضيفي قراءة claim status=trial من ID Token والسماح المؤقت'
  }
];

function listFiles(dir){
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  for (const name of fs.readdirSync(abs)) {
    const p = path.join(abs, name);
    const rel = path.relative(ROOT, p);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      out.push(...listFiles(rel));
    } else {
      if (EXT.has(path.extname(name))) out.push(rel);
    }
  }
  return out;
}

function analyzeFile(rel){
  const p = path.join(ROOT, rel);
  let content = '';
  try { content = fs.readFileSync(p, 'utf8'); } catch { return { file:rel, ok:false, errors:['قراءة الملف فشلت'] }; }
  const hits = [];
  for (const c of checks) {
    try {
      if (c.test(content, rel)) hits.push({ id:c.id, label:c.label, fix:c.fix });
    } catch {}
  }
  return { file: rel, ok: hits.length === 0, issues: hits };
}

function main(){
  let files = [];
  for (const d of GLOB_DIRS) files.push(...listFiles(d));
  files = Array.from(new Set(files)).sort((a,b)=>a.localeCompare(b,'ar'));

  const report = files.map(analyzeFile);

  // طباعة تقرير مختصر
  console.log('ملفات المشروع:', report.length);
  let okCount = 0;
  for (const r of report) {
    if (r.ok) { okCount++; continue; }
    console.log('\n—', r.file);
    for (const is of r.issues) {
      console.log('   ✗', is.label);
      console.log('     ➜', is.fix);
    }
  }
  console.log(`\nالمكتملة بدون مشاكل: ${okCount}/${report.length}`);
  console.log('إن أردتِ JSON كامل: أضيفي > audit.json عند التشغيل وافتحيه بجدول.');

  // إخراج JSON اختياري لعرضه كجدول
  try {
    const outPath = path.join(ROOT, 'audit-report.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\nحُفظ تقرير JSON في: ${outPath}`);
  } catch {}
}

main();// tools/audit-athar.js
// يفحص المشروع سطر-سطر ويطبع تقرير لكل ملف: كامل/يحتاج تعديل + السبب
// تشغيل: node tools/audit-athar.js

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const GLOB_DIRS = [
  '',                     // الجذر
  'assets', 'assets/js',
  'netlify', 'netlify/functions'
];
const EXT = new Set(['.js', '.mjs', '.cjs', '.html', '.htm', '.ts']);

const checks = [
  {
    id: 'ellipsis',
    label: 'يحتوي مقاطع مبتورة (…) أو ...',
    test: (s) => /(\u2026|(^|\s)\.\.\.(\s|$))/.test(s),
    fix: 'استبدال المقاطع المبتورة بنسخ كاملة بدون … أو ...'
  },
  {
    id: 'audience-old',
    label: 'Audience خاطئ (api.athar)',
    test: (s) => /getToken\s*\(\s*\{\s*audience:\s*["']https?:\/\/api\.athar["']\s*\}\s*\)/.test(s),
    fix: 'بدّلي إلى audience: "https://api.n-athar" + fallback getTokenSilently'
  },
  {
    id: 'audience-missing-fallback',
    label: 'ينقص fallback لـ getTokenSilently',
    test: (s) => /getToken\s*\(\s*\{\s*audience:\s*["']https?:\/\/api\.n-athar["']\s*\}\s*\)/.test(s) && !/getTokenSilently/.test(s),
    fix: 'أضيفي || await client.getTokenSilently?.().catch(()=>null)'
  },
  {
    id: 'cors-wildcard',
    label: 'CORS نجمي (*) بدل ALLOWED_ORIGIN',
    test: (s, p) => p.includes(path.join('netlify','functions')) && /Access-Control-Allow-Origin['"]?\s*:\s*['"]\*/.test(s),
    fix: 'استخدمي _cors.js مع ALLOWED_ORIGIN من البيئة'
  },
  {
    id: 'missing-cors-helper',
    label: 'يفتقد لاستخدام _cors.js',
    test: (s, p) => p.includes(path.join('netlify','functions')) && !/require\(["']\.\/_cors(\.js)?["']\)/.test(s) && /exports\.handler/.test(s),
    fix: 'أضيفي: const { CORS, preflight } = require("./_cors.js"); واستخدامهما'
  },
  {
    id: 'esm-in-functions',
    label: 'استيراد ESM داخل netlify/functions',
    test: (s, p) => p.includes(path.join('netlify','functions')) && /\bimport\s+[^;]+from\s+['"][^'"]+['"]/.test(s),
    fix: 'حوّلي الملف لصيغة CommonJS (require/module.exports) أو فعّلي ESM للمشروع كامل'
  },
  {
    id: 'miyad-no-schedule',
    label: 'وظيفة ميعاد بلا جدول تشغيل',
    test: (s, p) => p.endsWith(path.join('netlify','functions','remind-miyad.js')) && !fs.existsSync(path.join(ROOT,'netlify.toml')),
    fix: 'أضيفي [[scheduled.functions]] في netlify.toml (كرون)'
  },
  {
    id: 'announcement-missing-mount',
    label: 'لا يوجد كود عرض للإعلان في الواجهة',
    test: (s, p) => (p.endsWith('.html') || p.includes(path.join('assets','js'))) && !/admin-announcement\?latest=1/.test(s),
    fix: 'أضيفي mountAnnouncementBar() لجلب آخر إعلان وعرضه'
  },
  {
    id: 'profile-invoices-fetch',
    label: 'جلب الفواتير في profile مع جدول غير صحيح أو استعلام قديم',
    test: (s, p) => p.endsWith('profile.html') && /invoices-list/.test(s) && !/from\("invoices"\)/.test(s),
    fix: 'تأكدي أن الوظيفة ترجع من جدول invoices وأن الواجهة تعرض same fields'
  },
  {
    id: 'trial-not-considered',
    label: 'حارس الوصول لا يعتبر trial',
    test: (s, p) => p.includes(path.join('assets','js','require-auth.js')) && !/trial/.test(s),
    fix: 'أضيفي قراءة claim status=trial من ID Token والسماح المؤقت'
  }
];

function listFiles(dir){
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  for (const name of fs.readdirSync(abs)) {
    const p = path.join(abs, name);
    const rel = path.relative(ROOT, p);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      out.push(...listFiles(rel));
    } else {
      if (EXT.has(path.extname(name))) out.push(rel);
    }
  }
  return out;
}

function analyzeFile(rel){
  const p = path.join(ROOT, rel);
  let content = '';
  try { content = fs.readFileSync(p, 'utf8'); } catch { return { file:rel, ok:false, errors:['قراءة الملف فشلت'] }; }
  const hits = [];
  for (const c of checks) {
    try {
      if (c.test(content, rel)) hits.push({ id:c.id, label:c.label, fix:c.fix });
    } catch {}
  }
  return { file: rel, ok: hits.length === 0, issues: hits };
}

function main(){
  let files = [];
  for (const d of GLOB_DIRS) files.push(...listFiles(d));
  files = Array.from(new Set(files)).sort((a,b)=>a.localeCompare(b,'ar'));

  const report = files.map(analyzeFile);

  // طباعة تقرير مختصر
  console.log('ملفات المشروع:', report.length);
  let okCount = 0;
  for (const r of report) {
    if (r.ok) { okCount++; continue; }
    console.log('\n—', r.file);
    for (const is of r.issues) {
      console.log('   ✗', is.label);
      console.log('     ➜', is.fix);
    }
  }
  console.log(`\nالمكتملة بدون مشاكل: ${okCount}/${report.length}`);
  console.log('إن أردتِ JSON كامل: أضيفي > audit.json عند التشغيل وافتحيه بجدول.');

  // إخراج JSON اختياري لعرضه كجدول
  try {
    const outPath = path.join(ROOT, 'audit-report.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\nحُفظ تقرير JSON في: ${outPath}`);
  } catch {}
}

main();
