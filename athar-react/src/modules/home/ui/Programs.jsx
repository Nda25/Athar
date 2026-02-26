import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Rocket,
  Anchor,
  Calendar,
  Clock,
  Layout,
  BookOpen,
  Sparkles,
  Bot,
  ClipboardCheck,
} from "lucide-react";
import { tools, common } from "@shared/config/content";

// Map tool IDs to icons and colors
const TOOL_CONFIG = {
  montalaq: {
    icon: Rocket,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-500/10",
    borderColor: "border-blue-200 dark:border-blue-900",
    active: true,
  },
  murtakiz: {
    icon: Anchor,
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    borderColor: "border-emerald-200 dark:border-emerald-900",
    active: true,
  },
  masar: {
    icon: Layout,
    color: "text-purple-600",
    bg: "bg-purple-50 dark:bg-purple-500/10",
    borderColor: "border-purple-200 dark:border-purple-900",
    active: true,
  },
  miaad: {
    icon: Clock,
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    borderColor: "border-amber-200 dark:border-amber-900",
    active: true,
  },
  mueen: {
    icon: Calendar,
    color: "text-cyan-600",
    bg: "bg-cyan-50 dark:bg-cyan-500/10",
    borderColor: "border-cyan-200 dark:border-cyan-900",
    active: true,
  },
  mithaq: {
    icon: BookOpen,
    color: "text-rose-600",
    bg: "bg-rose-50 dark:bg-rose-500/10",
    borderColor: "border-rose-200 dark:border-rose-900",
    active: true,
  },
  ethraa: {
    icon: Sparkles,
    color: "text-indigo-600",
    bg: "bg-indigo-50 dark:bg-indigo-500/10",
    borderColor: "border-indigo-200 dark:border-indigo-900",
    active: true,
  },
  mulham: {
    icon: Bot,
    color: "text-pink-600",
    bg: "bg-pink-50 dark:bg-pink-500/10",
    borderColor: "border-pink-200 dark:border-pink-900",
    active: true,
  },
  mutasiq: {
    icon: ClipboardCheck,
    color: "text-teal-600",
    bg: "bg-teal-50 dark:bg-teal-500/10",
    borderColor: "border-teal-200 dark:border-teal-900",
    active: true,
  },
};

// Merge content with config
const TOOLS_LIST = Object.entries(tools)
  .map(([id, tool]) => {
    const config = TOOL_CONFIG[id];
    if (!tool || !config) return null;
    return { ...tool, ...config, id };
  })
  .filter(Boolean);

export function Programs() {
  return (
    <section className="landing-section bg-card pb-32">
      <div className="landing-container">
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-foreground mb-6 font-display"
          >
            أدوات <span className="scribble text-primary">أثــر</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            viewport={{ once: true }}
            className="text-lg text-muted max-w-2xl mx-auto"
          >
            مجموعة متكاملة من الأدوات الذكية والمبتكرة لمساعدة المعلم في كل خطوة
            من رحلته التعليمية
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {TOOLS_LIST.map((tool, idx) => (
            <motion.div
              key={tool.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: (idx % 4) * 0.1 }}
              viewport={{ once: true, margin: "-50px" }}
            >
              <div
                className={`flex flex-col h-full bg-background rounded-2xl border ${tool.borderColor} shadow-sm hover:shadow-premium transition-all duration-300 relative overflow-hidden group ${!tool.active ? "opacity-80 grayscale-[30%]" : ""}`}
              >
                {/* Hover Glow Effect */}
                <div
                  className={`absolute top-0 right-0 w-32 h-32 ${tool.bg} rounded-full blur-[40px] -translate-y-1/2 translate-x-1/2 group-hover:blur-3xl transition-all duration-500`}
                />

                <div className="p-6 md:p-8 flex flex-col flex-grow relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <div
                      className={`w-14 h-14 rounded-[1rem] ${tool.bg} flex items-center justify-center ${tool.color} group-hover:scale-110 transition-transform duration-300 border border-white/40 dark:border-white/5`}
                    >
                      <tool.icon className="w-7 h-7 stroke-[2]" />
                    </div>

                    {!tool.active && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded bg-secondary text-muted uppercase tracking-wider">
                        قريباً
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                    {tool.name}
                  </h3>

                  <p className="text-muted leading-relaxed font-medium mb-6 flex-grow">
                    {tool.description}
                  </p>

                  <div className="pt-4 border-t border-border/40 mt-auto">
                    {tool.active ? (
                      <Link
                        to={tool.href}
                        className={`text-sm font-bold ${tool.color} flex items-center gap-2 group/link w-fit`}
                      >
                        {common.buttons.tryNow}
                        <span className="transition-transform group-hover/link:-translate-x-1">
                          &larr;
                        </span>
                      </Link>
                    ) : (
                      <span className="cursor-not-allowed text-sm font-medium text-muted/60">
                        {common.buttons.notAvailable}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
