/**
 * API Client Service with Axios
 * @fileoverview Centralized API client with interceptors for Netlify Functions
 */

import axios from "axios";

function resolveApiBase() {
  const devBase = "/.netlify/functions";
  if (import.meta.env.DEV) return devBase;

  const raw = String(import.meta.env.VITE_API_BASE_URL || "").trim();
  if (!raw) return devBase;

  try {
    const url = new URL(raw);
    const path = (url.pathname || "").replace(/\/+$/, "");
    return `${url.origin}${path}`;
  } catch {
    return (raw.startsWith("/") ? raw : `/${raw}`).replace(/\/+$/, "");
  }
}

const API_BASE = resolveApiBase();

// ===== Create Axios Instance =====
const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000, // 30 seconds (AI calls can be slow)
  headers: {
    "Content-Type": "application/json",
  },
});

// ===== Auth Token Storage =====
// We store the token getter function to be called on each request
let tokenGetter = null;
let unauthorizedHandler = null;
let isHandlingUnauthorized = false;

/**
 * Set the token getter function (called from AuthProvider)
 * @param {Function} getter - Async function that returns the access token
 */
export function setTokenGetter(getter) {
  tokenGetter = getter;
}

/**
 * Set unauthorized handler (called on 401 responses)
 * @param {Function|null} handler
 */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === "function" ? handler : null;
}

// ===== Request Interceptor =====
// Automatically adds Authorization header to all requests
api.interceptors.request.use(
  async (config) => {
    // Get fresh token for each request
    if (tokenGetter) {
      try {
        const token = await tokenGetter();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        console.warn("[API] Failed to get access token:", error);
      }
    }

    // Add timestamp to prevent caching for GET requests
    if (config.method === "get") {
      config.params = { ...config.params, _t: Date.now() };
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// ===== Response Interceptor =====
// Handles common error cases and transforms responses
api.interceptors.response.use(
  (response) => {
    // Return just the data for convenience
    return response.data;
  },
  (error) => {
    // Handle specific error cases
    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 401:
          console.error("[API] Unauthorized - Token may be expired");
          if (unauthorizedHandler && !isHandlingUnauthorized) {
            isHandlingUnauthorized = true;
            try {
              Promise.resolve(unauthorizedHandler(error)).finally(() => {
                setTimeout(() => {
                  isHandlingUnauthorized = false;
                }, 1000);
              });
            } catch (handlerError) {
              console.warn("[API] Unauthorized handler failed:", handlerError);
              isHandlingUnauthorized = false;
            }
          }
          // Could trigger a re-login here
          break;
        case 403:
          console.error("[API] Forbidden - Insufficient permissions");
          break;
        case 404:
          console.error("[API] Not Found:", error.config.url);
          break;
        case 500:
          console.error("[API] Server Error:", data);
          break;
        default:
          console.error("[API] Error:", status, data);
      }

      // Create a more helpful error
      const extractedMessage =
        typeof data === "string"
          ? data
          : data?.message ||
            data?.error ||
            data?.details ||
            `Request failed with status ${status}`;
      const apiError = new Error(extractedMessage);
      apiError.status = status;
      apiError.data = data;
      return Promise.reject(apiError);
    }

    // Network error or timeout
    if (error.code === "ECONNABORTED") {
      const timeoutError = new Error("Request timed out. Please try again.");
      timeoutError.status = 408;
      return Promise.reject(timeoutError);
    }

    console.error("[API] Network Error:", error.message);
    return Promise.reject(error);
  },
);

// ===== Export the configured instance =====
export default api;

// ===== Specific API Functions =====

/**
 * Check user subscription status
 */
export async function checkUserStatus() {
  return api.get("/user-status");
}

/**
 * Log tool usage
 * @param {string} toolName - Name of the tool
 * @param {Object} meta - Additional metadata
 */
export async function logToolUsage(toolName, meta = {}) {
  return api.post("/log-tool-usage", { tool_name: toolName, meta });
}

/**
 * Generate AI strategy
 * @param {Object} params - Strategy parameters
 */
export async function generateStrategy(params) {
  return api.post("/strategy", params);
}

/**
 * Generate Ethraa content
 * @param {Object} params - Ethraa parameters
 */
export async function generateEthraa(params) {
  return api.post("/gemini-ethraa", params);
}

/**
 * Generate Mithaq content
 * @param {Object} params - Mithaq parameters
 */
export async function generateMithaq(params) {
  return api.post("/gemini-mithaq", params);
}

/**
 * Generate Mulham content
 * @param {Object} params - Mulham parameters
 */
export async function generateMulham(params) {
  return api.post("/mulham", params);
}

/**
 * Generate Mueen plan
 * @param {Object} params - Mueen parameters
 */
export async function generateMueenPlan(params) {
  return api.post("/mueen-plan", params);
}

/**
 * Generate Murtakaz (Darsi) content
 * @param {Object} params - Murtakaz parameters
 */
export async function generateMurtakaz(params) {
  return api.post("/murtakaz", params);
}

// ===== Miyad (Calendar) Functions =====

/**
 * Add a miyad event
 * @param {Object} eventData - Event data
 */
export async function addMiyadEvent(eventData) {
  return api.post("/add-miyad-event", eventData);
}

/**
 * Delete a miyad event
 * @param {string} eventId - Event ID to delete
 */
export async function deleteMiyadEvent(payload) {
  if (typeof payload === "string") {
    return api.post("/delete-miyad-event", { event_id: payload });
  }
  return api.post("/delete-miyad-event", payload);
}

/**
 * Get reminder settings
 */
export async function getReminderSettings() {
  return api.post("/get-reminder-settings", {});
}

/**
 * Save reminder settings
 * @param {Object} settings - Reminder settings
 */
export async function saveReminderSettings(settings) {
  return api.post("/save-reminder-settings", settings);
}

// ===== Complaints Functions =====

/**
 * Create a complaint
 * @param {Object} complaintData - Complaint data
 */
export async function createComplaint(complaintData) {
  return api.post("/complaints-create", complaintData);
}

/**
 * Get user's complaints list
 */
export async function getUserComplaints(userEmail) {
  return api.get("/user-complaints-list", {
    params: { user_email: userEmail || undefined },
  });
}

/**
 * Get complaint messages
 * @param {string} complaintId - Complaint ID
 */
export async function getComplaintMessages(complaintId, userEmail) {
  return api.get("/complaint-messages", {
    params: {
      complaint_id: complaintId,
      user_email: userEmail || undefined,
    },
  });
}

/**
 * Reply to a complaint
 * @param {Object} replyData - Reply data
 */
export async function replyToComplaint(replyData) {
  return api.post("/complaint-user-reply", replyData);
}

// ===== Payment Functions =====

/**
 * Create payment invoice
 * @param {Object} invoiceData - Invoice data (plan, promo code, etc.)
 */
export async function createPaymentInvoice(invoiceData) {
  return api.post("/payments-create-invoice", invoiceData);
}

/**
 * Get user's invoices list
 */
export async function getInvoicesList() {
  const payload = await api.get("/invoices-list");

  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.invoices)
      ? payload.invoices
      : Array.isArray(payload?.rows)
        ? payload.rows
        : [];

  return rows.map((invoice) => {
    if (!invoice || typeof invoice !== "object") return invoice;

    const amountInMinorUnits =
      invoice.amount != null
        ? invoice.amount
        : invoice.amount_sar != null
          ? Math.round(Number(invoice.amount_sar) * 100)
          : null;
    const normalizedAmount =
      amountInMinorUnits == null ? null : Number(amountInMinorUnits);

    return {
      ...invoice,
      id: invoice.id || invoice.invoice_id || invoice.provider_event_id || null,
      user_email: invoice.user_email || invoice.email || null,
      user_name: invoice.user_name || invoice.name || invoice.email || null,
      amount: Number.isFinite(normalizedAmount) ? normalizedAmount : null,
      currency: invoice.currency || "sar",
    };
  });
}

