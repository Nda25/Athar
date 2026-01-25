import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X, User, LogOut, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthProvider";
import { brand, nav } from "@/content";

const NAV_LINKS = [
  { label: nav.home, href: "/" },
  { label: nav.programs, href: "/programs" },
  { label: nav.pricing, href: "/pricing" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const { isAuthenticated, isLoading, user, loginWithRedirect, logout } =
    useAuth();
  const navigate = useNavigate();

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
    <nav className="fixed top-0 z-50 w-full bg-transparent border-b-0 transition-all duration-300">
      <div className="container mx-auto px-4 md:px-8 h-16 flex items-center justify-between relative">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold text-brand tracking-tight">
            {brand.nameShort}
          </span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="text-muted hover:text-brand font-medium transition-colors text-sm"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Auth Buttons & Theme Toggle */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-sea-50 text-muted transition-colors"
            title="تبديل الوضع"
          >
            {isDark ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>

          {/* Auth Buttons - Desktop */}
          <div className="hidden md:flex items-center gap-3">
            {isLoading ? (
              <div className="w-20 h-9 bg-sea-100 animate-pulse rounded-md" />
            ) : isAuthenticated ? (
              <>
                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-ink hover:text-brand transition-colors"
                >
                  <User className="w-4 h-4" />
                  {nav.profile}
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-muted hover:text-red-600"
                >
                  <LogOut className="w-4 h-4 ml-2" />
                  {nav.logout}
                </Button>
              </>
            ) : (
              <Button
                onClick={handleLogin}
                variant="ghost"
                className="text-muted hover:text-brand hover:bg-sea-50"
              >
                {nav.login}
              </Button>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 text-ink"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-sea-200 dark:border-sea-800 bg-bg p-4 space-y-4 shadow-lg absolute w-full left-0 top-16">
          <div className="flex flex-col space-y-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="block px-4 py-3 text-ink hover:bg-sea-50 rounded-lg"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}

            {/* Divider */}
            <div className="border-t border-sea-100 my-2" />

            {/* Auth Buttons - Mobile */}
            {isLoading ? (
              <div className="w-full h-10 bg-sea-100 animate-pulse rounded-md" />
            ) : isAuthenticated ? (
              <>
                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-4 py-3 text-ink hover:bg-sea-50 rounded-lg"
                  onClick={() => setIsOpen(false)}
                >
                  <User className="w-4 h-4" />
                  {nav.profile}
                </Link>
                <button
                  onClick={() => {
                    handleLogout();
                    setIsOpen(false);
                  }}
                  className="flex items-center gap-2 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg w-full text-right"
                >
                  <LogOut className="w-4 h-4" />
                  {nav.logout}
                </button>
              </>
            ) : (
              <Button
                onClick={() => {
                  handleLogin();
                  setIsOpen(false);
                }}
                className="w-full bg-brand hover:bg-brand-2"
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
