import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { AnnouncementBanner } from "./AnnouncementBanner";

export function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col font-sans bg-[var(--bg)] text-[var(--ink)]">
      <Navbar />
      <AnnouncementBanner />
      <main className="flex-1 mt-16">{children}</main>
      <Footer />
    </div>
  );
}
