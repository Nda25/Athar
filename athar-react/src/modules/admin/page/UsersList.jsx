import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Users,
  Search,
  RefreshCw,
  MoreVertical,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Calendar,
  Mail,
  Shield,
} from "lucide-react";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";

import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { Input } from "@shared/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@shared/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shared/ui/dialog";
import { Label } from "@shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/ui/select";
import { Badge } from "@shared/ui/badge";
import { getAdminUsersList, adminActivateUser } from "@shared/api";

export default function UsersList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

  // Activation Modal State
  const [isActivateOpen, setIsActivateOpen] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activationForm, setActivationForm] = useState({
    amount: 1,
    unit: "months",
    note: "",
  });

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getAdminUsersList();
      // data might be { users: [...] } or just [...]
      setUsers(data?.users || data || []);
    } catch (error) {
      console.error(error);
      toast.error("فشل تحميل قائمة المستخدمين");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const safeUsers = Array.isArray(users) ? users : [];

  const filteredUsers = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return safeUsers;

    return safeUsers.filter((u) => {
      const email = String(u.email || "").toLowerCase();
      const name = String(u.name || "").toLowerCase();
      return email.includes(term) || name.includes(term);
    });
  }, [safeUsers, search]);

  const metrics = useMemo(() => {
    let activeUsers = 0;
    let adminUsers = 0;

    for (const user of safeUsers) {
      if (
        user?.app_metadata?.plan_entitlement ||
        user?.status === "active" ||
        user?.membership_status === "active"
      ) {
        activeUsers += 1;
      }
      if (user?.app_metadata?.roles?.includes("admin")) {
        adminUsers += 1;
      }
    }

    return {
      total: safeUsers.length,
      active: activeUsers,
      admins: adminUsers,
    };
  }, [safeUsers]);

  const handleOpenActivate = (user) => {
    setSelectedUser(user);
    setActivationForm({ amount: 12, unit: "months", note: "" });
    setIsActivateOpen(true);
  };

  const handleActivate = async () => {
    setActivating(true);
    try {
      await adminActivateUser({
        email: selectedUser.email,
        user_id: selectedUser.user_id,
        amount: activationForm.amount,
        unit: activationForm.unit,
        note: activationForm.note,
      });
      toast.success("تم تفعيل الاشتراك بنجاح");
      setIsActivateOpen(false);
      // Refresh list to show new status if returned?
      // Usually list needs reload to check updated claims/status ideally
      loadUsers();
    } catch (error) {
      toast.error("فشل التفعيل: " + (error.message || "خطأ غير معروف"));
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge className="mb-3 bg-primary text-primary-foreground">
              إدارة المستخدمين
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              المستخدمون والاشتراكات
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              عرض المستخدمين المسجلين ومتابعة حالة الاشتراك والتفعيل بسرعة.
            </p>
          </div>
          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-secondary px-3 py-2">
              <span className="block text-xs text-muted-foreground">
                إجمالي المستخدمين
              </span>
              <span className="font-semibold text-foreground">
                {loading ? "..." : metrics.total}
              </span>
            </div>
            <div className="rounded-xl border border-border bg-secondary px-3 py-2">
              <span className="block text-xs text-muted-foreground">
                مستخدمون نشطون
              </span>
              <span className="font-semibold text-foreground">
                {loading ? "..." : metrics.active}
              </span>
            </div>
            <div className="rounded-xl border border-border bg-secondary px-3 py-2">
              <span className="block text-xs text-muted-foreground">
                حسابات Admin
              </span>
              <span className="font-semibold text-foreground">
                {loading ? "..." : metrics.admins}
              </span>
            </div>
          </div>
        </div>
      </section>

      <Card className="border-border shadow-sm bg-card">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالبريد الإلكتروني أو الاسم..."
                className="border-border bg-card pr-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadUsers}
              className="shrink-0 dark:text-primary"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              تحديث القائمة
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8 ">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>لا يوجد مستخدمين</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredUsers.map((user) => (
                <Card
                  key={user.user_id || user.email}
                  className="overflow-hidden border-primary bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:bg-secondary/40"
                >
                  <div className="p-4 space-y-3 ">
                    <div className="flex justify-between items-start  ">
                      <div className="flex items-center gap-2 ">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-foreground">
                          {(
                            user.name?.[0] ||
                            user.email?.[0] ||
                            "?"
                          ).toUpperCase()}
                        </div>
                        <div>
                          <p
                            className="line-clamp-1 text-sm font-semibold text-foreground"
                            title={user.name}
                          >
                            {user.name || "مستخدم"}
                          </p>
                          <p
                            className="line-clamp-1 text-[10px] text-muted-foreground"
                            title={user.email}
                          >
                            {user.email}
                          </p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 -mt-1 -ml-2"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleOpenActivate(user)}
                          >
                            <CheckCircle2 className="ml-2 h-4 w-4" />
                            تفعيل اشتراك
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              navigator.clipboard.writeText(user.user_id)
                            }
                          >
                            نسخ User ID
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="space-y-1 border-t border-border pt-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">الحالة:</span>
                        {user.app_metadata?.plan_entitlement ? (
                          <Badge
                            variant="outline"
                            className="border-green-300 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300"
                          >
                            مشترك
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-secondary text-muted-foreground"
                          >
                            غير مشترك
                          </Badge>
                        )}
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          تاريخ التسجيل:
                        </span>
                        <span className="font-mono text-foreground">
                          {user.created_at
                            ? format(new Date(user.created_at), "dd/MM/yy")
                            : "-"}
                        </span>
                      </div>
                      {/* Additional metadata if available */}
                      {user.app_metadata?.roles?.includes("admin") && (
                        <div className="pt-1">
                          <Badge
                            variant="secondary"
                            className="w-full justify-center bg-purple-100 text-[10px] text-purple-800 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300"
                          >
                            <Shield className="h-3 w-3 ml-1" /> مسؤول
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activate Modal */}
      <Dialog open={isActivateOpen} onOpenChange={setIsActivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تفعيل اشتراك سريع</DialogTitle>
            <DialogDescription>
              تفعيل أو تمديد اشتراك للمستخدم: {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المدة</Label>
                <Input
                  type="number"
                  min="1"
                  value={activationForm.amount}
                  onChange={(e) =>
                    setActivationForm({
                      ...activationForm,
                      amount: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>الوحدة</Label>
                <Select
                  value={activationForm.unit}
                  onValueChange={(val) =>
                    setActivationForm({ ...activationForm, unit: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="months">أشهر</SelectItem>
                    <SelectItem value="days">أيام</SelectItem>
                    <SelectItem value="years">سنوات</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>ملاحظة</Label>
              <Input
                placeholder="سبب التفعيل..."
                value={activationForm.note}
                onChange={(e) =>
                  setActivationForm({ ...activationForm, note: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActivateOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleActivate} disabled={activating}>
              {activating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              تفعيل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
