// netlify/functions/admin-announcement.js
const { createClient } = require("@supabase/supabase-js");
const { requireAdmin } = require("./_auth.js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false }
});

exports.handler = async (event) => {
  if (event.httpMethod === "GET") {
    // ?latest=1 → آخر إعلان مفعّل وغير منتهي
    const latest = new URL(event.rawUrl).searchParams.get("latest");
    if (latest) {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("site_announcements")
        .select("*")
        .eq("active", true)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return { statusCode: 500, body: error.message };
      return { statusCode: 200, body: JSON.stringify({ latest: data || null }) };
    }
    return { statusCode: 400, body: "bad request" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const gate = await requireAdmin(event);
  if (!gate.ok) return { statusCode: gate.status, body: gate.error };

  try {
    const body = JSON.parse(event.body || "{}");
    const text    = (body.text || "").trim();
    const active  = !!body.active;
    const expires = body.expires ? new Date(body.expires).toISOString() : null;

    if (!text) return { statusCode: 400, body: "text required" };

    const payload = {
      text,
      active,
      expires_at: expires,
      tenant_id: gate.org_id || null
    };

    const { data, error } = await supabase
      .from("site_announcements")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    return { statusCode: 200, body: JSON.stringify(data) };
  } catch (e) {
    console.error("admin-announcement", e);
    return { statusCode: 500, body: "server error" };
  }
};
