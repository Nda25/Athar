// netlify/functions/_auth.js
// ==========================
// JWT verification for Auth0 + role/claim helpers
// يعتمد على متغيّرات البيئة التالية:
// - AUTH0_DOMAIN        مثال: dev-2f0fmbtj6u8o7en4.us.auth0.com
// - AUTH0_AUDIENCE      مثال: https://api.athar
// - CLAIM_NAMESPACE     مثال: https://athar.co/   ← مهم ينتهي بـ /
// ==========================

const jwksRsa = require("jwks-rsa");
const jwt = require("jsonwebtoken");

// namespace من البيئة + دعم افتراضي
const NS = (process.env.CLAIM_NAMESPACE || "https://athar.co/").replace(/\/?$/, "/"); // تأكد من وجود /

const client = jwksRsa({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000
});

function getKey(header, cb) {
  client.getSigningKey(header.kid, function (err, key) {
    if (err) return cb(err);
    const signingKey = key.getPublicKey();
    cb(null, signingKey);
  });
}

function decodeJwt(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        audience: process.env.AUTH0_AUDIENCE,
        issuer: `https://${process.env.AUTH0_DOMAIN}/`,
        algorithms: ["RS256"]
      },
      (err, decoded) => (err ? reject(err) : resolve(decoded))
    );
  });
}

// helper يقرأ claim من namespace الحالي مع دعم القديم "https://athar/"
function pickNs(payload, key) {
  return payload[NS + key] ??
         payload[`https://athar/${key}`] ?? // دعم رجعي
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
        email: pickNs(payload, "email")      || payload.email || null,
        name:  pickNs(payload, "full_name")  || payload.name  || null
      }
    };
  } catch {
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
        email: pickNs(payload, "email")      || payload.email || null,
        name:  pickNs(payload, "full_name")  || payload.name  || null
      },
      roles: pickNs(payload, "roles") || []
    };
  } catch {
    return { ok:false, status:401, error:"Bad token" };
  }
};// netlify/functions/_auth.js
// ==========================
// JWT verification for Auth0 + role/claim helpers
// يعتمد على متغيّرات البيئة التالية:
// - AUTH0_DOMAIN        مثال: dev-2f0fmbtj6u8o7en4.us.auth0.com
// - AUTH0_AUDIENCE      مثال: https://api.athar
// - CLAIM_NAMESPACE     مثال: https://athar.co/   ← مهم ينتهي بـ /
// ==========================

const jwksRsa = require("jwks-rsa");
const jwt = require("jsonwebtoken");

// namespace من البيئة + دعم افتراضي
const NS = (process.env.CLAIM_NAMESPACE || "https://athar.co/").replace(/\/?$/, "/"); // تأكد من وجود /

const client = jwksRsa({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000
});

function getKey(header, cb) {
  client.getSigningKey(header.kid, function (err, key) {
    if (err) return cb(err);
    const signingKey = key.getPublicKey();
    cb(null, signingKey);
  });
}

function decodeJwt(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        audience: process.env.AUTH0_AUDIENCE,
        issuer: `https://${process.env.AUTH0_DOMAIN}/`,
        algorithms: ["RS256"]
      },
      (err, decoded) => (err ? reject(err) : resolve(decoded))
    );
  });
}

// helper يقرأ claim من namespace الحالي مع دعم القديم "https://athar/"
function pickNs(payload, key) {
  return payload[NS + key] ??
         payload[`https://athar/${key}`] ?? // دعم رجعي
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
        email: pickNs(payload, "email")      || payload.email || null,
        name:  pickNs(payload, "full_name")  || payload.name  || null
      }
    };
  } catch {
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
        email: pickNs(payload, "email")      || payload.email || null,
        name:  pickNs(payload, "full_name")  || payload.name  || null
      },
      roles: pickNs(payload, "roles") || []
    };
  } catch {
    return { ok:false, status:401, error:"Bad token" };
  }
};
