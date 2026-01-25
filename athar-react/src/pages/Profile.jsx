import { useAuth } from "@/features/auth/AuthProvider";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { profile } from "@/content";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import {
  User,
  Mail,
  ShieldCheck,
  LogOut,
  Zap,
  TrendingUp,
  Clock,
  Users,
  Check,
  X as XIcon,
  ChevronLeft,
  Sparkles,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

export default function Profile() {
  const { user, logout, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-brand/30 border-t-brand rounded-full animate-spin" />
            <p className="text-muted animate-pulse">
              جاري تحميل لوحة التحكم...
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  // Mock Data for "Psychological" impact
  const STATS = [
    {
      label: profile.stats.unitsCreated,
      value: "12",
      icon: Zap,
      color: "text-amber-500",
      bg: "bg-amber-50",
    },
    {
      label: profile.stats.studentsReached,
      value: "140",
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      label: profile.stats.timeSaved,
      value: "8.5",
      icon: Clock,
      color: "text-emerald-500",
      bg: "bg-emerald-50",
    },
  ];

  return (
    <Layout>
      <SEO page="profile" />

      <div className="bg-sea-25 dark:bg-bg min-h-screen pb-20">
        {/* Dashboard Header */}
        <header className="bg-card border-b border-border pt-24 pb-12 mb-8">
          <div className="container mx-auto px-4 md:px-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 max-w-5xl mx-auto">
              {/* Avatar */}
              <div className="relative group cursor-pointer">
                <div className="w-24 h-24 md:w-28 md:h-28 rounded-3xl border-4 border-white dark:border-card shadow-lg overflow-hidden bg-sea-50 transition-transform group-hover:scale-105">
                  {user?.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-12 h-12 text-muted m-auto h-full" />
                  )}
                </div>
                <div
                  className="absolute -bottom-1 -right-1 w-7 h-7 bg-green-500 border-4 border-white dark:border-card rounded-full flex items-center justify-center text-white shadow-sm"
                  title="Active"
                >
                  <Check className="w-3 h-3 stroke-[4]" />
                </div>
              </div>

              {/* Greeting & Meta */}
              <div className="flex-1 text-center md:text-right md:pt-2">
                <div className="flex flex-col md:flex-row items-center md:items-baseline gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-ink">
                    {profile.welcome} {user?.name?.split(" ")[0]}!
                  </h1>
                  <Badge
                    variant="secondary"
                    className="bg-brand/10 text-brand hover:bg-brand/20 transition-colors"
                  >
                    {profile.subscription.free}
                  </Badge>
                </div>
                <p className="text-muted text-lg max-w-xl leading-relaxed mb-6">
                  {profile.subtitle}
                </p>

                {/* Header Stats - Mobile Only */}
                <div className="flex md:hidden justify-center gap-4 mb-6 w-full overflow-x-auto pb-2">
                  {STATS.map((stat, i) => (
                    <div
                      key={i}
                      className="bg-bg border border-border rounded-xl p-3 min-w-[100px] flex-shrink-0 text-center"
                    >
                      <span className={`block font-bold text-lg ${stat.color}`}>
                        {stat.value}
                      </span>
                      <span className="text-xs text-muted">{stat.label}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap justify-center md:justify-start gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden md:flex"
                  >
                    {profile.account.editBtn}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted hover:text-red-500 transition-colors"
                    onClick={() => logout({ returnTo: window.location.origin })}
                  >
                    <LogOut className="w-4 h-4 ml-2" />
                    {profile.logout}
                  </Button>
                </div>
              </div>

              {/* Header Stats - Desktop */}
              <div className="hidden md:flex gap-4">
                {STATS.map((stat, i) => (
                  <div
                    key={i}
                    className="bg-card border border-border rounded-2xl p-4 w-32 text-center shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div
                      className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-full flex items-center justify-center mx-auto mb-3`}
                    >
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <span className="block font-bold text-2xl text-ink mb-1">
                      {stat.value}
                    </span>
                    <span className="text-xs text-muted font-medium px-1 block">
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Left Column (Content & Actions) */}
            <div className="lg:col-span-2 space-y-8">
              {/* Quick Actions */}
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-ink flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-brand" />
                    {profile.actions.title}
                  </h2>
                </div>

                <div className="grid gap-4">
                  {profile.actions.items.map((action, idx) => (
                    <Link key={idx} to={action.link} className="block group">
                      <div
                        className={`bg-card border-2 ${action.color.replace("bg-", "border-").split(" ")[2]} rounded-2xl p-6 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg relative overflow-hidden`}
                      >
                        <div
                          className={`absolute top-0 right-0 w-24 h-24 ${action.color.split(" ")[0]} rounded-bl-full opacity-20 transition-transform group-hover:scale-150`}
                        />

                        <div className="relative z-10 flex items-start justify-between gap-4">
                          <div>
                            <h3
                              className={`text-lg font-bold mb-2 ${action.color.split(" ")[1]}`}
                            >
                              {action.title}
                            </h3>
                            <p className="text-muted leading-relaxed max-w-md">
                              {action.desc}
                            </p>
                          </div>
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${action.color} group-hover:scale-110 transition-transform`}
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>

              {/* Recent Activity (Placeholder) */}
              <section className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                <h3 className="text-lg font-bold text-ink mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-muted" />
                  آخر الأنشطة
                </h3>
                <div className="space-y-4">
                  {[1, 2].map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 py-3 border-b border-border last:border-0 hover:bg-sea-50 -mx-4 px-4 transition-colors cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-lg bg-sea-100 flex items-center justify-center text-brand">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-ink text-sm">
                          تم إنشاء خطة درس "الكسور الاعتيادية"
                        </h4>
                        <span className="text-xs text-muted">
                          منذ يومين • أداة منطلق
                        </span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ExternalLink className="w-4 h-4 text-muted" />
                      </Button>
                    </div>
                  ))}
                  <div className="text-center pt-2">
                    <Button variant="link" className="text-brand text-sm">
                      عرض كل النشاطات
                    </Button>
                  </div>
                </div>
              </section>
            </div>

            {/* Right Column (Sidebar) */}
            <aside className="space-y-6">
              {/* Subscription Card - Upgraded UX */}
              <Card className="border-2 border-brand/10 shadow-lg overflow-hidden relative">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-brand to-brand-2" />
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex justify-between items-center text-ink">
                    {profile.subscription.title}
                    <Badge className="bg-brand text-white hover:bg-brand-2">
                      Free
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Usage Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-muted">
                        {profile.subscription.usage}
                      </span>
                      <span className="text-brand">60%</span>
                    </div>
                    <div className="h-2.5 w-full bg-sea-100 rounded-full overflow-hidden">
                      <div className="h-full bg-brand w-[60%] rounded-full shadow-[0_0_10px_rgba(37,99,235,0.5)]" />
                    </div>
                    <p className="text-xs text-muted text-center pt-1">
                      {profile.subscription.usageLimit}
                    </p>
                  </div>

                  {/* Features List */}
                  <div className="space-y-3 pt-2">
                    {profile.subscription.features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        {feature.included ? (
                          <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center flex-shrink-0">
                            <XIcon className="w-3 h-3" />
                          </div>
                        )}
                        <span
                          className={
                            feature.included
                              ? "text-ink"
                              : "text-muted line-through opacity-70"
                          }
                        >
                          {feature.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-3 bg-sea-25/50 border-t border-border pt-6 pb-6">
                  <div className="text-center mb-1">
                    <h4 className="font-bold text-brand">
                      {profile.subscription.upgradeTitle}
                    </h4>
                    <p className="text-xs text-muted max-w-[200px] mx-auto mt-1">
                      {profile.subscription.upgradeDesc}
                    </p>
                  </div>
                  <Link to="/pricing" className="w-full">
                    <Button className="w-full bg-gradient-to-r from-brand to-brand-2 hover:opacity-90 transition-opacity shadow-md text-white font-bold py-5">
                      <Sparkles className="w-4 h-4 ml-2 animate-pulse" />
                      {profile.subscription.upgradeBtn}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>

              {/* Account Summary */}
              <Card className="shadow-sm border-border">
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="text-base text-muted flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    {profile.account.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-sea-50 flex items-center justify-center text-muted">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-bold text-ink truncate">
                        {user?.name}
                      </p>
                      <p className="text-xs text-muted truncate">
                        {user?.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                    <ShieldCheck className="w-3 h-3" />
                    تم التحقق من الحساب
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-muted font-normal h-9"
                    >
                      <AlertCircle className="w-4 h-4 ml-2" />
                      {profile.support}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>
        </main>
      </div>
    </Layout>
  );
}
