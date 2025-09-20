// netlify/functions/admin-activate.js
const { createClient } = require("@supabase/supabase-js");
const { requireAdmin } = require("./_auth.js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false }
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const gate = await requireAdmin(event);
  if (!gate.ok) return { statusCode: gate.status, body: gate.error };

  try {
    const body = JSON.parse(event.body || "{}");
    const email   = (body.email || "").toLowerCase() || null;
    const user_id = body.user_id || null; // اختياري (auth0 sub)
    const months  = Math.max(1, parseInt(body.months || 1, 10));
    const note    = body.note || null;

    if (!email && !user_id) {
      return { statusCode: 400, body: "email or user_id is required" };
    }

    // لو عندك دالة RPC جاهزة في Supabase
    // activate_membership(user_id_or_email, months, note, tenant_id)
    // إن ما كانت عندك، تحت حطيت بديل "Upsert" بسيط في جدول memberships.

    // مثال RPC (ألغيه إذا ما عندك الدالة):
    // const { data, error } = await supabase.rpc("activate_membership", {
    //   p_email: email, p_user_id: user_id, p_months: months, p_note: note, p_tenant_id: gate.org_id
    // });

    // بديل: كتابة مباشرة (جدول memberships)
    // توقع جدول: memberships(email, user_id, expires_at, note, tenant_id, updated_at)
    const now = new Date();
    const { data: row } = await supabase
      .from("memberships")
      .select("expires_at")
      .or(`email.eq.${email},user_id.eq.${user_id}`)
      .maybeSingle();

    let base = now;
    if (row && row.expires_at) {
      const cur = new Date(row.expires_at);
      if (cur > now) base = cur; // نمدّد من تاريخ الانتهاء الحالي
    }

    const expires = new Date(base);
    expires.setMonth(expires.getMonth() + months);

    const payload = {
      email,
      user_id,
      expires_at: expires.toISOString(),
      note,
      tenant_id: gate.org_id || null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("memberships")
      .upsert(payload, { onConflict: "email" })
      .select()
      .single();

    if (error) throw error;

    return { statusCode: 200, body: JSON.stringify({ ok:true, expires_at: data.expires_at }) };
  } catch (e) {
    console.error("admin-activate", e);
    return { statusCode: 500, body: "server error" };
  }
};
