/**
 * Protected Route Component
 * @fileoverview Route wrapper that requires authentication and optional subscription
 */

import { useAuth } from "@modules/auth/model";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { checkUserStatus } from "@shared/api";

/**
 * Loading spinner component
 */
function LoadingSpinner({ message = "جاري التحقق..." }) {
  return (
    <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
      <div className="text-center text-white">
        <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm opacity-90">{message}</p>
      </div>
    </div>
  );
}

/**
 * Route that requires user to be logged in
 */
export function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner message="جاري التحقق من الصلاحيات..." />;
  }

  if (!isAuthenticated) {
    // Store the intended destination
    loginWithRedirect({
      appState: { returnTo: location.pathname + location.search },
    });
    return <LoadingSpinner message="جاري توجيهك لتسجيل الدخول..." />;
  }

  return children;
}

/**
 * Route that requires active subscription
 */
export function SubscriptionRoute({ children }) {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth();
  const location = useLocation();

  // Axios interceptor handles auth automatically
  const { data: userStatus, isLoading: statusLoading } = useQuery({
    queryKey: ["userStatus"],
    queryFn: checkUserStatus,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  if (isLoading || statusLoading) {
    return <LoadingSpinner message="جاري التحقق من الاشتراك..." />;
  }

  if (!isAuthenticated) {
    loginWithRedirect({
      appState: { returnTo: location.pathname + location.search },
    });
    return <LoadingSpinner message="جاري توجيهك لتسجيل الدخول..." />;
  }

  if (!userStatus?.active) {
    return (
      <Navigate
        to="/pricing"
        state={{ message: "يجب تفعيل الاشتراك للوصول لهذه الصفحة" }}
        replace
      />
    );
  }

  return children;
}

/**
 * Route that requires admin role
 */
export function AdminRoute({ children }) {
  const { isAuthenticated, isLoading, isAdmin, loginWithRedirect } = useAuth();
  const location = useLocation();

  // Axios interceptor handles auth automatically
  const { data: userStatus, isLoading: statusLoading } = useQuery({
    queryKey: ["userStatus"],
    queryFn: checkUserStatus,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: adminCheck, isLoading: adminLoading } = useQuery({
    queryKey: ["adminCheck"],
    queryFn: isAdmin,
    enabled: isAuthenticated,
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading || statusLoading || adminLoading) {
    return <LoadingSpinner message="جاري التحقق من صلاحيات الأدمن..." />;
  }

  if (!isAuthenticated) {
    loginWithRedirect({
      appState: { returnTo: location.pathname + location.search },
    });
    return <LoadingSpinner message="جاري توجيهك لتسجيل الدخول..." />;
  }

  if (!userStatus?.active || !adminCheck) {
    return (
      <Navigate
        to="/"
        state={{ message: "هذه الصفحة للمسؤولين فقط" }}
        replace
      />
    );
  }

  return children;
}
