import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Shield,
  Sparkles,
  Stars,
  Timer,
  WandSparkles,
} from "lucide-react";

import { useAuth } from "@modules/auth";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import { aboutSections, brand, nav } from "@shared/config/content";

const PREVIEW_ITEMS = [
  {
    icon: WandSparkles,
    title: "تخطيط سريع",
    value: "خلال دقائق",
    color: "text-sky-700",
    bg: "bg-sky-100",
  },
  {
    icon: Timer,
    title: "وقت موفّر",
    value: "حتى 70%",
    color: "text-emerald-700",
    bg: "bg-emerald-100",
  },
  {
    icon: Stars,
    title: "جودة المحتوى",
    value: "مبني على بلوم",
    color: "text-amber-700",
    bg: "bg-amber-100",
  },
];

export function Hero() {
  const { isAuthenticated, isAdmin } = useAuth();
  const [canAccessAdmin, setCanAccessAdmin] = useState(false);

  useEffect(() => {
    let alive = true;

    const check = async () => {
      if (!isAuthenticated) {
        if (alive) setCanAccessAdmin(false);
        return;
      }
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
  }, [isAuthenticated, isAdmin]);

  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-slate-50 pt-28 pb-20 dark:border-slate-800 dark:bg-slate-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-16 right-10 h-56 w-56 rounded-full bg-sky-200/40 blur-3xl dark:bg-sky-800/30" />
        <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-emerald-200/30 blur-3xl dark:bg-emerald-900/30" />
      </div>

      <div className="container relative z-10 mx-auto px-4 md:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-6"
            >
              <Badge className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-900">
                <Sparkles className="ml-2 h-4 w-4" />
                {brand.tagline}
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mb-5 text-5xl font-bold leading-tight tracking-tight text-slate-900 md:text-7xl dark:text-slate-100"
            >
              {brand.name}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-8 max-w-2xl text-lg leading-relaxed text-slate-700 md:text-2xl dark:text-slate-300"
            >
              {aboutSections.main.subtitle}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col gap-4 sm:flex-row"
            >
              <Link to="/programs" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="h-14 w-full rounded-xl bg-slate-900 px-8 text-base text-white hover:bg-slate-800 sm:w-auto"
                >
                  {nav.programs}
                  <ArrowLeft className="mr-2 h-5 w-5" />
                </Button>
              </Link>

              <Link to="/pricing" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-14 w-full rounded-xl border-slate-300 bg-white px-8 text-base text-slate-800 hover:bg-slate-100 sm:w-auto dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {nav.pricing}
                </Button>
              </Link>

              {canAccessAdmin && (
                <Link to="/admin" className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-14 w-full rounded-xl border-sky-300 bg-sky-50 px-8 text-base text-sky-800 hover:bg-sky-100 sm:w-auto dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                  >
                    <Shield className="ml-2 h-5 w-5" />
                    {nav.admin}
                  </Button>
                </Link>
              )}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="lg:col-span-5"
          >
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  لوحة إنجاز يومك التعليمي
                </h3>
                <Badge
                  variant="secondary"
                  className="bg-slate-100 text-slate-700"
                >
                  مباشر
                </Badge>
              </div>

              <div className="space-y-3">
                {PREVIEW_ITEMS.map((item, idx) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.25 + idx * 0.1 }}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`rounded-lg p-2 ${item.bg}`}>
                        <item.icon className={`h-4 w-4 ${item.color}`} />
                      </div>
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {item.title}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {item.value}
                    </span>
                  </motion.div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
                {aboutSections.main.title}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
