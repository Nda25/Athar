import { motion } from "framer-motion";
import { ArrowLeft, Zap, Award, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { aboutSections } from "@shared/config/content";

const ICONS = {
  smart_planning: Zap,
  bloom_standards: Award,
  high_engagement: Users,
};

export function Services() {
  const { main, cards } = aboutSections;

  return (
    <section className="landing-section bg-secondary">
      {/* Decorative Background Element */}
      <div className="absolute top-0 right-0 w-1/3 h-[80%] bg-primary/5 rounded-bl-full -z-10" />

      <div className="landing-container">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Main Context Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-5 lg:sticky lg:top-32"
          >
            <div className="bg-gradient-to-br from-brand to-brand-2 rounded-[2rem] p-10 md:p-12 text-white shadow-premium relative overflow-hidden">
              {/* Abstract decorative circles */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl" />

              <h2 className="text-3xl text-white/90 md:text-5xl font-bold mb-6 leading-tight font-display relative z-10">
                {main.title}
              </h2>
              <p className="text-white/90 text-lg md:text-xl mb-10 leading-relaxed font-medium relative z-10">
                {main.subtitle}
              </p>

              <Link
                to={main.link}
                className="inline-block relative z-10 w-full sm:w-auto"
              >
                <button className="w-full sm:w-auto flex items-center justify-center bg-white text-brand hover:bg-white/90 transition-all font-bold h-14 px-8 rounded-xl shadow-lg border-0 group">
                  {main.cta}
                  <ArrowLeft className="mr-3 h-5 w-5 transition-transform group-hover:-translate-x-1" />
                </button>
              </Link>
            </div>
          </motion.div>

          {/* Feature Cards Grid */}
          <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 pt-4 lg:pt-0">
            {cards.map((card, idx) => {
              const Icon = ICONS[card.key] || Zap;
              const isWide = idx === 2; // Make the 3rd card span full width if desired, or keep symmetric

              return (
                <motion.div
                  key={card.key}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: idx * 0.15 }}
                  className={isWide ? "md:col-span-2" : ""}
                >
                  <div className="h-full bg-card rounded-[1.5rem] p-8 border border-border/60 hover:border-primary/30 shadow-sm hover:shadow-premium transition-all duration-300 group">
                    <div className="w-14 h-14 rounded-2xl bg-secondary text-primary flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-300 shadow-sm">
                      <Icon className="w-7 h-7 stroke-[2]" />
                    </div>
                    <h3 className="text-2xl font-bold text-foreground mb-4 group-hover:text-primary transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-muted text-lg leading-relaxed">
                      {card.content}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
