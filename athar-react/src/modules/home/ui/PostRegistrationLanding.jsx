import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Sparkles,
  Crown,
  LayoutGrid,
  ChevronLeft,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@modules/auth";
import { Layout } from "@modules/layout";
import { ToolsSidebar } from "@modules/layout";
import { Button } from "@shared/ui/button";
import { SEO } from "@shared/seo/SEO";
import { tools } from "@shared/config/content";

/* ─── Tool icon map ────────────────────────────────────────────────── */
const TOOL_ICONS = {
  montalaq: "🚀",
  murtakiz: "🏗️",
  masar: "📅",
  miaad: "🔔",
  mueen: "📋",
  mithaq: "🔗",
  ethraa: "✨",
  mulham: "🎨",
  mutasiq: "📊",
};

/* ─── Featured tools for the hero tabs (first 3) ──────────────────── */
const FEATURED_IDS = ["montalaq", "murtakiz", "mulham"];

export function PostRegistrationLanding() {
  const { user, isAdmin } = useAuth();
  const [canAccessAdmin, setCanAccessAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const firstName = user?.name?.split(" ")[0] || user?.nickname || "أستاذنا";

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const admin = await isAdmin();
        if (alive) setCanAccessAdmin(Boolean(admin));
      } catch {
        if (alive) setCanAccessAdmin(false);
      }
    };
    check();
    return () => {
      alive = false;
    };
  }, [isAdmin]);

  const featuredTools = FEATURED_IDS.map((id) => ({
    id,
    icon: TOOL_ICONS[id],
    ...tools[id],
  }));

  const activeTool = featuredTools[activeTab];

  return (
    <Layout>
      <SEO page="home" />
      {/* pt-16 to clear the fixed navbar */}
      <div className="min-h-[calc(100vh-4rem)] pt-16 flex bg-background">
        {/* ── Tools Sidebar ─────────────────────────────────────────── */}
        <div className="hidden lg:flex p-4 pr-0 flex-shrink-0">
          <ToolsSidebar />
        </div>

        {/* ── Main content ──────────────────────────────────────────── */}
        <div className="flex-1 p-6 md:p-10 overflow-auto">
          {/* Welcome Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-10"
          >
            <h1 className="text-3xl md:text-4xl font-bold text-foreground font-display mb-2">
              حللتَ أهلًا،{" "}
              <span className="scribble text-primary">{firstName}</span>
            </h1>
            <p className="text-muted text-lg">
              جاهز لإحداث أثر جديد في مسيرتك التعليمية اليوم؟
            </p>
          </motion.div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* ── Featured Tool Hero ─────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="xl:col-span-2 space-y-4"
            >
              {/* Tab switcher */}
              <div className="flex gap-2 flex-wrap">
                {featuredTools.map((t, idx) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(idx)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      activeTab === idx
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-card text-muted border border-border hover:border-primary/50 hover:text-primary"
                    }`}
                  >
                    <span>{t.icon}</span>
                    {t.nameShort}
                  </button>
                ))}
                <span className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs text-muted border border-border/50 bg-secondary">
                  <Sparkles className="w-3 h-3 text-primary" />
                  الأبرز
                </span>
              </div>

              {/* Hero card */}
              <motion.div
                key={activeTool.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="glass-card p-8 bg-gradient-to-br from-brand to-brand-2 text-white relative overflow-hidden group"
              >
                <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 group-hover:scale-110 transition-transform duration-700" />

                <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center justify-between">
                  <div>
                    <p className="text-white/70 text-sm font-medium mb-2">
                      {activeTool.tagline}
                    </p>
                    <h2 className="text-2xl md:text-3xl font-bold mb-3 font-display">
                      {activeTool.name}
                    </h2>
                    <p className="text-white/80 mb-6 max-w-md leading-relaxed text-sm">
                      {activeTool.description}
                    </p>
                    <Link to={activeTool.href}>
                      <Button className="bg-white text-brand hover:bg-white/90 font-bold rounded-xl px-6 h-12 shadow-lg w-full md:w-auto">
                        ابدأ الآن
                        <ArrowLeft className="mr-2 w-4 h-4" />
                      </Button>
                    </Link>
                  </div>

                  {/* Icon badge */}
                  <div className="w-40 h-40 bg-white/10 rounded-full flex items-center justify-center shrink-0 backdrop-blur-sm border border-white/20">
                    <span className="text-7xl">{activeTool.icon}</span>
                  </div>
                </div>
              </motion.div>

              {/* Secondary Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link to="/programs">
                  <div className="glass-card p-6 border-border/50 hover:border-primary/50 transition-colors group cursor-pointer bg-card flex flex-col h-full">
                    <div className="w-12 h-12 rounded-xl bg-secondary text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
                      <LayoutGrid className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                      تصفح كافة الأدوات
                    </h3>
                    <p className="text-muted text-sm leading-relaxed mb-4 flex-grow">
                      اكتشف مجموعة أثـر المتكاملة من الأدوات لمختلف احتياجاتك.
                    </p>
                    <span className="text-xs font-bold text-primary flex items-center mt-auto">
                      استكشف الآن <ChevronLeft className="mr-1 w-3 h-3" />
                    </span>
                  </div>
                </Link>

                <Link to="/pricing">
                  <div className="glass-card p-6 border-border/50 hover:border-accent/50 transition-colors group cursor-pointer bg-card flex flex-col h-full">
                    <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-4 group-hover:bg-accent group-hover:text-white transition-colors">
                      <Crown className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-accent transition-colors">
                      ترقية الباقة
                    </h3>
                    <p className="text-muted text-sm leading-relaxed mb-4 flex-grow">
                      احصل على وصول غير محدود لكافة ميزات أثـر المتقدمة.
                    </p>
                    <span className="text-xs font-bold text-accent flex items-center mt-auto">
                      عرض الباقات <ChevronLeft className="mr-1 w-3 h-3" />
                    </span>
                  </div>
                </Link>
              </div>
            </motion.div>

            {/* ── Profile Card ───────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="glass-card p-6 bg-card">
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border/50">
                  <div className="w-16 h-16 rounded-full bg-secondary/80 border-2 border-border flex items-center justify-center overflow-hidden shrink-0">
                    {user?.picture ? (
                      <img
                        src={user.picture}
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl font-bold text-primary">
                        {firstName[0]}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground line-clamp-1">
                      {user?.name || "المستخدم"}
                    </h3>
                    <p className="text-sm text-muted">{user?.email}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <Link to="/profile">
                    <Button
                      variant="outline"
                      className="w-full justify-between h-12 rounded-xl border-border hover:bg-secondary mb-3 cursor-pointer"
                    >
                      إعدادات الحساب
                      <LayoutGrid className="w-4 h-4 ml-2 opacity-50" />
                    </Button>
                  </Link>
                  {canAccessAdmin && (
                    <Link to="/admin">
                      <Button
                        variant="outline"
                        className="w-full justify-between h-12 rounded-xl border-border hover:bg-secondary cursor-pointer"
                      >
                        لوحة الإدارة
                        <Crown className="w-4 h-4 ml-2 opacity-50" />
                      </Button>
                    </Link>
                  )}
                </div>

                {/* Quick-access tool list */}
                <div className="mt-6 pt-6 border-t border-border/50">
                  <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">
                    وصول سريع
                  </p>
                  <div className="space-y-1">
                    {FEATURED_IDS.map((id) => (
                      <Link
                        key={id}
                        to={tools[id].href}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-foreground/70 hover:bg-secondary hover:text-foreground transition-colors"
                      >
                        <span className="text-base">{TOOL_ICONS[id]}</span>
                        {tools[id].nameShort}
                        <ChevronLeft className="w-3 h-3 mr-auto text-muted" />
                      </Link>
                    ))}
                    <Link
                      to="/programs"
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-primary font-bold hover:bg-primary/10 transition-colors"
                    >
                      <LayoutGrid className="w-4 h-4" />
                      كل الأدوات
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
