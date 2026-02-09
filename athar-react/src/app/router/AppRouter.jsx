import { Route, Routes } from "react-router-dom";
import { AdminRoute, ProtectedRoute, SubscriptionRoute } from "@modules/auth";
import { AdminLayout } from "@modules/admin/ui";
import { HomePage } from "@modules/home";
import {
  AdminActivationPage,
  AdminAnnouncementsPage,
  AdminCategoriesPage,
  AdminComplaintsPage,
  AdminDashboardPage,
  AdminInvoicesPage,
  AdminUsersPage,
} from "@modules/admin";
import { ComplaintsPage } from "@modules/complaints";
import { PrivacyPage, RefundPage, TermsPage } from "@modules/legal";
import { PricingPage } from "@modules/pricing";
import {
  ProgramsPage,
  EthraaPage,
  MasarPage,
  MiaadPage,
  MithaqPage,
  MueenPage,
  MulhamPage,
  MuntalaqPage,
  MutasiqPage,
  MurtakizPage,
} from "@modules/programs";
import { ProfilePage } from "@modules/profile";
import { NotFoundPage } from "@modules/system";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/programs" element={<ProgramsPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/refund" element={<RefundPage />} />
      <Route path="/complaints" element={<ComplaintsPage />} />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/athar"
        element={
          <SubscriptionRoute>
            <MuntalaqPage />
          </SubscriptionRoute>
        }
      />
      <Route
        path="/programs/montalaq"
        element={
          <SubscriptionRoute>
            <MuntalaqPage />
          </SubscriptionRoute>
        }
      />
      <Route
        path="/programs/murtakiz"
        element={
          <SubscriptionRoute>
            <MurtakizPage />
          </SubscriptionRoute>
        }
      />
      <Route
        path="/programs/masar"
        element={
          <SubscriptionRoute>
            <MasarPage />
          </SubscriptionRoute>
        }
      />
      <Route
        path="/programs/miaad"
        element={
          <SubscriptionRoute>
            <MiaadPage />
          </SubscriptionRoute>
        }
      />
      <Route
        path="/programs/mueen"
        element={
          <SubscriptionRoute>
            <MueenPage />
          </SubscriptionRoute>
        }
      />
      <Route
        path="/programs/mithaq"
        element={
          <SubscriptionRoute>
            <MithaqPage />
          </SubscriptionRoute>
        }
      />
      <Route
        path="/programs/ethraa"
        element={
          <SubscriptionRoute>
            <EthraaPage />
          </SubscriptionRoute>
        }
      />
      <Route
        path="/programs/mulham"
        element={
          <SubscriptionRoute>
            <MulhamPage />
          </SubscriptionRoute>
        }
      />
      <Route
        path="/programs/mutasiq"
        element={
          <SubscriptionRoute>
            <MutasiqPage />
          </SubscriptionRoute>
        }
      />

      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="activation" element={<AdminActivationPage />} />
          <Route path="announcements" element={<AdminAnnouncementsPage />} />
          <Route path="complaints" element={<AdminComplaintsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="invoices" element={<AdminInvoicesPage />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
