import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

export function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col font-sans bg-[var(--bg)] text-[var(--ink)]">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
