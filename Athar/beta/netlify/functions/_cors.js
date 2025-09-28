// /.netlify/functions/_cors.js
const ORIGIN = process.env.ALLOWED_ORIGIN || "https://n-athar.co";

exports.CORS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-moyasar-token",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS,DELETE,PUT",
  "Vary": "Origin"
};

exports.preflight = (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        ...exports.CORS,
        "Content-Type": "application/json"  // ✅ إضافة Content-Type للتوحيد
      },
      body: ""
    };
  }
  return null;
};
