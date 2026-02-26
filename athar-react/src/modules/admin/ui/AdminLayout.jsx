import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@modules/auth";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  MessageSquare,
  LogOut,
  Menu,
  X,
  Package,
  Moon,
  Sun,
  Home,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@shared/ui/button";

export default function AdminLayout() {
  const { logout, user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const shouldUseDark = savedTheme ? savedTheme === "dark" : prefersDark;

    setIsDark(shouldUseDark);
    document.documentElement.classList.toggle("dark", shouldUseDark);
  }, []);

  const handleLogout = () => {
    logout({ logoutParams: { returnTo: window.location.origin } });
  };

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const navItems = [
    { to: "/admin", icon: LayoutDashboard, label: "الرئيسية", end: true },
    { to: "/admin/activation", icon: Users, label: "التفعيل اليدوي" },
    { to: "/admin/announcements", icon: Megaphone, label: "الإعلانات" },
    {
      to: "/admin/complaints",
      icon: MessageSquare,
      label: "الشكاوى والاقتراحات",
    },
    { to: "/admin/users", icon: Users, label: "المستخدمين" },
    { to: "/admin/invoices", icon: Package, label: "الفواتير والطلبات" },
  ];

  const SidebarContent = () => (
    <div className="flex h-full flex-col gap-4 bg-card">
      <div className="flex h-16 items-center border-b border-border px-6">
        <Link
          to="/"
          className="flex items-center gap-2 text-xl font-bold text-primary"
        >
          <span>أثر</span>
          <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
            للإدارة
          </span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="border-t border-border p-4">
        <div className="mb-2 flex items-center gap-3 rounded-lg bg-secondary p-3">
          <img
            src={user?.picture}
            alt={user?.name}
            className="h-9 w-9 rounded-full bg-secondary"
          />
          <div className="flex flex-col overflow-hidden">
            <span className="truncate text-sm font-medium text-foreground">
              {user?.name}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {user?.email}
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-muted-foreground transition-all duration-200 hover:text-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          تسجيل الخروج
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 border-l border-border bg-card shadow-sm lg:fixed lg:inset-y-0 lg:flex lg:flex-col">
        <SidebarContent />
      </aside>

      {/* Header & Main Content */}
      <div className="lg:mr-64 min-h-screen flex flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-card px-4 lg:px-8">
          <div className="flex items-center gap-4 lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X /> : <Menu />}
            </Button>
            <span className="font-bold text-lg">لوحة الإدارة</span>
          </div>

          <div className="hidden lg:block">
            <h1 className="text-lg font-semibold text-foreground">
              أهلاً بك، {user?.given_name || "Admin"} 👋
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              asChild
              title="العودة للصفحة الرئيسية"
              className="text-muted-foreground hover:bg-secondary transition-all duration-200 hover:-translate-y-0.5"
            >
              <Link to="/">
                <Home className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              title="تبديل الوضع"
              className="text-muted-foreground hover:bg-secondary transition-all duration-200 hover:-translate-y-0.5"
            >
              {isDark ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 w-64 bg-card shadow-xl animate-in slide-in-from-right">
            <SidebarContent />
          </div>
        </div>
      )}
    </div>
  );
}
