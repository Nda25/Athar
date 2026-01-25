import { motion } from "framer-motion";
import { ArrowLeft, Zap, Award, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { aboutSections } from "@/content";

const ICONS = {
  smart_planning: Zap,
  bloom_standards: Award,
  high_engagement: Users,
};

export function Services() {
  const { main, cards } = aboutSections;

  return (
    <section className="py-24 bg-bg relative overflow-hidden">
      {/* Decorative Background Element */}
      <div className="absolute top-0 right-0 w-1/3 h-1/2 bg-brand/5 rounded-bl-[100px] -z-10" />

      <div className="container mx-auto px-4 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Highlight Card (Primary) - Spans 5 columns on large screens */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-5 lg:sticky lg:top-24"
          >
            <div className="bg-gradient-to-br from-brand to-brand-2 rounded-3xl p-8 md:p-10 text-white shadow-xl relative overflow-hidden">
              {/* Abstract decorative circles */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

              <h2 className="text-3xl md:text-4xl font-bold mb-6 leading-tight">
                {main.title}
              </h2>
              <p className="text-white/90 text-lg mb-8 leading-relaxed font-medium">
                {main.subtitle}
              </p>

              <Link to={main.link}>
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-white text-brand hover:bg-white/90 hover:scale-105 transition-all font-bold h-14 rounded-xl shadow-lg border-0"
                >
                  {main.cta}
                  <ArrowLeft className="mr-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Supporting Cards (Secondary) - Spans 7 columns */}
          <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6">
            {cards.map((card, idx) => {
              const Icon = ICONS[card.key] || Zap;
              // First card spans full width on mobile/tablet for better grid balance if odd number,
              // or just keep 2 cols. With 3 cards, typical layout is 2 top, 1 bottom wide, or just list.
              // Let's stick to simple grid, maybe making the first one stand out or just uniform.
              // Actually, standard grid is fine.

              return (
                <motion.div
                  key={card.key}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className={
                    idx === 2 ? "md:col-span-2 md:w-2/3 md:mx-auto" : ""
                  }
                >
                  <Card className="h-full border border-sea-200 dark:border-sea-800 hover:border-brand/50 hover:shadow-md transition-all duration-300 bg-card group">
                    <CardContent className="p-6 md:p-8">
                      <div className="w-12 h-12 rounded-2xl bg-sea-50 dark:bg-sea-900/50 text-brand flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                        <Icon className="w-6 h-6 stroke-[2.5]" />
                      </div>
                      <h3 className="text-xl font-bold text-ink mb-3 group-hover:text-brand transition-colors">
                        {card.title}
                      </h3>
                      <p className="text-muted leading-relaxed">
                        {card.content}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
