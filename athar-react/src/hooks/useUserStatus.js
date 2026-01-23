/**
 * User Status Hook
 * @fileoverview React Query hook for user subscription status
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthProvider";
import { checkUserStatus } from "@/services/api";

/**
 * Hook to get and cache user subscription status
 */
export function useUserStatus() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["userStatus"],
    queryFn: checkUserStatus, // No need to pass token - Axios interceptor handles it
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  /**
   * Manually refresh user status
   */
  const refreshStatus = () => {
    return queryClient.invalidateQueries({ queryKey: ["userStatus"] });
  };

  return {
    status: query.data?.status || "none",
    isActive: query.data?.active || false,
    expiresAt: query.data?.expires_at || null,
    userSub: query.data?.user_sub || null,
    email: query.data?.email || null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refreshStatus,
  };
}
