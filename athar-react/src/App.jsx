/**
 * Athar React Application - Main Entry Point
 * @fileoverview App providers and routing configuration
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/features/auth/AuthProvider";
import {
  ProtectedRoute,
  SubscriptionRoute,
  AdminRoute,
} from "@/features/auth/ProtectedRoute";

// Pages (to be created)
import HomePage from "@/pages/Home";
// import ProgramsPage from '@/pages/Programs'
// import PricingPage from '@/pages/Pricing'
// import ProfilePage from '@/pages/Profile'
// import AdminPage from '@/pages/Admin'

// Create a React Query client with defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            {/* <Route path="/programs" element={<ProgramsPage />} /> */}
            {/* <Route path="/pricing" element={<PricingPage />} /> */}

            {/* Login Required Routes */}
            {/* <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            /> */}

            {/* Subscription Required Routes (Tools) */}
            {/* <Route
              path="/athar"
              element={
                <SubscriptionRoute>
                  <AtharPage />
                </SubscriptionRoute>
              }
            /> */}

            {/* Admin Routes */}
            {/* <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminPage />
                </AdminRoute>
              }
            /> */}
          </Routes>

          {/* Toast notifications */}
          <Toaster richColors position="bottom-left" dir="rtl" />
        </AuthProvider>
      </BrowserRouter>

      {/* React Query DevTools (only in development) */}
      {import.meta.env.VITE_ENABLE_DEVTOOLS === "true" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}

export default App;