// ===== Promo Functions =====

/**
 * Redeem a promo code
 * @param {string} code - Promo code to redeem
 */
export async function redeemPromoCode(code) {
  return api.post("/promo-redeem", { code });
}

// ===== Profile Functions =====

/**
 * Upsert user profile basics
 * @param {Object} payload - sub, email, name, picture
 */
export async function upsertUserProfile(payload) {
  return api.post("/upsert-user", payload);
}

// ===== Admin Functions =====

/**
 * Get admin users list
 */
export async function getAdminUsersList() {
  const payload = await api.get("/admin-users-list");

  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.users)
      ? payload.users
      : Array.isArray(payload?.rows)
        ? payload.rows
        : [];

  return rows.map((user) => {
    if (!user || typeof user !== "object") return user;

    const appMetadata = user.app_metadata || {};
    const hasEntitlement =
      appMetadata.plan_entitlement !== undefined
        ? appMetadata.plan_entitlement
        : Boolean(user.active);

    return {
      ...user,
      user_id: user.user_id || user.user_sub || user.id || null,
      name: user.name || user.display_name || user.email || "",
      picture: user.picture || user.avatar_url || null,
      app_metadata: {
        ...appMetadata,
        plan_entitlement: hasEntitlement,
      },
    };
  });
}

/**
 * Activate user subscription (admin only)
 * @param {Object} activationData - Activation data
 */
export async function adminActivateUser(activationData) {
  return api.post("/admin-activate", activationData);
}

export async function createAnnouncement(data) {
  return api.post("/admin-announcement", data);
}

export async function getAnnouncements() {
  const latest = await api.get("/admin-announcement?latest=1");
  const list = await api.get("/admin-announcement?list=1");

  const parseTargetPages = (value) => {
    if (Array.isArray(value) && value.length > 0) return value;

    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value.replace(/'/g, '"'));
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        const fallback = value
          .replace(/[[\]"']/g, "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        if (fallback.length > 0) return fallback;
      }
    }

    return ["all"];
  };

  const normalizeAnnouncement = (item) => {
    if (!item || typeof item !== "object") return item;
    return {
      ...item,
      target_pages: parseTargetPages(item.target_pages),
    };
  };

  return {
    latest: normalizeAnnouncement(latest?.latest),
    items: (list?.items || []).map(normalizeAnnouncement),
  };
}

export async function updateAnnouncement(data) {
  return api.put("/admin-announcement", data);
}

export async function deleteAnnouncement(id) {
  return api.delete(`/admin-announcement?id=${encodeURIComponent(id)}`);
}

/**
 * Get all complaints (admin only)
 */
export async function getAdminComplaintsList() {
  return api.get("/complaints-list");
}

export async function adminReplyToComplaint(replyData) {
  return api.post("/complaints-reply", replyData);
}

/**
 * Get complaint details (admin only)
 * @param {string} id - Complaint ID
 */
export async function getAdminComplaintDetails(id) {
  return api.get(`/complaints-get?id=${encodeURIComponent(id)}`);
}

/**
 * Filter complaints (admin only)
 * @param {Object} filters - Query params
 */
export async function filterComplaints(filters = {}) {
  const qs = new URLSearchParams();
  Object.keys(filters).forEach((key) => {
    if (filters[key]) qs.set(key, filters[key]);
  });
  return api.get("/complaints-list?" + qs.toString());
}
