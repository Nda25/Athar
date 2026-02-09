import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
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
  Layers,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@shared/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@shared/ui/sheet"; // Assuming Sheet is available or using simple mobile menu

export default function AdminLayout() {
  const { logout, user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout({ logoutParams: { returnTo: window.location.origin } });
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
    { to: "/admin/categories", icon: Layers, label: "التصنيفات" },
  ];

  const SidebarContent = () => (
    <div className="flex h-full flex-col gap-4">
      <div className="flex h-16 items-center border-b px-6">
        <Link
          to="/"
          className="flex items-center gap-2 font-bold text-xl text-blue-600"
        >
          <span>أثر</span>
          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
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
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="border-t p-4">
        <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 mb-2">
          <img
            src={user?.picture}
            alt={user?.name}
            className="h-9 w-9 rounded-full bg-slate-200"
          />
          <div className="flex flex-col overflow-hidden">
            <span className="truncate text-sm font-medium text-slate-900">
              {user?.name}
            </span>
            <span className="truncate text-xs text-slate-500">
              {user?.email}
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-slate-600"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          تسجيل الخروج
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50" dir="rtl">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 border-l bg-white shadow-sm lg:fixed lg:inset-y-0 lg:flex lg:flex-col">
        <SidebarContent />
      </aside>

      {/* Header & Main Content */}
      <div className="lg:mr-64 min-h-screen flex flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-white/80 px-4 backdrop-blur lg:px-8">
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
            <h1 className="text-lg font-semibold text-slate-800">
              أهلاً بك، {user?.given_name || "Admin"} 👋
            </h1>
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
          <div className="fixed inset-y-0 right-0 w-64 bg-white shadow-xl animate-in slide-in-from-right">
            <SidebarContent />
          </div>
        </div>
      )}
    </div>
  );
}
