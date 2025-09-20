// netlify/functions/miyad-cron.js  (ESM)
import { createClient } from '@supabase/supabase-js';

// استخدمي SERVICE_ROLE هنا (يفك RLS ويقرأ كل المستخدمين)
const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE}` } }
  }
);

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM     = process.env.EMAIL_FROM; // <-- غيّرت الاسم ليتطابق مع المتغير

function todayUTC(){ const d=new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); }
function addDaysUTC(base, days){ const d=new Date(base); d.setUTCDate(d.getUTCDate()+days); return d; }
function fmtDate(d){ return d.toISOString().slice(0,10); }

async function sendEmail(to, subject, html){
  const res = await fetch('https://api.resend.com/emails', {
    method:'POST',
    headers:{ 'Authorization':`Bearer ${RESEND_API_KEY}`, 'Content-Type':'application/json' },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, html })
  });
  if(!res.ok) throw new Error(await res.text());
}

export const handler = async () => {
  const { data: settings, error: sErr } = await sb
    .from('miyad_settings')
    .select('user_id,email,reminders_enabled,remind_days_before')
    .eq('reminders_enabled', true);

  if (sErr) return { statusCode:500, body:sErr.message };
  if (!settings?.length) return { statusCode:200, body:'no settings' };

  const base = todayUTC();

  for (const st of settings){
    if(!st.email) continue;
    const daysBefore = st.remind_days_before ?? 2;
    const target = fmtDate(addDaysUTC(base, daysBefore));

    const { data: events, error: eErr } = await sb
      .from('miyad_events')
      .select('id,user_id,subj,class,day,slot,date,color')
      .eq('user_id', st.user_id)
      .eq('date', target);

    if (eErr || !events?.length) continue;

    const rows = events.map(e=>`<li><strong>${e.subj}</strong> — فصل ${e.class} — ${e.day} (حصة ${e.slot}) — ${e.date}</li>`).join('');
    const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto">
      <h2>تذكير مِيعاد — بعد ${daysBefore} يوم(أيام)</h2>
      <ul>${rows}</ul>
    </div>`;

    try{ await sendEmail(st.email, `تذكير مواعيد — بعد ${daysBefore} يوم`, html); }catch(e){ console.error(e); }
  }

  return { statusCode:200, body:'ok' };
};

// شغّليها يوميًا 06:00 UTC (عدّلي الوقت حسب حاجتك)
export const config = { schedule: '0 6 * * *' };
