import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Menu,
  X,
  User,
  LogOut,
  Moon,
  Sun,
  Shield,
  Megaphone,
} from "lucide-react";
import { Button } from "@shared/ui/button";
import { useAuth } from "@modules/auth";
import { brand, nav } from "@shared/config/content";
import { useScrollDirection } from "@shared/lib/hooks/useScrollDirection";
import { getAnnouncements } from "@shared/api";

const NAV_LINKS = [
  { label: nav.home, href: "/" },
  { label: nav.programs, href: "/programs" },
  { label: nav.pricing, href: "/pricing" },
];

const getPageIdForRoute = (pathname) => {
  if (pathname === "/" || pathname === "/athar") return "athar";
  if (pathname === "/programs") return "programs";
  if (pathname === "/pricing") return "pricing";
  if (pathname === "/profile") return "profile";

  if (pathname.startsWith("/programs/montalaq")) return "montalaq";
  if (pathname.startsWith("/programs/mueen")) return "mueen";
  if (pathname.startsWith("/programs/murtakiz")) return "darsi";
  if (pathname.startsWith("/programs/miaad")) return "miyad";
  if (pathname.startsWith("/programs/mithaq")) return "mithaq";
  if (pathname.startsWith("/programs/ethraa")) return "ethraa";
  if (pathname.startsWith("/programs/mulham")) return "mulham";
  if (pathname.startsWith("/programs/mutasiq")) return "mutasiq";
  if (pathname.startsWith("/programs/masar")) return "masar";

  return null;
};

