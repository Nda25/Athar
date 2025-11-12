// netlify/functions/admin-announcement.js
const { createClient } = require("@supabase/supabase-js");
const { requireAdmin } = require("./_auth.js");

// Initialize Supabase once
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  {
    auth: { persistSession: false },
  }
);

// Helpers
const res = (status, body) => ({
  statusCode: status,
  body: typeof body === "string" ? body : JSON.stringify(body),
});
const toISO = (d) => (d ? new Date(d).toISOString() : null);

exports.handler = async (event) => {
  const {
    httpMethod: method,
    queryStringParameters: qs,
    body: rawBody,
  } = event;

  // === PUBLIC READ (GET) ===
  if (method === "GET") {
    if (qs.latest) {
      const now = new Date();
      // Optimized query: Use PostgREST logic for initial filtering
      const { data, error } = await supabase
        .from("site_announcements")
        .select("*")
        .eq("active", true)
        .or(`start_at.is.null,start_at.lte.${now.toISOString()}`) // Allow null OR past dates
        .order("start_at", { ascending: false, nullsFirst: true })
        .limit(50);

      if (error) return res(500, error.message);

      // Filter expiration and sort by relevance (start_at or created_at) in memory
      const latest =
        (data || [])
          .filter((a) => !a.expires_at || new Date(a.expires_at) > now)
          .sort(
            (a, b) =>
              new Date(b.start_at || b.created_at) -
              new Date(a.start_at || a.created_at)
          )[0] || null;

      return res(200, { latest });
    }

    // List Mode
    if (qs.list) {
      const { data, error } = await supabase
        .from("site_announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      return error ? res(500, error.message) : res(200, { items: data || [] });
    }

    return res(400, "bad request");
  }

  // === ADMIN WRITE OPERATIONS ===
  // Verify admin privileges
  const gate = await requireAdmin(event);
  if (!gate.ok) return res(gate.status, gate.error);

  try {
    // Parse body only for write ops
    const body = method !== "DELETE" ? JSON.parse(rawBody || "{}") : {};
    let query = supabase.from("site_announcements");
    let result;

    switch (method) {
      case "POST": {
        const text = (body.text || "").trim();
        if (!text) return res(400, "text required");

        result = await query
          .insert({
            text,
            active: !!body.active,
            start_at: toISO(body.start),
            expires_at: toISO(body.expires),
            tenant_id: gate.org_id || null,
          })
          .select()
          .single();
        break;
      }

      case "PUT": {
        if (!body.id) return res(400, "id required");

        // Build patch object dynamically to avoid overwriting with null/undefined unless intended
        const patch = {};
        if (typeof body.active === "boolean") patch.active = body.active;
        if (typeof body.text === "string") patch.text = body.text.trim();
        if (body.start !== undefined) patch.start_at = toISO(body.start);
        if (body.expires !== undefined) patch.expires_at = toISO(body.expires);

        result = await query.update(patch).eq("id", body.id).select().single();
        break;
      }

      case "DELETE": {
        const id = qs.id;
        if (!id) return res(400, "id required");

        const { error } = await query.delete().eq("id", id);
        if (error) throw error;
        return res(200, { ok: true });
      }

      default:
        return res(405, "Method Not Allowed");
    }

    if (result.error) throw result.error;
    return res(200, result.data);
  } catch (e) {
    console.error(`admin-announcement ${method} error:`, e);
    return res(500, "server error");
  }
};
