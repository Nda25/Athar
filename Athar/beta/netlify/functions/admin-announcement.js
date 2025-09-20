// netlify/functions/admin-announcement.js
const { createClient } = require("@supabase/supabase-js");
const { requireAdmin } = require("./_auth.js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false }
});

function res(status, body) {
  return { statusCode: status, body: typeof body === "string" ? body : JSON.stringify(body) };
}

exports.handler = async (event) => {
  const method = event.httpMethod;

  if (method === "GET") {
    const url = new URL(event.rawUrl);

    // آخر إعلان منشور (غير منتهي)
    if (url.searchParams.get("latest")) {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("site_announcements")
        .select("*")
        .eq("active", true)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return res(500, error.message);
      return res(200, { latest: data || null });
    }

    // قائمة الإعلانات
    if (url.searchParams.get("list")) {
      const { data, error } = await supabase
        .from("site_announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return res(500, error.message);
      return res(200, { items: data || [] });
    }

    return res(400, "bad request");
  }

  // بقية العمليات تتطلب أدمن
  const gate = await requireAdmin(event);
  if (!gate.ok) return res(gate.status, gate.error);

  if (method === "POST") {
    try {
      const body = JSON.parse(event.body || "{}");
      const text    = (body.text || "").trim();
      const active  = !!body.active;
      const expires = body.expires ? new Date(body.expires).toISOString() : null;

      if (!text) return res(400, "text required");

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
      return res(200, data);
    } catch (e) {
      console.error("admin-announcement POST", e);
      return res(500, "server error");
    }
  }

  if (method === "PUT") {
    try {
      const body = JSON.parse(event.body || "{}");
      const id = body.id;
      if (!id) return res(400, "id required");

      const patch = {};
      if (typeof body.active === "boolean") patch.active = body.active;
      if (typeof body.text === "string")   patch.text = body.text.trim();
      if (body.expires !== undefined)
        patch.expires_at = body.expires ? new Date(body.expires).toISOString() : null;

      const { data, error } = await supabase
        .from("site_announcements")
        .update(patch)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return res(200, data);
    } catch (e) {
      console.error("admin-announcement PUT", e);
      return res(500, "server error");
    }
  }

  if (method === "DELETE") {
    try {
      const url = new URL(event.rawUrl);
      const id = url.searchParams.get("id");
      if (!id) return res(400, "id required");

      const { error } = await supabase
        .from("site_announcements")
        .delete()
        .eq("id", id);

      if (error) return res(500, error.message);
      return res(200, { ok: true });
    } catch (e) {
      console.error("admin-announcement DELETE", e);
      return res(500, "server error");
    }
  }

  return res(405, "Method Not Allowed");
};
