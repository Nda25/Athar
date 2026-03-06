// netlify/functions/remind-miyad.js  (ESM)
// Scheduled daily cron — sends Miaad reminder emails

// ========== SMTP (Zoho) ==========
import nodemailer from "nodemailer";

// ========== Supabase (Service Role) ==========
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  {
    auth: { persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE}` },
    },
  },
);

// إعداد ناقل البريد عبر SMTP (Zoho)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: String(process.env.SMTP_PORT) === "465",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM_EMAIL = process.env.EMAIL_FROM || process.env.SMTP_USER;

async function sendEmail(to, subject, html) {
  return transporter.sendMail({ from: FROM_EMAIL, to, subject, html });
}

// ========== Date helpers ==========
function todayUTC() {
  const d = new Date();
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}
function addDaysUTC(base, days) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

// ========== Email Template ==========
function buildEmailHTML(events, targetDate, daysBefore) {
  const dayLabel = daysBefore === 1 ? "غداً" : `بعد ${daysBefore} أيام`;

  const eventRows = events
    .map(
      (e) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #e5d9b6;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:6px;height:40px;border-radius:3px;background:${e.color || "#628141"};flex-shrink:0; margin-left:10px;"></div>
          <div>
            <div style="font-weight:700;font-size:16px;color:#2c3628;">${e.subj}</div>
            <div style="font-size:13px;color:#5a6b53;margin-top:2px;">
              ${e.day} ${e.class ? `· فصل ${e.class}` : ""} ${e.slot ? `· حصة ${e.slot}` : ""}
            </div>
          </div>
        </div>
      </td>
    </tr>
  `,
    )
    .join("");

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#f9f6ef;font-family:'Cairo',system-ui,-apple-system,sans-serif;direction:rtl;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f6ef;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="padding:24px 32px;background:linear-gradient(135deg,#40513b 0%,#628141 100%);border-radius:16px 16px 0 0;text-align:center;">
              <div style="font-size:36px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;font-family:'Cairo',sans-serif;">أثر</div>
              <div style="font-size:14px;color:rgba(255,255,255,0.85);margin-top:4px;">تذكير مواعيدك</div>
            </td>
          </tr>

          <!-- Main Content Card -->
          <tr>
            <td style="background:#ffffff;padding:0;border-left:1px solid #e2dabc;border-right:1px solid #e2dabc;">

              <!-- Alert Banner -->
              <div style="margin:24px 24px 0;padding:16px 20px;background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);border-radius:12px;border:1px solid #f59e0b33;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:40px;vertical-align:top;">
                      <div style="font-size:28px;line-height:1;">🔔</div>
                    </td>
                    <td style="vertical-align:middle;">
                      <div style="font-size:18px;font-weight:700;color:#92400e;">لديك ${events.length} ${events.length === 1 ? "موعد" : "مواعيد"} ${dayLabel}</div>
                      <div style="font-size:13px;color:#92400e;opacity:0.8;margin-top:2px;">بتاريخ ${targetDate}</div>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Events List -->
              <div style="margin:20px 24px;border-radius:12px;border:1px solid #e5d9b6;overflow:hidden;background:#fafaf5;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:12px 16px;background:#40513b;color:#ffffff;font-size:13px;font-weight:600;">
                      📋 المواعيد القادمة
                    </td>
                  </tr>
                  ${eventRows}
                </table>
              </div>

              <!-- CTA -->
              <div style="text-align:center;padding:8px 24px 28px;">
                <a href="https://n-athar.co/programs/miaad" style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#40513b 0%,#628141 100%);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;font-family:'Cairo',sans-serif;">
                  عرض جميع المواعيد ←
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background:#f4f0e4;border-radius:0 0 16px 16px;border:1px solid #e2dabc;border-top:none;text-align:center;">
              <div style="font-size:12px;color:#5a6b53;line-height:1.8;">
                هذا البريد مُرسل تلقائيًا من <strong style="color:#40513b;">أثر</strong> · ميعاد
                <br>
                يمكنك تعديل إعدادات التذكير من
                <a href="https://n-athar.co/programs/miaad" style="color:#628141;text-decoration:underline;">صفحة ميعاد</a>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// ========== Scheduled Handler ==========
export const handler = async () => {
  // 1) Fetch enabled reminder settings
  const { data: settings, error: sErr } = await sb
    .from("miyad_settings")
    .select("user_id,email,reminders_enabled,remind_days_before")
    .eq("reminders_enabled", true);

  if (sErr) {
    console.error("settings error:", sErr);
    return { statusCode: 500, body: sErr.message };
  }
  if (!settings?.length) return { statusCode: 200, body: "no settings" };

  const base = todayUTC();

  // 2) For each user: calculate target date and fetch matching events
  for (const st of settings) {
    if (!st.email) continue;

    const daysBefore = st.remind_days_before ?? 2;
    const targetDate = fmtDate(addDaysUTC(base, daysBefore));

    const { data: events, error: eErr } = await sb
      .from("miyad_events")
      .select("id,user_id,subj,class,day,slot,date,color")
      .eq("user_id", st.user_id)
      .eq("date", targetDate);

    if (eErr) {
      console.error("events error:", eErr);
      continue;
    }
    if (!events?.length) continue;

    // 3) Build & send the branded email
    const html = buildEmailHTML(events, targetDate, daysBefore);

    try {
      await sendEmail(
        st.email,
        `تذكير مواعيد أثر — ${daysBefore === 1 ? "غداً" : `بعد ${daysBefore} أيام`}`,
        html,
      );
    } catch (err) {
      console.error("sendEmail error:", err);
    }
  }

  return { statusCode: 200, body: "ok" };
};

// 4) Daily schedule at 06:00 UTC (09:00 Saudi time)
export const config = { schedule: "0 6 * * *" };
