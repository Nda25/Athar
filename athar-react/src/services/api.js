/**
 * API Client Service with Axios
 * @fileoverview Centralized API client with interceptors for Netlify Functions
 */

import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/.netlify/functions";

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

/**
 * Set the token getter function (called from AuthProvider)
 * @param {Function} getter - Async function that returns the access token
 */
export function setTokenGetter(getter) {
  tokenGetter = getter;
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
      const apiError = new Error(
        typeof data === "string"
          ? data
          : data?.message || `Request failed with status ${status}`,
      );
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
export async function deleteMiyadEvent(eventId) {
  return api.post("/delete-miyad-event", { event_id: eventId });
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
export async function getUserComplaints() {
  return api.get("/user-complaints-list");
}

/**
 * Get complaint messages
 * @param {string} complaintId - Complaint ID
 */
export async function getComplaintMessages(complaintId) {
  return api.get(`/complaint-messages?id=${complaintId}`);
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
  return api.get("/invoices-list");
}

// ===== Promo Functions =====

/**
 * Redeem a promo code
 * @param {string} code - Promo code to redeem
 */
export async function redeemPromoCode(code) {
  return api.post("/promo-redeem", { code });
}

// ===== Admin Functions =====

/**
 * Get admin users list
 */
export async function getAdminUsersList() {
  return api.get("/admin-users-list");
}

/**
 * Activate user subscription (admin only)
 * @param {Object} activationData - Activation data
 */
export async function adminActivateUser(activationData) {
  return api.post("/admin-activate", activationData);
}

/**
 * Get/Create/Update announcements (admin only)
 * @param {Object} data - Announcement data
 */
export async function manageAnnouncement(data) {
  return api.post("/admin-announcement", data);
}

/**
 * Get all complaints (admin only)
 */
export async function getAdminComplaintsList() {
  return api.get("/complaints-list");
}

/**
 * Reply to complaint (admin only)
 * @param {Object} replyData - Reply data
 */
export async function adminReplyToComplaint(replyData) {
  return api.post("/complaints-reply", replyData);
}

/**
 * Update complaint status (admin only)
 * @param {Object} updateData - Update data
 */
export async function updateComplaintStatus(updateData) {
  return api.put("/complaints-update", updateData);
}
