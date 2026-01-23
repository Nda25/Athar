/**
 * Home Page Component
 * @fileoverview Landing page for Athar platform
 */

import { useAuth } from "@/features/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTheme } from "@/hooks/useTheme";

export default function HomePage() {
  const { isAuthenticated, loginWithRedirect, logout, user } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      {/* Topbar */}
      <header className="sticky top-0 z-50 border-b border-blue-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-blue-700 dark:text-blue-400">
            أثـَــر
          </h1>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="rounded-full"
            >
              {isDark ? "☀️" : "🌙"}
            </Button>

            {isAuthenticated ? (
              <>
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  {user?.name || user?.email}
                </span>
                <Button
                  variant="outline"
                  onClick={() =>
                    logout({
                      logoutParams: { returnTo: window.location.origin },
                    })
                  }
                >
                  تسجيل الخروج
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => loginWithRedirect()}>
                  تسجيل الدخول
                </Button>
                <Button
                  onClick={() =>
                    loginWithRedirect({
                      authorizationParams: { screen_hint: "signup" },
                    })
                  }
                >
                  إنشاء حساب
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-blue-700 dark:text-blue-400 mb-4">
            أثـَــر
          </h2>
          <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            منصة تقنية تعليمية مدعومة بالذكاء الاصطناعي لمساعدة المعلمين في بناء
            استراتيجيات تدريس فعالة
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          <Card className="hover:shadow-lg transition-shadow bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-blue-700 dark:text-blue-400">
                منطلق
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                بناء استراتيجيات التدريس
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                أداة لإنشاء استراتيجيات تدريس مخصصة بناءً على المادة والمرحلة
                الدراسية
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-blue-700 dark:text-blue-400">
                مرتكز
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                تحليل الدروس
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                تحليل عميق للدروس واستخراج الأهداف والمحتوى التعليمي
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-blue-700 dark:text-blue-400">
                ميعاد
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                تقويم المواعيد
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                تنظيم المواعيد والتذكيرات للاختبارات والمناسبات التعليمية
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-blue-700 dark:text-blue-400">
                إثراء
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                بطاقات إثرائية
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                إنشاء بطاقات إثرائية لتعزيز التعلم وتوسيع المعرفة
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-blue-700 dark:text-blue-400">
                ملهم
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                أفكار إبداعية
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                توليد أفكار إبداعية للأنشطة والمشاريع التعليمية
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-blue-700 dark:text-blue-400">
                معين
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                المساعد الذكي
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                مساعد ذكي للإجابة على الأسئلة التعليمية والمهنية
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center mt-12">
          {!isAuthenticated && (
            <Button
              size="lg"
              className="text-lg px-8 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() =>
                loginWithRedirect({
                  authorizationParams: { screen_hint: "signup" },
                })
              }
            >
              ابدأ الآن مجاناً
            </Button>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-700 mt-12 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
        <p>© 2026 أثر - جميع الحقوق محفوظة</p>
      </footer>
    </div>
  );
}
