import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@shared/ui/button";
import { Home, Search, ArrowRight } from "lucide-react";
import { SEO } from "@shared/seo/SEO";
import { notFound } from "@shared/config/content";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg relative overflow-hidden px-4">
      <SEO page="notFound" />

      {/* Background Decorative Elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand/5 rounded-full blur-3xl -z-10" />
      <div className="absolute top-0 right-0 w-64 h-64 bg-brand-2/5 rounded-full blur-2xl -z-10" />

      <div className="max-w-xl w-full text-center">
        {/* Animated Icon / Illustration Placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8 relative inline-block"
        >
          <div className="text-[12rem] md:text-[15rem] font-bold text-brand/10 leading-none select-none">
            {notFound.title}
          </div>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h1 className="text-3xl md:text-4xl font-bold text-ink mb-4">
            {notFound.headline}
          </h1>
          <p className="text-muted text-lg mb-10 leading-relaxed">
            {notFound.description}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/">
              <Button
                size="lg"
                className="bg-brand hover:bg-brand-2 text-white px-8 rounded-full shadow-lg hover:shadow-xl transition-all h-14 w-full sm:w-auto"
              >
                <Home className="ml-2 h-5 w-5" />
                {notFound.backHome}
              </Button>
            </Link>

            <Link to="/programs">
              <Button
                variant="ghost"
                size="lg"
                className="text-brand hover:bg-brand/5 px-8 rounded-full h-14 w-full sm:w-auto"
              >
                استكشف الأدوات
                <ArrowRight className="mr-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Subtle Brand Link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-16 pt-8 border-t border-border/50"
        >
          <p className="text-xs text-muted font-medium">
            هل تعتقد أن هناك خطأ؟{" "}
            <a
              href="https://wa.me/966556795993"
              className="text-brand hover:underline"
            >
              تواصل معنا
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
