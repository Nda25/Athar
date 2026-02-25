import { useAuth } from "@modules/auth";
import { PreRegistrationLanding } from "../ui/PreRegistrationLanding";
import { PostRegistrationLanding } from "../ui/PostRegistrationLanding";

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    // A simple beautiful loader while auth state resolves
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <PostRegistrationLanding />;
  }

  return <PreRegistrationLanding />;
}