const normalizeTargetPages = (value) => {
  if (Array.isArray(value) && value.length > 0) return value;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value.replace(/'/g, '"'));
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      const fallback = value
        .replace(/[[\]"']/g, "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (fallback.length > 0) return fallback;
    }
  }

  return ["all"];
};

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [canAccessAdmin, setCanAccessAdmin] = useState(false);
  const [announcement, setAnnouncement] = useState(null);
  const [isAnnouncementLoading, setIsAnnouncementLoading] = useState(true);
  const scrollDirection = useScrollDirection();
  const location = useLocation();
  const {
    isAuthenticated,
    isLoading,
    user,
    loginWithRedirect,
    logout,
    isAdmin,
  } = useAuth();

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const shouldUseDark = savedTheme ? savedTheme === "dark" : prefersDark;

    setIsDark(shouldUseDark);
    document.documentElement.classList.toggle("dark", shouldUseDark);
  }, []);

  useEffect(() => {
    let alive = true;

    const checkAdmin = async () => {
      if (!isAuthenticated) {
        if (alive) setCanAccessAdmin(false);
        return;
      }
      try {
        const admin = await isAdmin();
        if (alive) setCanAccessAdmin(Boolean(admin));
        return;
      } catch {
        // no-op
      }
      if (alive) setCanAccessAdmin(false);
    };

    checkAdmin();
    return () => {
      alive = false;
    };
  }, [isAuthenticated, user, isAdmin]);

  useEffect(() => {
    let alive = true;

    const fetchAnnouncement = async () => {
      try {
        const data = await getAnnouncements();
        if (alive) setAnnouncement(data?.latest || null);
      } catch {
        if (alive) setAnnouncement(null);
      } finally {
        if (alive) setIsAnnouncementLoading(false);
      }
    };

    fetchAnnouncement();

    return () => {
      alive = false;
    };
  }, []);

  const isAnnouncementVisible = useMemo(() => {
    if (!announcement) return false;

    const targetPages = normalizeTargetPages(announcement.target_pages);
    if (targetPages.includes("all")) return true;

    const currentPageId = getPageIdForRoute(location.pathname);
    return Boolean(currentPageId && targetPages.includes(currentPageId));
  }, [announcement, location.pathname]);

  const handleLogin = () => {
    loginWithRedirect();
  };

  const handleLogout = () => {
    logout({ logoutParams: { returnTo: window.location.origin } });
  };

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    if (newIsDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  return (
    <nav
      className={`fixed top-0 z-50 w-full border-b border-border/60 bg-card/80 font-bold backdrop-blur-md transition-transform duration-300 ${
        scrollDirection === "down" ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="container mx-auto relative flex h-16 items-center justify-between px-4 md:px-8">
        <div className="relative z-20 flex min-w-0 items-center gap-2 md:gap-3">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 group transition-transform hover:scale-[1.02]"
          >
            <span className="text-4xl tracking-tight text-primary font-display dark:text-primary">
              {brand.nameShort}
            </span>
          </Link>

          {(isAnnouncementLoading || isAnnouncementVisible) && (
            <div className="min-w-0 max-w-[44vw] animate-pulse rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 md:max-w-[16rem] md:px-4 md:py-2 lg:max-w-[22rem] xl:max-w-[26rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
              {isAnnouncementLoading ? (
                <div className="h-4 w-20 animate-pulse rounded bg-primary/20 md:w-40" />
              ) : (
                <div className="flex items-center gap-2 text-[11px] text-foreground/85 md:text-xs">
                  <Megaphone className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <p className="leading-none">{announcement?.text}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Desktop Middle Area */}
        <div className="absolute left-1/2 hidden w-[min(62vw,860px)] -translate-x-1/2 items-center justify-center md:flex">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex shrink-0 items-center gap-8">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="text-sm text-foreground/80 transition-colors hover:text-primary"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Auth Buttons & Theme Toggle */}
        <div className="absolute left-4 top-1/2 z-20 flex -translate-y-1/2 items-center gap-2 md:static md:left-auto md:top-auto md:translate-y-0 md:gap-3">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="rounded-full p-2 text-foreground/80 transition-colors hover:bg-secondary hover:text-primary"
            title="تبديل الوضع"
          >
            {isDark ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>

          {/* Auth Buttons - Desktop */}
          <div className="hidden md:flex items-center gap-2">
            {isLoading ? (
              <div className="w-20 h-9 bg-secondary animate-pulse rounded-md" />
            ) : isAuthenticated ? (
              <>
                {canAccessAdmin && (
                  <Link
                    to="/admin"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-secondary hover:text-primary"
                  >
                    <Shield className="h-4 w-4" />
                    {nav.admin}
                  </Link>
                )}
                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-foreground/80 transition-colors hover:text-primary"
                >
                  <User className="w-4 h-4" />
                  {nav.profile}
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-foreground/80 hover:text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="w-4 h-4 ml-2.5" />
                  {nav.logout}
                </Button>
              </>
            ) : (
              <Button
                onClick={handleLogin}
                className="bg-primary hover:bg-brand-2 text-primary-foreground font-semibold rounded-xl px-6"
              >
                {nav.login}
              </Button>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-border bg-card p-4 space-y-4 shadow-lg absolute w-full left-0 top-16">
          <div className="flex flex-col space-y-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="block px-4 py-3 text-foreground font-medium hover:bg-secondary hover:text-primary rounded-xl transition-colors"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}

            {/* Divider */}
            <div className="border-t border-border/50 my-2" />

            {/* Auth Buttons - Mobile */}
            {isLoading ? (
              <div className="w-full h-11 bg-secondary animate-pulse rounded-xl" />
            ) : isAuthenticated ? (
              <>
                {canAccessAdmin && (
                  <Link
                    to="/admin"
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-foreground hover:bg-secondary hover:text-primary transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    <Shield className="w-5 h-5" />
                    {nav.admin}
                  </Link>
                )}
                <Link
                  to="/profile"
                  className="flex items-center gap-3 px-4 py-3 text-foreground hover:bg-secondary hover:text-primary rounded-xl transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  <User className="w-5 h-5" />
                  {nav.profile}
                </Link>
                <button
                  onClick={() => {
                    handleLogout();
                    setIsOpen(false);
                  }}
                  className="flex items-center gap-3 px-4 py-3 text-destructive hover:bg-destructive/10 rounded-xl w-full text-right transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  {nav.logout}
                </button>
              </>
            ) : (
              <Button
                onClick={() => {
                  handleLogin();
                  setIsOpen(false);
                }}
                className="w-full h-12 bg-primary hover:bg-brand-2 text-primary-foreground font-bold rounded-xl"
              >
                {nav.login}
              </Button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
