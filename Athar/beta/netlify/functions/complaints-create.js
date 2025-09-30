// POST body: { subject, type: 'complaint'|'suggestion', message, email?, name?, order_number? }
// يتطلب مستخدم مسجّل (JWT) + (اختياري) اشتراك نشط

const { requireUser } = require("./_auth");
const { createClient } = require("@supabase/supabase-js");

// غيّري إلى false لو تبين السماح لأي مستخدم مسجّل
const REQUIRE_ACTIVE = true;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

async function isActive(user_sub, email) {
  try {
    const { data, error } = await supabase
      .from("v_user_status")
      .select("active")
      .or(`user_sub.eq.${user_sub},email.eq.${(email||"").toLowerCase()}`)
      .limit(1)
      .maybeSingle();
    if (!error && data) return !!data.active;
  } catch (_) {}

  try {
    let q = supabase
      .from("memberships")
      .select("end_at, expires_at")
      .order("end_at", { ascending: false })
      .limit(1);

    if (user_sub) q = q.eq("user_id", user_sub);
    else if (email) q = q.eq("email", (email||"").toLowerCase());
    else return false;

    const { data: rows } = await q;
    const row = rows?.[0];
    const exp = row?.end_at || row?.expires_at;
    return exp ? new Date(exp) > new Date() : false;
  } catch (_) {
    return false;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers:{'Content-Type':'text/plain; charset=utf-8'}, body: "Method Not Allowed" };
  }

  const gate = await requireUser(event);
  if (!gate.ok) return { statusCode: gate.status, headers:{'Content-Type':'text/plain; charset=utf-8'}, body: gate.error };

  try {
    const data = JSON.parse(event.body || "{}");

    const subject = String(data.subject || "").trim();
    const type    = String(data.type || "").trim(); // complaint | suggestion
    const message = String(data.message || "").trim();
    const orderNo = data.order_number ? String(data.order_number).trim() : null;

    if (!subject || !message || !["complaint","suggestion"].includes(type)) {
      return { statusCode: 400, headers:{'Content-Type':'text/plain; charset=utf-8'}, body: "Invalid payload" };
    }

    const userEmail = (data.email || gate.user.email || "").toLowerCase();
    const userName  = data.name || gate.user.name || null;
    const userSub   = gate.user.sub;

    if (!userEmail) {
      return { statusCode: 400, headers:{'Content-Type':'text/plain; charset=utf-8'}, body: "Missing user email" };
    }

    if (REQUIRE_ACTIVE) {
      const active = await isActive(userSub, userEmail);
      if (!active) {
        return { statusCode: 403, headers:{'Content-Type':'text/plain; charset=utf-8'}, body: "Only active subscribers can send complaints/suggestions" };
      }
    }

    const { data: inserted, error: insErr } = await supabase
      .from("complaints")
      .insert([{
        user_email: userEmail,
        user_name:  userName,
        subject,
        type,
        message,
        order_number: orderNo,
        channel: "web",
        status: "new",
        user_id: userSub || null
      }])
      .select()
      .single();

    if (insErr) {
      console.error("complaints: insert error", insErr);
      return { statusCode: 500, headers:{'Content-Type':'text/plain; charset=utf-8'}, body: "Failed to create complaint" };
    }

    if (inserted?.id) {
      const { error: msgErr } = await supabase
        .from("complaint_messages")
        .insert([{ complaint_id: inserted.id, sender: "user", body: message }]);
      if (msgErr) console.warn("complaint_messages: insert warning", msgErr);
    }

    let whatsapp = null;
    if (process.env.WHATSAPP_NUMBER) {
      const num = process.env.WHATSAPP_NUMBER.replace(/\D+/g, "");
      whatsapp = `https://wa.me/${num}`;
    }

    return {
      statusCode: 200,
      headers: { "Content-Type":"application/json; charset=utf-8" },
      body: JSON.stringify({ ok: true, complaint: inserted, whatsapp })
    };
  } catch (e) {
    console.error("complaints-create error:", e);
    return { statusCode: 500, headers:{'Content-Type':'text/plain; charset=utf-8'}, body: e.message || "Server error" };
  }
};
