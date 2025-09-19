// netlify/functions/remind-miyad.js
const nodemailer = require("nodemailer");
const { createClient } = require("@supabase/supabase-js");

exports.handler = async () => {
  try {
    // اتصال Supabase
    const supa = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    );

    // جلب المستخدمين المفعّلين للتذكير
    const { data: users, error: uErr } = await supa
      .from("miyad_settings")
      .select("user_id, email, reminders_enabled, remind_days_before")
      .eq("reminders_enabled", true);

    if (uErr) throw uErr;
    if (!users || !users.length) {
      return ok("No users with reminders enabled.");
    }

    // إعداد SMTP
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const now = new Date();

    // الأساس للرابط (Public Base URL)
    const baseUrl =
      process.env.PUBLIC_BASE_URL || // من البيئة (Netlify)
      (typeof window !== "undefined" ? window.location.origin : "https://n-athar.co");

    // لكل مستخدم
    for (const u of users) {
      if (!u.email) continue;

      const daysBefore = u.remind_days_before ?? 2;

      // التاريخ المستهدف
      const start = new Date(now);
      start.setDate(start.getDate() + daysBefore);
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setHours(23, 59, 59, 999);

      // الأحداث من جدول ميعاد
      const { data: events, error: eErr } = await supa
        .from("miyad_events")
        .select("title, type, start_at")
        .eq("user_id", u.user_id)
        .gte("start_at", start.toISOString())
        .lte("start_at", end.toISOString());

      if (eErr) throw eErr;
      if (!events || !events.length) continue;

      // صياغة الإيميل
      const list = events
        .map((e) => {
          const d = new Date(e.start_at).toLocaleString("ar-SA");
          const tag =
            e.type === "exam"
              ? "اختبار"
              : e.type === "task"
              ? "مهمة"
              : "موعد";
          return `• ${tag}: ${e.title} — ${d}`;
        })
        .join("\n");

      const subject = `تذكير — أحداث قادمة بعد ${daysBefore} يوم/أيام`;
      const text = `مرحبـا يا صاحب الأثر ✨\n
نودّ تذكيرك بمواعيدك التالية القادمة بعد ${daysBefore} يوم/أيام:\n\n${list}\n\n
كونك معلمًا يعني أنك أنت صانع المستقبل، كل يومٍ تبني عقلًا وترسم أفقًا جديدًا لطلابك 🌱\n\n
تصفح ميعاد 📅: ${baseUrl}/miyad\n\n
هذه الرسالة تم إرسالها بناءً على طلبك بالتذكير.\n«أثـَـر»`;

      await transporter.sendMail({
        from: process.env.FROM_EMAIL,
        to: u.email,
        subject,
        text,
      });
    }

    return ok("Reminders sent.");
  } catch (err) {
    console.error("remind-miyad error:", err);
    return { statusCode: 500, body: "remind-miyad failed" };
  }
};

function ok(msg) {
  return { statusCode: 200, body: msg };
}
