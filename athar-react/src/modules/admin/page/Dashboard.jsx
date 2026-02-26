import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  Clock3,
  Megaphone,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Badge } from "@shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import {
  filterComplaints,
  getAdminUsersList,
  getAnnouncements,
} from "@shared/api";

function normalizeUsers(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.users)) return data.users;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
}

function normalizeComplaints(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toPercent(part, total) {
  if (!total) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}

export default function Dashboard() {
  const [usersQuery, complaintsQuery, announcementsQuery] = useQueries({
    queries: [
      { queryKey: ["admin-dashboard-users"], queryFn: getAdminUsersList },
      {
        queryKey: ["admin-dashboard-complaints"],
        queryFn: () => filterComplaints({}),
      },
      {
        queryKey: ["admin-dashboard-announcements"],
        queryFn: getAnnouncements,
      },
    ],
  });

  const users = useMemo(
    () => normalizeUsers(usersQuery.data),
    [usersQuery.data],
  );
  const complaints = useMemo(
    () => normalizeComplaints(complaintsQuery.data),
    [complaintsQuery.data],
  );
  const announcements = useMemo(
    () => announcementsQuery.data?.items || [],
    [announcementsQuery.data],
  );

  const metrics = useMemo(() => {
    let activeUsers = 0;
    let adminUsers = 0;
    for (const user of users) {
      const isActive =
        user?.app_metadata?.plan_entitlement ||
        user?.status === "active" ||
        user?.membership_status === "active";
      if (isActive) activeUsers += 1;
      if (user?.app_metadata?.roles?.includes("admin")) adminUsers += 1;
    }

    let openComplaints = 0;
    for (const complaint of complaints) {
      if (complaint?.status === "new" || complaint?.status === "in_progress") {
        openComplaints += 1;
      }
    }

    let activeAnnouncements = 0;
    for (const announcement of announcements) {
      if (announcement?.active) activeAnnouncements += 1;
    }

    return {
      totalUsers: users.length,
      activeUsers,
      adminUsers,
      totalComplaints: complaints.length,
      openComplaints,
      totalAnnouncements: announcements.length,
      activeAnnouncements,
      activeUsersRatio: toPercent(activeUsers, users.length),
      openComplaintsRatio: toPercent(openComplaints, complaints.length),
      liveAnnouncementsRatio: toPercent(
        activeAnnouncements,
        announcements.length,
      ),
    };
  }, [users, complaints, announcements]);

  const isLoading =
    usersQuery.isLoading ||
    complaintsQuery.isLoading ||
    announcementsQuery.isLoading;

  const statCards = useMemo(
    () => [
      {
        title: "إجمالي المستخدمين",
        value: metrics.totalUsers,
        description: "قاعدة المستخدمين الحالية",
        icon: Users,
        iconColor: "text-sky-700 dark:text-sky-300",
        iconBg: "bg-sky-100",
        border: "border-sky-200",
      },
      {
        title: "المستخدمون النشطون",
        value: metrics.activeUsers,
        description: `${metrics.activeUsersRatio}% من إجمالي المستخدمين`,
        icon: Activity,
        iconColor: "text-emerald-700 dark:text-emerald-300",
        iconBg: "bg-emerald-100",
        border: "border-emerald-200",
      },
      {
        title: "الشكاوى المفتوحة",
        value: metrics.openComplaints,
        description: `${metrics.openComplaintsRatio}% من إجمالي الشكاوى`,
        icon: AlertCircle,
        iconColor: "text-amber-700 dark:text-amber-300",
        iconBg: "bg-amber-100",
        border: "border-amber-200",
      },
      {
        title: "الإعلانات النشطة",
        value: metrics.activeAnnouncements,
        description: `${metrics.liveAnnouncementsRatio}% من سجل الإعلانات`,
        icon: Megaphone,
        iconColor: "text-indigo-700 dark:text-indigo-300",
        iconBg: "bg-indigo-100",
        border: "border-indigo-200",
      },
    ],
    [metrics],
  );

  const recentUsers = useMemo(
    () =>
      [...users]
        .filter((u) => u.created_at)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5),
    [users],
  );

  const recentComplaints = useMemo(
    () =>
      [...complaints]
        .filter((c) => c.created_at)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5),
    [complaints],
  );

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge className="mb-3 bg-primary text-primary-foreground">
              لوحة الإدارة
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              نظرة تشغيلية مباشرة
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              حالة المنصة الآن: المستخدمون، الشكاوى، والإعلانات في شاشة واحدة.
            </p>
          </div>

          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-secondary px-3 py-2">
              <span className="block text-xs text-muted">نسبة النشطين</span>
              <span className="font-semibold text-foreground">
                {isLoading ? "..." : `${metrics.activeUsersRatio}%`}
              </span>
            </div>
            <div className="rounded-xl border border-border bg-secondary px-3 py-2">
              <span className="block text-xs text-muted">الشكاوى المفتوحة</span>
              <span className="font-semibold text-foreground">
                {isLoading ? "..." : metrics.openComplaints}
              </span>
            </div>
            <div className="rounded-xl border border-border bg-secondary px-3 py-2">
              <span className="block text-xs text-muted">إعلانات حية</span>
              <span className="font-semibold text-foreground">
                {isLoading ? "..." : metrics.activeAnnouncements}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => (
          <Card
            key={stat.title}
            className={`border ${stat.border} bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:bg-secondary/40`}
          >
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-sm font-medium text-foreground">
                  {stat.title}
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </div>
              <div
                className={`rounded-xl p-2 ${stat.iconBg} dark:bg-secondary/80`}
              >
                <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-foreground">
                {isLoading ? "..." : stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border bg-card lg:col-span-1 border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-foreground">
              مؤشرات الجودة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  المستخدمون النشطون
                </span>
                <span className="font-semibold text-foreground">
                  {isLoading ? "..." : `${metrics.activeUsersRatio}%`}
                </span>
              </div>
              <div className="h-2 rounded-full bg-secondary">
                <div
                  className="h-2 rounded-full bg-emerald-500 transition-all duration-1000 ease-out"
                  style={{ width: `${metrics.activeUsersRatio}%` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">الشكاوى المفتوحة</span>
                <span className="font-semibold text-foreground">
                  {isLoading ? "..." : `${metrics.openComplaintsRatio}%`}
                </span>
              </div>
              <div className="h-2 rounded-full bg-secondary">
                <div
                  className="h-2 rounded-full bg-amber-500 transition-all duration-1000 ease-out"
                  style={{ width: `${metrics.openComplaintsRatio}%` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">الإعلانات النشطة</span>
                <span className="font-semibold text-foreground">
                  {isLoading ? "..." : `${metrics.liveAnnouncementsRatio}%`}
                </span>
              </div>
              <div className="h-2 rounded-full bg-secondary">
                <div
                  className="h-2 rounded-full bg-indigo-500 transition-all duration-1000 ease-out"
                  style={{ width: `${metrics.liveAnnouncementsRatio}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-secondary p-3 text-xs text-muted-foreground">
              <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
                <ShieldCheck className="h-4 w-4" />
                مستخدمون بصلاحية Admin
              </div>
              <div className="text-lg font-semibold text-foreground">
                {isLoading ? "..." : metrics.adminUsers}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card lg:col-span-2 border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">
              أحدث المستخدمين
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                لا توجد بيانات مستخدمين بعد.
              </p>
            ) : (
              recentUsers.map((u, idx) => (
                <div
                  key={u.user_id || u.email || idx}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 transition-all duration-200 hover:bg-secondary/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {u.name || "مستخدم"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {u.email || "-"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5" />
                    {formatDate(u.created_at)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="border-border bg-card border">
          <CardHeader>
            <CardTitle className="text-foreground">آخر الشكاوى</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentComplaints.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                لا توجد شكاوى بعد.
              </p>
            ) : (
              recentComplaints.map((c, idx) => (
                <div
                  key={c.id || idx}
                  className="flex justify-between border-b border-border pb-2 last:border-0 transition-colors duration-200 hover:bg-secondary/40 p-2 -mx-2 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground line-clamp-1">
                      {c.subject || "بدون عنوان"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.status || "new"}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(c.created_at)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card border">
          <CardHeader>
            <CardTitle className="text-foreground">مؤشرات سريعة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary px-3 py-2 transition-all duration-200 hover:shadow-sm">
              <span className="text-sm text-muted">إجمالي الشكاوى</span>
              <span className="text-sm font-semibold text-foreground">
                {isLoading ? "..." : metrics.totalComplaints}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary px-3 py-2 transition-all duration-200 hover:shadow-sm">
              <span className="text-sm text-muted">إجمالي الإعلانات</span>
              <span className="text-sm font-semibold text-foreground">
                {isLoading ? "..." : metrics.totalAnnouncements}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary px-3 py-2 transition-all duration-200 hover:shadow-sm">
              <span className="text-sm text-muted">مستخدمون بصلاحية Admin</span>
              <span className="text-sm font-semibold text-foreground">
                {isLoading ? "..." : metrics.adminUsers}
              </span>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
