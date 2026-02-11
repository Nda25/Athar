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
import { Card, CardHeader, CardTitle, CardContent } from "@shared/ui/card";
import { Badge } from "@shared/ui/badge";
import { tools, common } from "@shared/config/content";

// Map tool IDs to icons and colors
const TOOL_CONFIG = {
  montalaq: {
    icon: Rocket,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    active: true,
  },
  murtakiz: {
    icon: Anchor,
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    active: true,
  },
  masar: {
    icon: Layout,
    color: "text-purple-600",
    bg: "bg-purple-50 dark:bg-purple-900/20",
    active: true,
  },
  miaad: {
    icon: Clock,
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    active: true,
  },
  mueen: {
    icon: Calendar,
    color: "text-cyan-600",
    bg: "bg-cyan-50 dark:bg-cyan-900/20",
    active: true,
  },
  mithaq: {
    icon: BookOpen,
    color: "text-rose-600",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    active: true,
  },
  ethraa: {
    icon: Sparkles,
    color: "text-indigo-600",
    bg: "bg-indigo-50 dark:bg-indigo-900/20",
    active: true,
  },
  mulham: {
    icon: Bot,
    color: "text-pink-600",
    bg: "bg-pink-50 dark:bg-pink-900/20",
    active: true,
  },
  mutasiq: {
    icon: ClipboardCheck,
    color: "text-teal-600",
    bg: "bg-teal-50 dark:bg-teal-900/20",
    active: true,
  },
};

// Merge content with config
const TOOLS_LIST = Object.entries(tools).map(([id, tool]) => ({
  ...tool,
  ...TOOL_CONFIG[id],
}));

export function Programs() {
  return (
    <section className="py-24 bg-sea-25 dark:bg-bg">
      <div className="container mx-auto px-4 md:px-8">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold text-ink mb-4"
          >
            أدوات أثــر
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            viewport={{ once: true }}
            className="text-muted max-w-2xl mx-auto"
          >
            مجموعة متكاملة من الأدوات الذكية لمساعدة المعلم في كل خطوة
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {TOOLS_LIST.map((tool, idx) => (
            <motion.div
              key={tool.id}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              viewport={{ once: true }}
            >
              <Card
                className={`h-full border-0 shadow-sm hover:shadow-lg transition-all duration-300 relative overflow-hidden group bg-card ${!tool.active ? "opacity-80" : ""}`}
              >
                {/* Hover Glow Effect */}
                <div
                  className={`absolute top-0 right-0 w-32 h-32 ${tool.bg} rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2 group-hover:blur-2xl transition-all`}
                />

                <CardHeader>
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <div
                      className={`w-12 h-12 rounded-2xl ${tool.bg} flex items-center justify-center ${tool.color}`}
                    >
                      <tool.icon className="w-6 h-6" />
                    </div>
                    {!tool.active && (
                      <Badge variant="outline" className="text-xs bg-bg/50">
                        {common.buttons.comingSoon}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-xl mb-2 relative z-10 text-ink">
                    {tool.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <p className="text-sm text-muted leading-relaxed mb-6 font-medium">
                    {tool.description}
                  </p>

                  {tool.active ? (
                    <Link
                      to={tool.href}
                      className={`text-sm font-medium ${tool.color} hover:underline flex items-center gap-1`}
                    >
                      {common.buttons.tryNow} &larr;
                    </Link>
                  ) : (
                    <span className="cursor-not-allowed text-sm text-muted/80">
                      {common.buttons.notAvailable}
                    </span>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
