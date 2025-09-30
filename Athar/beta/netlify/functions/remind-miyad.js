// netlify/functions/miyad-cron.js  (ESM)

// ========== SMTP (Zoho) ==========
import nodemailer from 'nodemailer';

// ========== Supabase (Service Role) ==========
import { createClient } from '@supabase/supabase-js';

// استخدمي SERVICE_ROLE هنا لأنه يتجاوز RLS في الوظائف المجدولة
const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  {
    auth: { persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE}` }
    }
  }
);

// إعداد ناقل البريد عبر SMTP (Zoho)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,                       // مثال: smtp.zoho.com
  port: Number(process.env.SMTP_PORT) || 465,        // 465 SSL أو 587 TLS
  secure: String(process.env.SMTP_PORT) === '465',   // true إذا 465
  auth: {
    user: process.env.SMTP_USER,                     // بريدك في Zoho
    pass: process.env.SMTP_PASS                      // App Password من Zoho
  }
});

// العنوان المُرسِل: إن وجد EMAIL_FROM استخدميه، وإلا بريد SMTP_USER
const FROM_EMAIL = process.env.EMAIL_FROM || process.env.SMTP_USER;

// إرسال رسالة بريد
async function sendEmail(to, subject, html) {
  return transporter.sendMail({
    from: FROM_EMAIL,
    to,
    subject,
    html
  });
}

// ========== أدوات وقت/تاريخ ==========
function todayUTC() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function addDaysUTC(base, days) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
function fmtDate(d) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ========== الـ Handler المجدول ==========
export const handler = async () => {
  // 1) جلب إعدادات التذكير المُفعّلة
  const { data: settings, error: sErr } = await sb
    .from('miyad_settings')
    .select('user_id,email,reminders_enabled,remind_days_before')
    .eq('reminders_enabled', true);

  if (sErr) {
    console.error('settings error:', sErr);
    return { statusCode: 500, body: sErr.message };
  }
  if (!settings?.length) return { statusCode: 200, body: 'no settings' };

  const base = todayUTC();

  // 2) لكل مستخدم: حددي تاريخ الهدف (اليوم + X أيام) واجلبي أحداثه
  for (const st of settings) {
    if (!st.email) continue;

    const daysBefore = st.remind_days_before ?? 2;
    const targetDate = fmtDate(addDaysUTC(base, daysBefore));

    const { data: events, error: eErr } = await sb
      .from('miyad_events')
      .select('id,user_id,subj,class,day,slot,date,color')
      .eq('user_id', st.user_id)
      .eq('date', targetDate);

    if (eErr) {
      console.error('events error:', eErr);
      continue;
    }
    if (!events?.length) continue;

    // 3) بناء الإيميل وإرساله
    const rows = events
      .map(
        (e) =>
          `<li><strong>${e.subj}</strong> — فصل ${e.class} — ${e.day} (حصة ${e.slot}) — ${e.date}</li>`
      )
      .join('');

    const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto;line-height:1.6">
      <h2 style="margin:0 0 8px">تذكير مِيعاد — بعد ${daysBefore} يوم(أيام)</h2>
      <p>المواعيد بتاريخ <strong>${targetDate}</strong>:</p>
      <ul>${rows}</ul>
    </div>`;

    try {
      await sendEmail(
        st.email,
        `تذكير مواعيد — بعد ${daysBefore} يوم`,
        html
      );
    } catch (err) {
      console.error('sendEmail error:', err);
    }
  }

  return { statusCode: 200, body: 'ok' };
};

// 4) جدول التشغيل اليومي (06:00 UTC) — عدلي التوقيت إذا تبين
export const config = { schedule: '0 6 * * *' };
