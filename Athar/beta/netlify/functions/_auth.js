// /netlify/functions/_auth.js
// ==========================
// Auth0 JWT verifier + helpers
// Env Vars needed:
// - AUTH0_DOMAIN        e.g. dev-2f0fmbtj6u8o7en4.us.auth0.com
// - AUTH0_AUDIENCE      e.g. https://api.n-athar[,https://api.athar]
// - AUTH0_ISSUER        e.g. https://dev-2f0fmbtj6u8o7en4.us.auth0.com/  (RECOMMENDED; MUST end with '/')
// - CLAIM_NAMESPACE     e.g. https://n-athar.co/                         (MUST end with '/')
// ==========================

const jwksRsa = require("jwks-rsa");
const jwt = require("jsonwebtoken");

// ---- Validate essential env ----
const DOMAIN = process.env.AUTH0_DOMAIN;
if (!DOMAIN) throw new Error("Missing env: AUTH0_DOMAIN");

// allow multiple audiences (comma-separated)
const AUDIENCE_LIST = String(process.env.AUTH0_AUDIENCE || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

if (AUDIENCE_LIST.length === 0) {
  throw new Error("Missing env: AUTH0_AUDIENCE");
}

// Prefer AUTH0_ISSUER if provided, else build from DOMAIN; ensure trailing slash
const ISSUER = (process.env.AUTH0_ISSUER || `https://${DOMAIN}/`).replace(/\/?$/, "/");

// Namespaces (prefer new, keep compat with old). Ensure trailing slash for new.
const NS_NEW = (process.env.CLAIM_NAMESPACE || "https://n-athar.co/").replace(/\/?$/, "/");
const NS_OLD = "https://athar.co/";

// ---- Build JWKS client from ISSUER ----
const jwksClient = jwksRsa({
  jwksUri: `${ISSUER}.well-known/jwks.json`, // e.g. https://tenant/.well-known/jwks.json
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000
});

function getKey(header, cb) {
  jwksClient.getSigningKey(header.kid, function (err, key) {
    if (err) return cb(err);
    const signingKey = key.getPublicKey();
    cb(null, signingKey);
  });
}

// Verify + decode access token
function decodeJwt(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        audience: AUDIENCE_LIST.length === 1 ? AUDIENCE_LIST[0] : AUDIENCE_LIST,
        issuer: ISSUER,
        algorithms: ["RS256"]
      },
      (err, decoded) => (err ? reject(err) : resolve(decoded))
    );
  });
}

// Read a claim from our namespace(s)
function pickNs(payload, key) {
  // try new NS first, then old; also allow raw key fallback
  return payload[NS_NEW + key] ??
         payload[NS_OLD + key] ??
         payload[key] ??
         null;
}

// =============== requireAdmin ===============
exports.requireAdmin = async function requireAdmin(event) {
  const auth = event.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return { ok:false, status:401, error:"Missing token" };

  try {
    const payload = await decodeJwt(token);

    const roles = pickNs(payload, "roles") || [];
    const isAdmin = (Array.isArray(roles) && roles.includes("admin")) || !!pickNs(payload, "admin");
    if (!isAdmin) return { ok:false, status:403, error:"Admins only" };

    return {
      ok: true,
      payload,
      roles,
      org_id:   pickNs(payload, "org_id")   || null,
      org_name: pickNs(payload, "org_name") || null,
      user: {
        sub:   payload.sub,
        email: pickNs(payload, "email")     || payload.email || null,
        name:  pickNs(payload, "full_name") || payload.name  || null
      }
    };
  } catch (e) {
    return { ok:false, status:401, error:"Bad token" };
  }
};

// =============== requireUser ===============
exports.requireUser = async function requireUser(event) {
  const auth = event.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return { ok:false, status:401, error:"Missing token" };

  try {
    const payload = await decodeJwt(token);
    return {
      ok: true,
      payload,
      user: {
        sub:   payload.sub,
        email: pickNs(payload, "email")     || payload.email || null,
        name:  pickNs(payload, "full_name") || payload.name  || null
      },
      roles: pickNs(payload, "roles") || []
    };
  } catch (e) {
    return { ok:false, status:401, error:"Bad token" };
  }
};
