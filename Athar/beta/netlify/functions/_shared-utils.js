// Shared utility functions to reduce code duplication across Netlify functions
// Usage: Import this in your netlify function files

/**
 * Check if a user has an active membership
 * @param {string} user_sub - Auth0 user subject
 * @param {string} email - User email
 * @returns {Promise<{active: boolean, plan: string, expiresAt: string|null}>}
 */
async function isActiveMembership(user_sub, email) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/memberships?user_sub=eq.${user_sub}`,
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      return { active: false, plan: null, expiresAt: null };
    }

    const membership = data[0];
    const isActive =
      membership.status === "active" &&
      new Date(membership.expires_at) > new Date();

    return {
      active: isActive,
      plan: membership.plan_type || null,
      expiresAt: membership.expires_at || null,
    };
  } catch (e) {
    console.error("[SharedUtil] isActiveMembership error:", e.message);
    return { active: false, plan: null, expiresAt: null };
  }
}

/**
 * Log tool usage to track analytics
 * @param {string} toolName - Name of the tool being used
 * @param {object} meta - Additional metadata
 * @param {string} user_sub - Auth0 user subject
 * @param {string} user_email - User email
 */
async function supaLogToolUsage(toolName, meta = {}, user_sub, user_email) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tool_usage`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool_name: toolName,
        user_sub: user_sub,
        user_email: user_email,
        meta: meta,
        created_at: new Date().toISOString(),
      }),
    });

    return { ok: res.ok, status: res.status };
  } catch (e) {
    console.error("[SharedUtil] supaLogToolUsage error:", e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Get auth token with fallback handling
 * @param {object} context - Netlify function context
 * @returns {Promise<string|null>}
 */
async function getAuthTokenFromContext(context) {
  try {
    // Try Authorization header
    const authHeader =
      context.headers?.authorization || context.headers?.Authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }
    return null;
  } catch (e) {
    console.error("[SharedUtil] getAuthTokenFromContext error:", e.message);
    return null;
  }
}

/**
 * Parse CORS request safely
 * @param {object} event - Netlify event
 * @returns {Promise<object>}
 */
async function parseCORSRequest(event) {
  try {
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        body: "",
      };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    return { statusCode: null, body };
  } catch (e) {
    console.error("[SharedUtil] parseCORSRequest error:", e.message);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid request format" }),
    };
  }
}

module.exports = {
  isActiveMembership,
  supaLogToolUsage,
  getAuthTokenFromContext,
  parseCORSRequest,
};
