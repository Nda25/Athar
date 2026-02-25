import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Quote } from "lucide-react";
import { quotes } from "@shared/config/content";

export function Quotes() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(Math.floor(Math.random() * quotes.length));

    const interval = setInterval(() => {
      setIndex((current) => (current + 1) % quotes.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-24 md:py-32 bg-background border-y border-border/40 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-secondary/30 rounded-full blur-[100px] -z-10" />

      <div className="landing-container text-center max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="flex flex-col items-center"
        >
          <div className="relative mb-10">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full scale-150" />
            <div className="relative w-16 h-16 rounded-full bg-background border border-border/60 text-primary flex items-center justify-center shadow-sm">
              <Quote className="w-8 h-8 fill-primary/10" />
            </div>
          </div>

          <h3 className="text-xl font-bold text-primary mb-8 tracking-wide font-display">
            ومضـَة
          </h3>

          <div className="min-h-[140px] md:min-h-[120px] flex items-center justify-center w-full relative">
            <AnimatePresence mode="wait">
              <motion.p
                key={index}
                initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -20, filter: "blur(4px)" }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground leading-tight md:leading-snug font-display absolute w-full"
              >
                "{quotes[index]}"
              </motion.p>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
