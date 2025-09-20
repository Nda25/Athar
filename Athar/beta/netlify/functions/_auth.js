// netlify/functions/_auth.js
const jwksRsa = require("jwks-rsa");
const jwt = require("jsonwebtoken");

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

exports.requireAdmin = async function requireAdmin(event) {
  const auth = event.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token) return { ok:false, status:401, error:"Missing token" };

  try {
    const payload = await new Promise((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        {
          audience: process.env.AUTH0_AUDIENCE,            // https://api.athar
          issuer: `https://${process.env.AUTH0_DOMAIN}/`,  // dev-xxx.us.auth0.com/
          algorithms: ["RS256"]
        },
        (err, decoded) => (err ? reject(err) : resolve(decoded))
      );
    });

    const roles = payload["https://athar/roles"] || [];
    const isAdmin = roles.includes("admin") || payload["https://athar/admin"] === true;

    if (!isAdmin) return { ok:false, status:403, error:"Admins only" };

    // دعم التوسّع لاحقًا (Organizations)
    const org_id   = payload["https://athar/org_id"]   || null;
    const org_name = payload["https://athar/org_name"] || null;

    return { ok:true, payload, roles, org_id, org_name };
  } catch (e) {
    return { ok:false, status:401, error:"Bad token" };
  }
};
