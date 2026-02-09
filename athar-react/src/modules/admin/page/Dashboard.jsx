import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { Activity, AlertCircle, Megaphone, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { getAdminUsersList, filterComplaints, getAnnouncements } from "@shared/api";

function normalizeUsers(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.users)) return data.users;
  return [];
}

function normalizeComplaints(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
}

export default function Dashboard() {
  const [usersQuery, complaintsQuery, announcementsQuery] = useQueries({
    queries: [
      { queryKey: ["admin-dashboard-users"], queryFn: getAdminUsersList },
      { queryKey: ["admin-dashboard-complaints"], queryFn: () => filterComplaints({}) },
      { queryKey: ["admin-dashboard-announcements"], queryFn: getAnnouncements },
    ],
  });

  const users = useMemo(() => normalizeUsers(usersQuery.data), [usersQuery.data]);
  const complaints = useMemo(
    () => normalizeComplaints(complaintsQuery.data),
    [complaintsQuery.data],
  );
  const announcements = announcementsQuery.data?.items || [];

  const activeUsers = users.filter(
    (u) =>
      u?.app_metadata?.plan_entitlement ||
      u?.status === "active" ||
      u?.membership_status === "active",
  ).length;

  const openComplaints = complaints.filter(
    (c) => c.status === "new" || c.status === "in_progress",
  ).length;

  const activeAnnouncements = announcements.filter((a) => a.active).length;

  const isLoading = usersQuery.isLoading || complaintsQuery.isLoading || announcementsQuery.isLoading;

  const stats = [
    {
      title: "إجمالي المستخدمين",
      value: users.length,
      description: "من واقع بيانات المستخدمين",
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-100",
    },
    {
      title: "المستخدمون النشطون",
      value: activeUsers,
      description: "اشتراك فعّال حاليًا",
      icon: Activity,
      color: "text-emerald-600",
      bg: "bg-emerald-100",
    },
    {
      title: "الشكاوى المفتوحة",
      value: openComplaints,
      description: "جديدة أو قيد المعالجة",
      icon: AlertCircle,
      color: "text-amber-600",
      bg: "bg-amber-100",
    },
    {
      title: "الإعلانات النشطة",
      value: activeAnnouncements,
      description: "المفعّلة حاليًا",
      icon: Megaphone,
      color: "text-violet-600",
      bg: "bg-violet-100",
    },
  ];

  const recentUsers = [...users]
    .filter((u) => u.created_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  const recentComplaints = [...complaints]
    .filter((c) => c.created_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">نظرة عامة</h2>
        <p className="text-muted-foreground mt-2">إحصائيات مباشرة من بيانات المنصة.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`rounded-full p-2 ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>أحدث المستخدمين</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد بيانات بعد.</p>
            ) : (
              recentUsers.map((u, idx) => (
                <div key={u.user_id || u.email || idx} className="flex justify-between border-b pb-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{u.name || "مستخدم"}</p>
                    <p className="text-xs text-muted-foreground">{u.email || "—"}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString("ar-SA")}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>آخر الشكاوى</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentComplaints.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد شكاوى بعد.</p>
            ) : (
              recentComplaints.map((c, idx) => (
                <div key={c.id || idx} className="flex justify-between border-b pb-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium line-clamp-1">{c.subject || "بدون عنوان"}</p>
                    <p className="text-xs text-muted-foreground">{c.status || "new"}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {c.created_at ? new Date(c.created_at).toLocaleDateString("ar-SA") : "—"}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
