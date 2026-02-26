/**
 * ToolsSidebar — Collapsible sidebar listing all Athar tools, grouped by category.
 * Used by: PostRegistrationLanding, ToolLayout
 */
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronRight,
  ChevronLeft,
  LayoutGrid,
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
import { tools } from "@shared/config/content";

/* ─── Category grouping ──────────────────────────────────────────── */
const CATEGORIES = [
  {
    label: "التخطيط والتحضير",
    ids: ["montalaq", "murtakiz", "mueen"],
  },
  {
    label: "التنظيم والجدولة",
    ids: ["masar", "miaad"],
  },
  {
    label: "الإثراء والتفاعل",
    ids: ["mithaq", "ethraa", "mulham"],
  },
  {
    label: "المتابعة والتقييم",
    ids: ["mutasiq"],
  },
];

/* ─── Tool icon + color map (matches Programs.jsx) ───────────────── */
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

export function ToolsSidebar({ className = "" }) {
  const [isOpen, setIsOpen] = useState(true);
  const location = useLocation();

  return (
    <aside
      className={`shrink-0 transition-all duration-300 ease-in-out h-fit ${
        isOpen ? "w-64" : "w-[70px]"
      } ${className}`}
    >
      <div className="glass-card h-full p-3 flex flex-col gap-1 overflow-hidden">
        {/* Header / Toggle */}
        <div className="flex items-center justify-between mb-2 px-1">
          {isOpen && (
            <span className="text-xs font-bold text-muted uppercase tracking-widest animate-in fade-in slide-in-from-right-2 duration-300 delay-150 fill-mode-both">
              الأدوات
            </span>
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="rounded-lg p-2 text-muted hover:bg-secondary hover:text-primary transition-colors ml-auto"
            title={isOpen ? "إخفاء الشريط" : "إظهار الشريط"}
          >
            {isOpen ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <LayoutGrid className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Tool list */}
        <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
          {CATEGORIES.map((cat) => {
            const catTools = cat.ids
              .map((id) => {
                const tool = tools[id];
                const config = TOOL_CONFIG[id];
                if (!tool || !config) return null;
                return { ...tool, id, config };
              })
              .filter(Boolean);

            return (
              <div key={cat.label} className="mb-2">
                {/* Category label — only visible when open */}
                {isOpen && (
                  <p className="text-[10px] font-bold text-muted/60 uppercase tracking-widest px-2 py-1 animate-in fade-in slide-in-from-right-2 duration-300 delay-150 fill-mode-both">
                    {cat.label}
                  </p>
                )}

                {catTools.map((tool) => {
                  const isActive = location.pathname === tool.href;
                  return (
                    <Link
                      key={`${cat.label}-${tool.id}`}
                      to={tool.href}
                      title={!isOpen ? tool.nameShort : undefined}
                      className={`flex items-center gap-2.5 px-2 py-2 rounded-xl text-sm font-medium transition-colors group ${
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-foreground/70 hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${tool.config.bg} ${tool.config.color}`}
                      >
                        <tool.config.icon className="w-4 h-4 stroke-[2]" />
                      </div>
                      {isOpen && (
                        <span className="truncate animate-in fade-in duration-300 delay-200 fill-mode-both">
                          {tool.nameShort}
                        </span>
                      )}
                      {isOpen && isActive && (
                        <ChevronLeft className="w-3 h-3 mr-auto opacity-60 animate-in fade-in duration-300 delay-200 fill-mode-both" />
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Browse all link */}
        {isOpen ? (
          <Link
            to="/programs"
            className="flex items-center gap-2 px-2 py-2 rounded-xl text-xs font-bold text-muted hover:bg-secondary hover:text-primary transition-colors border border-border/50 mt-2"
          >
            <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
            <span className="animate-in fade-in duration-300 delay-[250ms] fill-mode-both">
              كافة الأدوات
            </span>
          </Link>
        ) : (
          <Link
            to="/programs"
            className="flex items-center justify-center gap-2 px-2 py-2 rounded-xl text-xs font-bold text-muted hover:bg-secondary hover:text-primary transition-colors border border-border/50 mt-2"
          >
            <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
          </Link>
        )}
      </div>
    </aside>
  );
}
