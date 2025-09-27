// /.netlify/functions/_cors.js
// Helper موحّد لإعدادات CORS

const ORIGIN = process.env.ALLOWED_ORIGIN || "https://n-athar.co";

// كائن الـ Headers الجاهز للإرجاع مع كل Response
exports.CORS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS,DELETE,PUT",
  "Vary": "Origin"
};

// هيلبر للتعامل مع Preflight requests
exports.preflight = (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: exports.CORS, body: "" };
  }
  return null;
};
