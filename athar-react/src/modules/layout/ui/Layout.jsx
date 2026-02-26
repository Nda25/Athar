import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { AnnouncementBanner } from "./AnnouncementBanner";

export function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <AnnouncementBanner />
      <Navbar />
      <main className="flex-1 w-full relative">{children}</main>
      <Footer />
    </div>
  );
}
