import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Layout } from "@modules/layout";
import { useAuth } from "@modules/auth";
import { SEO } from "@shared/seo/SEO";
import {
  checkUserStatus,
  getInvoicesList,
  getUserComplaints,
  upsertUserProfile,
} from "@shared/api";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { Input } from "@shared/ui/input";
import {
  User,
  Mail,
  ShieldCheck,
  LogOut,
  Receipt,
  MessageSquare,
} from "lucide-react";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ar-SA");
}

function currency(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "—";
  return `${amount.toFixed(2)} ر.س`;
}

function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

export default function ProfilePage() {
  const { user, logout, isLoading, isAuthenticated } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const statusQuery = useQuery({
    queryKey: ["profile-status"],
    queryFn: checkUserStatus,
    enabled: !isLoading && isAuthenticated,
    retry: 1,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
  });

  const invoicesQuery = useQuery({
    queryKey: ["profile-invoices"],
    queryFn: getInvoicesList,
    enabled: !isLoading && isAuthenticated,
    staleTime: 60 * 1000,
  });

  const complaintsQuery = useQuery({
    queryKey: ["profile-complaints", user?.email],
    queryFn: () => getUserComplaints(user?.email?.toLowerCase()),
    enabled: !isLoading && isAuthenticated,
    staleTime: 60 * 1000,
  });

  const membership = statusQuery.data || {};
  const invoices = useMemo(
    () => normalizeRows(invoicesQuery.data),
    [invoicesQuery.data],
  );
  const complaints = useMemo(
    () => normalizeRows(complaintsQuery.data),
    [complaintsQuery.data],
  );

  const isMembershipActive =
    membership.active === true || membership.status === "active";

  useEffect(() => {
    if (!user) return;
    const savedName = localStorage.getItem("athar:displayName");
    const savedAvatar = localStorage.getItem("athar:avatar");
    setDisplayName(savedName || user.name || "");
    setAvatarUrl(savedAvatar || user.picture || "");
  }, [user]);

  const subscriptionLabel = statusQuery.isLoading
    ? "جار التحقق..."
    : statusQuery.isError
      ? "تعذر التحقق"
      : isMembershipActive
        ? "نشط"
        : membership.status === "expired"
          ? "منتهي"
          : "غير نشط";

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-brand/30 border-t-brand rounded-full animate-spin" />
            <p className="text-muted animate-pulse">
              جاري تحميل الملف الشخصي...
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  const handleAvatarUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 2 * 1024 * 1024) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      setAvatarUrl(value);
      localStorage.setItem("athar:avatar", value);
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    if (!user?.sub || !user?.email) return;
    try {
      setSavingProfile(true);
      localStorage.setItem("athar:displayName", displayName.trim());
      localStorage.setItem("athar:avatar", avatarUrl || "");
      await upsertUserProfile({
        sub: user.sub,
        email: user.email,
        name: displayName.trim() || user.name || null,
        picture: avatarUrl || user.picture || null,
      });
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <Layout>
      <SEO page="profile" />

      <div className="bg-sea-25 dark:bg-bg min-h-screen pb-20">
        <header className="bg-card border-b border-border pt-24 pb-10 mb-8">
          <div className="container mx-auto px-4 md:px-8 max-w-6xl">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              <div className="w-24 h-24 rounded-2xl border-4 border-white shadow-lg overflow-hidden bg-sea-50 flex items-center justify-center">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName || "المستخدم"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 text-muted" />
                )}
              </div>

              <div className="flex-1 text-center md:text-right">
                <div className="flex flex-col md:flex-row items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-ink">
                    مرحبًا {displayName || user?.name || ""}
                  </h1>
                  <Badge
                    className={
                      statusQuery.isError
                        ? "bg-amber-100 text-amber-700"
                        : isMembershipActive
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-200 text-slate-700"
                    }
                  >
                    {subscriptionLabel}
                  </Badge>
                </div>
                <p className="text-muted">
                  هذا الملف يعتمد على بيانات حسابك الفعلية دون بيانات تجريبية.
                </p>

                {statusQuery.isError ? (
                  <p className="text-xs text-amber-700 mt-2">
                    تعذر قراءة حالة الاشتراك الآن. اضغط تحديث لإعادة المحاولة.
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2 justify-center md:justify-start mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => statusQuery.refetch()}
                  >
                    تحديث الحالة
                  </Button>
                  <Link to="/pricing">
                    <Button size="sm">إدارة الاشتراك</Button>
                  </Link>
                  <Link to="/complaints">
                    <Button size="sm" variant="outline">
                      الشكاوى والاقتراحات
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted hover:text-red-500"
                    onClick={() => logout({ returnTo: window.location.origin })}
                  >
                    <LogOut className="w-4 h-4 ml-2" /> تسجيل الخروج
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 md:px-8 max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" /> بيانات الحساب
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="text-muted">الاسم</p>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="الاسم الظاهر"
                  />
                </div>
                <div>
                  <p className="text-muted">البريد الإلكتروني</p>
                  <p className="font-semibold flex items-center gap-1">
                    <Mail className="w-4 h-4" /> {user?.email || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted">معرّف المستخدم</p>
                  <p className="font-mono text-xs break-all">
                    {user?.sub || "—"}
                  </p>
                </div>

                <div>
                  <p className="text-muted mb-1">الصورة الشخصية</p>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                  />
                </div>

                <Button
                  onClick={saveProfile}
                  disabled={savingProfile}
                  className="w-full"
                >
                  {savingProfile ? "جار الحفظ..." : "حفظ التعديلات"}
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">الاشتراك الحالي</CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted">الحالة</p>
                  <p className="font-semibold">{subscriptionLabel}</p>
                </div>
                <div>
                  <p className="text-muted">الخطة</p>
                  <p className="font-semibold">{membership.plan || "—"}</p>
                </div>
                <div>
                  <p className="text-muted">بداية الاشتراك</p>
                  <p className="font-semibold">
                    {formatDate(membership.start_at)}
                  </p>
                </div>
                <div>
                  <p className="text-muted">تاريخ الانتهاء</p>
                  <p className="font-semibold">
                    {formatDate(membership.expires_at)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Receipt className="w-5 h-5" /> الفواتير الأخيرة
                </CardTitle>
              </CardHeader>
              <CardContent>
                {invoicesQuery.isLoading ? (
                  <p className="text-sm text-muted">جاري تحميل الفواتير...</p>
                ) : invoices.length === 0 ? (
                  <p className="text-sm text-muted">لا توجد فواتير حتى الآن.</p>
                ) : (
                  <div className="overflow-auto">
                    <table className="w-full min-w-[620px] text-sm">
                      <thead>
                        <tr className="border-b text-muted">
                          <th className="text-right p-2">التاريخ</th>
                          <th className="text-right p-2">المبلغ</th>
                          <th className="text-right p-2">الحالة</th>
                          <th className="text-right p-2">البوابة</th>
                          <th className="text-right p-2">المرجع</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.slice(0, 10).map((row, idx) => (
                          <tr
                            key={`${row.invoice_id || row.provider_event_id || idx}`}
                            className="border-b"
                          >
                            <td className="p-2">
                              {formatDate(row.created_at)}
                            </td>
                            <td className="p-2">
                              {currency(row.amount_sar || row.amount)}
                            </td>
                            <td className="p-2">{row.status || "—"}</td>
                            <td className="p-2">{row.gateway || "—"}</td>
                            <td className="p-2 font-mono text-xs">
                              {row.invoice_id || row.provider_event_id || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" /> الشكاوى والاقتراحات
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted">
                  إجمالي التذاكر: {complaints.length}
                </p>
                {complaintsQuery.isLoading ? (
                  <p className="text-muted">جاري التحميل...</p>
                ) : complaints.length ? (
                  <div className="space-y-2">
                    {complaints.slice(0, 3).map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="rounded-lg border p-2"
                      >
                        <p className="font-medium truncate">
                          {item.subject || "بدون عنوان"}
                        </p>
                        <p className="text-xs text-muted">
                          {item.status || "new"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted">لا توجد شكاوى حتى الآن.</p>
                )}

                <Link to="/complaints" className="block">
                  <Button variant="outline" className="w-full">
                    فتح صفحة الشكاوى
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </Layout>
  );
}
