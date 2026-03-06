// netlify/functions/moyasar-webhook.js
// Backward-compatible wrapper around payments-webhook

const { handler: paymentsWebhookHandler } = require("./payments-webhook");

function readHeader(headers, key) {
  const h = headers || {};
  return h[key] || h[key?.toLowerCase?.()] || "";
}

exports.handler = async (event, context) => {
  const headers = { ...(event.headers || {}) };

  // Legacy integration used shared-secret header.
  // If valid, bridge it to x-moyasar-token expected by payments-webhook.
  const existingToken =
    readHeader(headers, "x-moyasar-token") ||
    readHeader(headers, "x-webhook-token") ||
    readHeader(headers, "x-secret-token");

  if (!existingToken) {
    const shared = readHeader(headers, "shared-secret");
    const expectedShared = String(process.env.WEBHOOK_SHARED_SECRET || "");
    const bridgeToken = String(process.env.MOYASAR_WEBHOOK_TOKEN || "");

    if (shared && expectedShared && shared === expectedShared && bridgeToken) {
      headers["x-moyasar-token"] = bridgeToken;
    }
  }

  return paymentsWebhookHandler({ ...event, headers }, context);
};
