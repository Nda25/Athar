import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Rocket,
  Anchor,
  Calendar,
  Clock,
  Layout as LayoutIcon,
  BookOpen,
  Sparkles,
  Bot,
  ClipboardCheck,
} from "lucide-react";
import { Layout } from "@modules/layout";
import { Link } from "react-router-dom";
import { tools } from "@shared/config/content";
import { SEO } from "@shared/seo/SEO";

/* ─── Constants ──────────────────────────────────────────────────── */
const ACTIVE_IDS = new Set([
  "montalaq",
  "murtakiz",
  "masar",
  "miaad",
  "mueen",
  "mithaq",
  "ethraa",
  "mulham",
  "mutasiq",
]);

const TOOL_CONFIG = {
  montalaq: {
    icon: Rocket,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-500/10",
  },
  murtakiz: {
    icon: Anchor,
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
  },
  masar: {
    icon: LayoutIcon,
    color: "text-purple-600",
    bg: "bg-purple-50 dark:bg-purple-500/10",
  },
  miaad: {
    icon: Clock,
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-500/10",
  },
  mueen: {
    icon: Calendar,
    color: "text-cyan-600",
    bg: "bg-cyan-50 dark:bg-cyan-500/10",
  },
  mithaq: {
    icon: BookOpen,
    color: "text-rose-600",
    bg: "bg-rose-50 dark:bg-rose-500/10",
  },
  ethraa: {
    icon: Sparkles,
    color: "text-indigo-600",
    bg: "bg-indigo-50 dark:bg-indigo-500/10",
  },
  mulham: {
    icon: Bot,
    color: "text-pink-600",
    bg: "bg-pink-50 dark:bg-pink-500/10",
  },
  mutasiq: {
    icon: ClipboardCheck,
    color: "text-teal-600",
    bg: "bg-teal-50 dark:bg-teal-500/10",
  },
};

const CATEGORY_MAP = {
  montalaq: "التخطيط والتحضير",
  murtakiz: "التخطيط والتحضير",
  mueen: "التخطيط والتحضير",
  masar: "التنظيم والجدولة",
  miaad: "التنظيم والجدولة",
  mithaq: "الإثراء والتفاعل",
  ethraa: "الإثراء والتفاعل",
  mulham: "الإثراء والتفاعل",
  mutasiq: "المتابعة والتقييم",
};

// Ordered category list with subtle accent colors
const CATEGORIES = [
  { label: "الكل", color: "text-primary", bg: "bg-primary/10" },
  {
    label: "التخطيط والتحضير",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
  },
  {
    label: "التنظيم والجدولة",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    label: "الإثراء والتفاعل",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-900/20",
  },
  {
    label: "المتابعة والتقييم",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/20",
  },
];

const getCategoryStyle = (label) =>
  CATEGORIES.find((c) => c.label === label) || CATEGORIES[0];

