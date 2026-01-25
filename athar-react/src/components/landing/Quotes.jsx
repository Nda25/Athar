import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Quote } from "lucide-react";
import { quotes } from "@/content";

export function Quotes() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // Pick a random quote on mount
    setIndex(Math.floor(Math.random() * quotes.length));

    // Auto-rotate every 10 seconds
    const interval = setInterval(() => {
      setIndex((current) => (current + 1) % quotes.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-16 bg-sea-50 dark:bg-card border-y border-border">
      <div className="container mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex flex-col items-center"
        >
          <div className="w-12 h-12 rounded-full bg-bg border border-sea-200 dark:border-sea-700 text-brand flex items-center justify-center mb-6 shadow-sm">
            <Quote className="w-6 h-6" />
          </div>

          <h3 className="text-xl font-bold text-brand mb-4">ومضـَة</h3>

          <div className="h-24 flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5 }}
                className="text-2xl md:text-3xl font-bold text-ink max-w-3xl leading-relaxed font-serif"
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
