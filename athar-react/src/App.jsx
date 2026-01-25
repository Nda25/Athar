import { Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Profile from "@/pages/Profile";
import ProgramsList from "@/pages/ProgramsList";
import NotFound from "@/pages/NotFound";
import MuntalaqPage from "@/pages/tools/MuntalaqPage";
import {
  SubscriptionRoute,
  ProtectedRoute,
} from "@/features/auth/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/programs" element={<ProgramsList />} />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
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
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
