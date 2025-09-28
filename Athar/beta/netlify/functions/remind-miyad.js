// netlify/functions/remind-miyad.js  (CJS + يعمل مع Netlify Scheduler)
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE}` } }
});

function tx(){
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

exports.handler = async () => {
  const { data: settings, error: sErr } = await sb
    .from('miyad_settings')
    .select('user_id,email,reminders_enabled,remind_days_before')
    .eq('reminders_enabled', true);
  if (sErr) return { statusCode: 500, body: sErr.message };

  const today = new Date(); const mails = [];
  for (const s of (settings||[])) {
    const days = Math.min(Math.max(Number(s.remind_days_before||2),1),14);
    const target = new Date(today); target.setDate(target.getDate()+days);
    const { data: events } = await sb.from('miyad_events')
      .select('subj,class,date')
      .eq('user_id', s.user_id)
      .eq('date', target.toISOString().slice(0,10));
    if (!events || !events.length) continue;

    const html = `<p>تذكير بعد ${days} يوم:</p><ul>${events.map(e=>`<li>${e.date} — ${e.subj} (${e.class})</li>`).join('')}</ul>`;
    mails.push({ to: s.email, subject: 'تذكير مواعيد — أثر', html });
  }
  if (!mails.length) return { statusCode: 200, body: JSON.stringify({ ok:true, sent:0 }) };

  const transporter = tx(); let sent=0;
  for (const m of mails) { await transporter.sendMail({ from: process.env.EMAIL_FROM, ...m }); sent++; }
  return { statusCode: 200, body: JSON.stringify({ ok:true, sent }) };
};
