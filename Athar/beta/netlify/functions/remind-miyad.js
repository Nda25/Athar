// netlify/functions/remind-miyad.js
const nodemailer = require("nodemailer");
const { createClient } = require("@supabase/supabase-js");

exports.handler = async () => {
  try {
    // ------------ Supabase ------------
    const supa = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    );

    // المستخدمون الذين فعّلوا التذكير
    const { data: users, error: uErr } = await supa
      .from("miyad_settings")
      .select("user_id, email, reminders_enabled, remind_days_before")
      .eq("reminders_enabled", true);

    if (uErr) throw uErr;
    if (!users || users.length === 0) {
      return ok("No users with reminders enabled.");
    }

    // ------------ SMTP ------------
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465, // 465 = TLS
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // رابط «ميعاد»
    const baseURL = (process.env.PUBLIC_BASE_URL || "https://n-athar.co").replace(/\/$/, "");
    const miyadURL = `${baseURL}/miyad`;

    const now = new Date();
    let sent = 0, skipped = 0, failed = 0;

    // ------------ معالجة كل مستخدم ------------
    for (const u of users) {
      if (!u?.email) { skipped++; continue; }

      try {
        const daysBefore = u.remind_days_before ?? 2;

        // نافذة التاريخ المطلوب (بعد X أيام)
        const start = new Date(now);
        start.setDate(start.getDate() + daysBefore);
        start.setHours(0, 0, 0, 0);

        const end = new Date(start);
        end.setHours(23, 59, 59, 999);

        // أحداث المستخدم في ذلك اليوم
        const { data: events, error: eErr } = await supa
          .from("miyad_events")
          .select("title, type, start_at")
          .eq("user_id", u.user_id)
          .gte("start_at", start.toISOString())
          .lte("start_at", end.toISOString());

        if (eErr) throw eErr;

        // لا ترسل إن ما فيه أحداث
        if (!events || events.length === 0) { skipped++; continue; }

        // -------- صياغة القائمة (نص + HTML) --------
        const items = events.map((e) => {
          const when = new Date(e.start_at).toLocaleString("ar-SA");
          const tag =
            e.type === "exam" ? "اختبار" :
            e.type === "task" ? "مهمة"   :
            "موعد";
          return {
            textLine: `• ${tag}: ${e.title} — ${when}`,
            htmlLine: `<li style="margin:6px 0;">${tag}: ${e.title} — ${when}</li>`
          };
        });

        const listText = items.map(i => i.textLine).join("\n");
        const listHtml = items.map(i => i.htmlLine).join("");

        // -------- العنوان + النصوص --------
        const subject = `تذكير — مواعيدك القادمة بعد ${daysBefore} يوم/أيام`;

        const text = [
          "مرحبـا يا صاحب الأثر ✨",
          "",
          `نودّ تذكيرك بمواعيدك التالية القادمة بعد ${daysBefore} يوم/أيام:`,
          "",
          listText,
          "",
          "كونك معلمًا يعني أنك أنت صانع المستقبل،",
          "كل يومٍ تبني عقلًا وترسم أفقًا جديدًا لطلابك.",
          "",
          "هذه الرسالة تم إرسالها بناءً على طلبك بالتذكير",
          "«أثـَـر»"
        ].join("\n");

        const html = `
          <div style="font-family: 'Cairo', Tahoma, Arial, sans-serif; direction: rtl; text-align: right; line-height: 1.9; color: #0f172a;">
            <h2 style="color:#3b82f6; margin:0 0 8px;">مرحبـا يا صاحب الأثر ✨</h2>
            <p style="margin:0 0 10px;">
              نودّ تذكيرك بمواعيدك التالية القادمة بعد
              <strong>${daysBefore}</strong> يوم/أيام:
            </p>

            <ul style="background:#f9fafb; padding:12px 18px; border-radius:10px; border:1px solid #e5e7eb; list-style:none; margin:0 0 14px;">
              ${listHtml}
            </ul>

            <p style="margin:12px 0 18px;">
              كـونك <strong>معلمًا</strong> يعني أنك أنت صانع المستقبل،
              كل يومٍ تبني عقلًا وترسم أفقًا جديدًا لطلابك 🌱
            </p>

            <div style="text-align:center; margin:22px 0;">
              <a href="${miyadURL}"
                style="display:inline-block; background:#3b82f6; color:#fff; padding:12px 20px; border-radius:10px; text-decoration:none; font-weight:700;">
                تصفّح «ميعاد» 📅
              </a>
            </div>

            <hr style="margin:18px 0; border:none; border-top:1px solid #e5e7eb;" />

            <p style="font-size:.93em; color:#475569; margin:0;">
              هذه الرسالة تم إرسالها بناءً على طلبك بالتذكير<br>
              <strong>«أثـَـر»</strong>
            </p>
          </div>
        `;

        // -------- الإرسال --------
        await transporter.sendMail({
          from: process.env.FROM_EMAIL, // مثال: "Athar <no-reply@n-athar.co>"
          to: u.email,
          subject,
          text,   // نسخة نصية
          html,   // نسخة HTML
        });

        sent++;
      } catch (innerErr) {
        console.error("send to user failed:", { user: u.user_id, err: innerErr });
        failed++;
        continue;
      }
    }

    return ok(`Reminders: sent=${sent}, skipped=${skipped}, failed=${failed}`);
  } catch (err) {
    console.error("remind-miyad error:", err);
    return { statusCode: 500, body: "remind-miyad failed" };
  }
};

// ------------ Helpers ------------
function ok(msg) {
  return { statusCode: 200, body: msg };
}
