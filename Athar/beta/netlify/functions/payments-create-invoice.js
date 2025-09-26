// Create Moyasar Invoice (LIVE)
const { requireUser } = require("./_auth");
const fetch = global.fetch;

const PLAN_MAP = {
  weekly:   { amount: 1299, days: 7,   name: "أسبوعي 12.99 رس" },
  monthly:  { amount: 2999, days: 30,  name: "شهري 29.99 رس" },
  semiannual: { amount: 16999, days: 180, name: "نصف سنوي 169.99 رس" },
  annual:   { amount: 33999, days: 365, name: "سنوي 339.99 رس" } // عدّلي السعر إن اختلف
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  // يتطلب مستخدم مسجّل
  const gate = await requireUser(event);
  if (!gate.ok) return { statusCode: gate.status, body: gate.error };

  try {
    const { plan = "monthly" } = JSON.parse(event.body || "{}");
    const conf = PLAN_MAP[plan];
    if (!conf) return { statusCode: 400, body: "Invalid plan" };

    const sk  = process.env.MOYASAR_SK;
    const host = process.env.SITE_BASE_URL || "https://n-athar.co";

    const auth = Buffer.from(`${sk}:`).toString("base64");

    // إنشاء فاتورة
    const res = await fetch("https://api.moyasar.com/v1/invoices", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: conf.amount,          // بالهللة (1299 = 12.99)
        currency: "SAR",
        description: `اشتراك أثر — ${conf.name}`,
        success_url: `${host}/pricing.html?paid=1`,
        back_url: `${host}/pricing.html?cancel=1`,
        callback_url: `${host}/.netlify/functions/payments-webhook`, // احتياط لو استُخدم كـ callback
        metadata: {
          user_sub: gate.user.sub,
          email: (gate.user.email || "").toLowerCase(),
          plan,
          period_days: conf.days
        }
      })
    });

    const inv = await res.json();
    if (!res.ok) {
      console.error("Moyasar create invoice error:", inv);
      return { statusCode: 400, body: "Failed to create invoice" };
    }

    // ارجعي رابط الفاتورة لنعمل redirect
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, invoice_id: inv.id, url: inv.url })
    };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: "Server error" };
  }
};
