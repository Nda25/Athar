import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, Stars } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@modules/auth";
import { Layout } from "@modules/layout";
import { Button } from "@shared/ui/button";
import { Badge } from "@shared/ui/badge";
import { aboutSections, brand, nav } from "@shared/config/content";
import { SEO } from "@shared/seo/SEO";
import { Programs, Quotes, Services } from "..";
import { HeroVisualColumn } from "./HeroVisualColumn";

export function PreRegistrationLanding() {
  const { loginWithRedirect } = useAuth();

  return (
    <Layout>
      <SEO page="home" />

      {/* Hero Section */}
      <section className="landing-section pt-32 md:pt-28">
        {/* Abstract Background Elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 right-[10%] w-[500px] h-[500px] rounded-full bg-brand/20 blur-[80px]" />
          <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] rounded-full bg-accent/10 blur-[80px]" />
        </div>

        <div className="landing-container">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left/Content Column */}
            <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-right">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="mb-8"
              >
                <Badge className="bg-primary/10 text-primary border-primary/20 px-4 py-2 rounded-full text-sm font-medium hover:bg-primary/15 transition-colors">
                  <Sparkles className="ml-2 w-4 h-4 inline-block" />
                  {aboutSections.main.title}
                </Badge>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="landing-title font-display font-size-900"
              >
                <span>حين يلتقي الشغف</span>

                <br className="hidden md:block" />
                <span className="mt-2 inline-block"> بالمعرفة.. يُصنع</span>
                <span className="text-primary scribble inline-block mr-3">
                  {brand.name}
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="landing-subtitle mb-10"
              >
                {aboutSections.main.subtitle}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
              >
                <Button
                  size="lg"
                  onClick={() =>
                    loginWithRedirect({
                      authorizationParams: { screen_hint: "signup" },
                    })
                  }
                  className="h-14 px-8 text-lg font-bold rounded-2xl bg-primary hover:bg-brand-2 text-primary-foreground shadow-premium hover:shadow-premium-hover transition-all hover:-translate-y-1 group w-full sm:w-auto cursor-pointer"
                >
                  سجل الآن مجاناً
                  <ArrowLeft className="mr-3 w-5 h-5 transition-transform group-hover:-translate-x-1" />
                </Button>

                <Link to="/programs" className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-14 px-8 text-lg font-bold rounded-2xl border-2 border-border bg-card/50 hover:bg-secondary text-foreground w-full sm:w-auto transition-all cursor-pointer"
                  >
                    {nav.programs}
                  </Button>
                </Link>
              </motion.div>

              {/* Trust Indicators */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="mt-12 flex items-center gap-6 text-sm font-medium text-muted"
              >
                <div className="flex -space-x-3 space-x-reverse">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-10 h-10 rounded-full border-2 border-background bg-secondary flex items-center justify-center overflow-hidden"
                    >
                      <UserIcon className="w-5 h-5 text-muted/50" />
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex text-accent mb-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Stars key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                  <span>كُن من أوائل المستخدمين معنا</span>
                </div>
              </motion.div>
            </div>

            {/* Right/Visual Column */}
            <HeroVisualColumn />
          </div>
        </div>
      </section>

      <Programs />
      <Quotes />
      <Services />
    </Layout>
  );
}

function UserIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
        clipRule="evenodd"
      />
    </svg>
  );
}
