/**
 * Supabase Client Configuration
 * @fileoverview Singleton Supabase client for frontend usage
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[Supabase] Missing environment variables. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Auth handled by Auth0
  },
});

/**
 * Fetch user status from Supabase view
 * @param {string} userSub - Auth0 user subject ID
 * @param {string} email - User email
 * @returns {Promise<{active: boolean, status: string, expiresAt: string|null}>}
 */
export async function fetchUserStatusFromSupabase(userSub, email) {
  try {
    const { data, error } = await supabase
      .from("v_user_status")
      .select("status, active, expires_at")
      .or(`user_sub.eq.${userSub},email.eq.${email?.toLowerCase()}`)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[Supabase] Error fetching user status:", error);
      return { active: false, status: "none", expiresAt: null };
    }

    if (data) {
      return {
        active: !!data.active,
        status: data.active ? "active" : data.status || "none",
        expiresAt: data.expires_at || null,
      };
    }

    return { active: false, status: "none", expiresAt: null };
  } catch (err) {
    console.error("[Supabase] Unexpected error:", err);
    return { active: false, status: "none", expiresAt: null };
  }
}
