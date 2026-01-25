import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles } from "lucide-react";
import LightRays from "@/components/LightRays";
import { brand, nav, aboutSections } from "@/content";

export function Hero() {
  return (
    <section className="relative pt-32 pb-32 overflow-hidden min-h-screen flex items-center justify-center">
      {/* Light Rays Background */}
      <div className="absolute inset-0 pointer-events-none">
        <LightRays
          colors={["#1e40af", "#3b82f6", "#f0f9ff"]}
          speed={3}
          width={400}
          numRays={12}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
          {/* Tagline Badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <Badge
              variant="outline"
              className="px-4 py-2 text-sm md:text-base rounded-full border-brand/20 bg-brand/5 text-brand hover:bg-brand/10 hover:border-brand/40 transition-all cursor-default shadow-sm backdrop-blur-sm"
            >
              <Sparkles className="w-4 h-4 ml-2 animate-pulse" />
              {brand.tagline}
            </Badge>
          </motion.div>

          {/* Main Brand Name */}
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, type: "spring" }}
            className="text-6xl md:text-8xl lg:text-9xl font-bold bg-clip-text text-transparent bg-linear-to-b from-brand to-brand-2 mb-8 tracking-tighter leading-tight filter drop-shadow-sm"
          >
            {brand.name}
          </motion.h1>

          {/* Description Content */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-2xl text-ink/80 mb-12 max-w-2xl mx-auto leading-relaxed font-medium"
          >
            {aboutSections.main.subtitle}
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-5 w-full sm:w-auto"
          >
            <Link to="/programs" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto h-14 px-8 text-lg rounded-full bg-brand hover:bg-brand-2 text-white shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
              >
                {nav.programs}
                <ArrowLeft className="mr-2 h-5 w-5" />
              </Button>
            </Link>

            <Link to="/pricing" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto h-14 px-8 text-lg rounded-full border-2 border-sea-200 dark:border-sea-700 text-ink hover:text-white hover:border-brand  transition-all duration-300 backdrop-blur-sm   cursor-pointer hover:bg-brand"
              >
                {nav.pricing}
              </Button>
            </Link>
          </motion.div>

          {/* Stats / Trust (Subtle) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="mt-20 pt-10 border-t border-brand/10 w-full max-w-lg"
          >
            <p className="text-sm text-muted font-medium mb-4">
              منصة المعلم الإبداعي الأولى في المملكة
            </p>
            <div className="flex justify-center gap-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-brand/20" />
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
