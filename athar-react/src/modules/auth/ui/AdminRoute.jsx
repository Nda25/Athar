import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@modules/auth/model";
import { useEffect, useState } from "react";

export default function AdminRoute() {
  const { isAuthenticated, isLoading, isAdmin, loginWithRedirect } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(null);

  useEffect(() => {
    const checkAdmin = async () => {
      if (isLoading) return;

      if (!isAuthenticated) {
        // Option A: Redirect to login
        // loginWithRedirect({ appState: { returnTo: "/admin" } });
        // Option B: Mark as unauthorized to show login prompt or redirect
        setIsAuthorized(false);
        return;
      }

      const admin = await isAdmin();
      setIsAuthorized(admin);
    };

    checkAdmin();
  }, [isAuthenticated, isLoading, isAdmin]);

  if (isLoading || isAuthorized === null) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-muted-foreground animate-pulse text-sm">
            التحقق من الصلاحيات...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (!isAuthorized) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-slate-50 p-4">
        <div className="rounded-full bg-red-100 p-4 text-red-600">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">الوصول مرفوض</h1>
        <p className="text-center text-slate-600">
          عذراً، لا تملك الصلاحيات اللازمة للوصول إلى لوحة الإدارة.
        </p>
        <a
          href="/"
          className="rounded-lg bg-slate-900 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          العودة للرئيسية
        </a>
      </div>
    );
  }

  return <Outlet />;
}
