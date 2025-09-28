const { CORS, preflight } = require("./_cors.js");
// netlify/functions/promo-redeem.js
// POST /promo-redeem  { code }
// يتطلب مستخدمًا مسجّلاً؛ يتحقق من الرمز في promo_codes ويُسجّل الاسترداد ويُمدّد العضوية.

const { requireUser } = require("./_auth");
const { createClient } = require("@supabase/supabase-js");

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, { auth:{ persistSession:false } });

exports.handler = async (event) => {
  const pre = preflight(event);
  if (pre) return pre;
  if (event.httpMethod !== "POST") return { statusCode:405, body:"Method Not Allowed" };

  const gate = await requireUser(event);
  if (!gate.ok) return { statusCode: gate.status, body: gate.error };

  try{
    const { code } = JSON.parse(event.body || "{}");
    if (!code || typeof code !== "string") return { statusCode:400, body:"Missing code" };
    const now = new Date();

    // حمّلي الرمز
    const { data: promo, error: pErr } = await sb
      .from("promo_codes")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .eq("active", true)
      .maybeSingle();
    if (pErr || !promo) return { statusCode:404, body:"Invalid or inactive code" };

    // تحقق الوقت والحدود
    if (promo.starts_at && new Date(promo.starts_at) > now) return { statusCode:400, body:"Code not started yet" };
    if (promo.ends_at && new Date(promo.ends_at) < now)   return { statusCode:400, body:"Code expired" };

    if (promo.max_uses != null) {
      const { data: usesAgg } = await sb.from("promo_redemptions").select("id", { count:"exact", head:true }).eq("code", promo.code);
      if ((usesAgg?.length === 0 ? 0 : usesAgg.length) >= promo.max_uses) return { statusCode:400, body:"Code usage limit reached" };
    }

    // لا يتجاوز حدّ المستخدم
    const { data: already } = await sb
      .from("promo_redemptions")
      .select("id", { count:"exact", head:false })
      .eq("code", promo.code)
      .eq("user_sub", gate.user.sub);
    const perUser = promo.per_user_limit == null ? 1 : Number(promo.per_user_limit);
    if (Array.isArray(already) && already.length >= perUser) return { statusCode:400, body:"User limit reached for this code" };

    // حدّدي الاشتراك الحالي
    const email = (gate.user.email || "").toLowerCase();
    const { data: member } = await sb
      .from("memberships")
      .select("expires_at")
      .or(`email.eq.${email},user_id.eq.${gate.user.sub}`)
      .maybeSingle();

    let base = now;
    if (member?.expires_at) {
      const cur = new Date(member.expires_at);
      if (cur > now) base = cur;
    }

    // مدة الرمز (unit: days|months|years, amount:int)
    const amount = Math.max(1, parseInt(promo.duration_amount || 0,10));
    const unit   = promo.duration_unit || "days";
    const expires = new Date(base);
    if (unit === "days")   expires.setDate(expires.getDate() + amount);
    if (unit === "months") expires.setMonth(expires.getMonth() + amount);
    if (unit === "years")  expires.setFullYear(expires.getFullYear() + amount);

    // حدّث/أدرج العضوية
    const payload = {
      email,
      user_id: gate.user.sub,
      expires_at: expires.toISOString(),
      note: `promo:${promo.code}`,
      updated_at: new Date().toISOString()
    };

    const { data: upserted, error: uErr } = await sb
      .from("memberships")
      .upsert(payload, { onConflict: "user_id" })
      .select()
      .single();
    if (uErr) return { statusCode:500, body:uErr.message };

    // سجّلي الاسترداد
    await sb.from("promo_redemptions").insert({
      code: promo.code,
      user_sub: gate.user.sub,
      email,
      meta: { prev_expires_at: member?.expires_at || null, new_expires_at: upserted.expires_at }
    });

    return { statusCode:200, body: JSON.stringify({ ok:true, expires_at: upserted.expires_at }) };
  }catch(e){
    return { statusCode:500, body: e.message || "server error" };
  }
};