/* ─── Component ──────────────────────────────────────────────────── */
export default function ProgramsList() {
  const [activeCategory, setActiveCategory] = useState("الكل");

  const allPrograms = useMemo(
    () =>
      Object.entries(tools).map(([id, tool]) => ({
        id,
        title: tool.name,
        nameShort: tool.nameShort,
        desc: tool.description,
        tagline: tool.tagline,
        href: tool.href,
        config: TOOL_CONFIG[id],
        category: CATEGORY_MAP[id] || "أدوات ذكية",
        active: ACTIVE_IDS.has(id),
      })),
    [],
  );

  const filteredPrograms =
    activeCategory === "الكل"
      ? allPrograms
      : allPrograms.filter((p) => p.category === activeCategory);

  // Count per category (excluding "الكل")
  const countMap = useMemo(() => {
    const m = {};
    allPrograms.forEach((p) => {
      m[p.category] = (m[p.category] || 0) + 1;
    });
    return m;
  }, [allPrograms]);

  return (
    <Layout>
      <SEO page="programs" />

      {/* pt-16 to offset the fixed navbar */}
      <div className="pt-16 min-h-screen bg-background">
        {/* ── Page Header ─────────────────────────────────────────── */}
        <div className="border-b border-border/50 bg-card/50">
          <div className="container mx-auto px-6 md:px-10 py-10">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-3xl md:text-4xl font-bold font-display text-foreground mb-3">
                مساحة إبداعي
              </h1>
              <p className="text-muted max-w-xl leading-relaxed">
                اختر الأداة المناسبة لمرحلتك التعليمية، وابدأ التحضير الذكي
                مباشرة.
              </p>
            </motion.div>
          </div>
        </div>

        {/* ── Two-column layout ────────────────────────────────────── */}
        <div className="container mx-auto px-6 md:px-10 py-10 flex gap-8 items-start">
          {/* ── Category Sidebar ─────────────────────────────────── */}
          <aside className="hidden md:flex flex-col gap-1 w-56 flex-shrink-0 sticky top-24">
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest px-3 mb-2">
              التصنيفات
            </p>
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.label;
              const count =
                cat.label === "الكل"
                  ? allPrograms.length
                  : countMap[cat.label] || 0;
              return (
                <button
                  key={cat.label}
                  onClick={() => setActiveCategory(cat.label)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-right transition-all ${
                    isActive
                      ? `${cat.bg} ${cat.color} font-bold`
                      : "text-foreground/60 hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <span>{cat.label}</span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                      isActive ? cat.bg : "bg-secondary text-muted"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </aside>

          {/* ── Tool Cards Grid ──────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {/* Mobile category pills */}
            <div className="flex gap-2 flex-wrap mb-6 md:hidden">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.label}
                  onClick={() => setActiveCategory(cat.label)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    activeCategory === cat.label
                      ? `${cat.bg} ${cat.color} font-bold`
                      : "bg-card text-muted border border-border"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeCategory}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5"
              >
                {filteredPrograms.map((prog, i) => {
                  const catStyle = getCategoryStyle(prog.category);
                  return (
                    <motion.div
                      key={prog.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04 }}
                    >
                      <Link
                        to={prog.active ? prog.href : "#"}
                        onClick={(e) => {
                          if (!prog.active) e.preventDefault();
                        }}
                        className={prog.active ? "" : "cursor-default"}
                      >
                        <div
                          className={`glass-card p-6 h-full flex flex-col gap-3 transition-all duration-200 group ${
                            prog.active
                              ? "hover:shadow-premium-hover hover:border-primary/40 hover:-translate-y-0.5"
                              : "opacity-60"
                          }`}
                        >
                          {/* Top row: icon + badge */}
                          <div className="flex items-start justify-between">
                            <div
                              className={`w-12 h-12 rounded-2xl ${prog.config?.bg || "bg-secondary"} flex items-center justify-center ${prog.config?.color || "text-foreground"} group-hover:scale-110 transition-transform duration-200`}
                            >
                              {prog.config?.icon && (
                                <prog.config.icon className="w-6 h-6 stroke-[2]" />
                              )}
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-1 rounded-full ${catStyle.bg} ${catStyle.color}`}
                            >
                              {prog.category}
                            </span>
                          </div>

                          {/* Title */}
                          <div>
                            <h3 className="font-bold text-foreground text-lg font-display group-hover:text-primary transition-colors">
                              {prog.nameShort}
                            </h3>
                            <p className="text-xs text-muted/80 mt-0.5 italic">
                              {prog.tagline}
                            </p>
                          </div>

                          {/* Description */}
                          <p className="text-sm text-muted leading-relaxed flex-1">
                            {prog.desc}
                          </p>

                          {/* CTA row */}
                          <div className="mt-auto pt-3 border-t border-border/40 flex items-center justify-between">
                            {prog.active ? (
                              <span className="text-xs font-bold text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
                                افتح الأداة
                                <ArrowLeft className="w-3 h-3" />
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-muted bg-secondary px-2 py-1 rounded-full">
                                قريبًا
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </motion.div>
            </AnimatePresence>

            {filteredPrograms.length === 0 && (
              <div className="text-center py-20 text-muted">
                لا توجد أدوات في هذا التصنيف حالياً
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
