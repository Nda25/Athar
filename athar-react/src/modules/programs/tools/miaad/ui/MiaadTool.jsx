import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Loader2, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@modules/auth";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import {
  addMiyadEvent,
  deleteMiyadEvent,
  getReminderSettings,
  saveReminderSettings,
} from "@modules/programs/api";

export default function MiaadTool() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({
    subj: "",
    cls: "",
    day: "الأحد",
    slot: "",
    date: "",
    color: "#2563eb",
  });
  const [settings, setSettings] = useState({
    reminders_enabled: true,
    remind_days_before: 1,
  });

  const userSub = user?.sub || "";

  const settingsQuery = useQuery({
    queryKey: ["miyad-settings", userSub],
    queryFn: () => getReminderSettings({ user_sub: userSub }),
    enabled: Boolean(userSub),
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    setSettings((prev) => ({
      ...prev,
      reminders_enabled:
        settingsQuery.data.reminders_enabled ?? prev.reminders_enabled,
      remind_days_before:
        settingsQuery.data.remind_days_before ?? prev.remind_days_before,
    }));
  }, [settingsQuery.data]);

  const addMutation = useMutation({
    mutationFn: addMiyadEvent,
    onSuccess: (response) => {
      const inserted = Array.isArray(response) ? response[0] : response;
      const id = inserted?.id || crypto.randomUUID();
      setEvents((prev) => [{ ...form, id }, ...prev]);
      setForm((prev) => ({ ...prev, subj: "", cls: "", slot: "", date: "" }));
      toast.success("تمت إضافة الموعد");
    },
    onError: (error) => {
      toast.error("تعذر إضافة الموعد", {
        description: error.message || "حاول مرة أخرى.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMiyadEvent,
    onSuccess: (_, variables) => {
      setEvents((prev) => prev.filter((item) => item.id !== variables.event_id));
      toast.success("تم حذف الموعد");
    },
    onError: (error) => {
      toast.error("تعذر حذف الموعد", {
        description: error.message || "حاول مرة أخرى.",
      });
    },
  });

  const settingsMutation = useMutation({
    mutationFn: saveReminderSettings,
    onSuccess: () => {
      toast.success("تم حفظ إعدادات التذكير");
    },
    onError: (error) => {
      toast.error("تعذر حفظ الإعدادات", {
        description: error.message || "حاول مرة أخرى.",
      });
    },
  });

  const submitEvent = (event) => {
    event.preventDefault();
    if (!userSub) {
      toast.error("يرجى تسجيل الدخول أولًا");
      return;
    }
    if (!form.subj.trim() || !form.cls.trim()) {
      toast.error("أدخل المادة والفصل");
      return;
    }

    addMutation.mutate({
      user_sub: userSub,
      event_data: {
        subj: form.subj.trim(),
        cls: form.cls.trim(),
        day: form.day,
        slot: form.slot.trim(),
        date: form.date || null,
        color: form.color,
      },
    });
  };

  const persistSettings = () => {
    if (!userSub) return;
    settingsMutation.mutate({
      user_id: userSub,
      email: user?.email || "",
      reminders_enabled: settings.reminders_enabled,
      remind_days_before: Number(settings.remind_days_before) || 1,
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">ميعــاد</h1>
        <p className="text-muted-foreground">لا تفوّت لحظة، وابقَ مطلعًا على كل موعد مهم.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ميعاد - إدارة المواعيد</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submitEvent}>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المادة</Label>
                <Input
                  value={form.subj}
                  onChange={(e) => setForm((prev) => ({ ...prev, subj: e.target.value }))}
                  placeholder="اسم المادة"
                />
              </div>
              <div className="space-y-2">
                <Label>الفصل / الشعبة</Label>
                <Input
                  value={form.cls}
                  onChange={(e) => setForm((prev) => ({ ...prev, cls: e.target.value }))}
                  placeholder="مثال: 2-ب"
                />
              </div>
              <div className="space-y-2">
                <Label>اليوم</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2"
                  value={form.day}
                  onChange={(e) => setForm((prev) => ({ ...prev, day: e.target.value }))}
                >
                  <option>الأحد</option>
                  <option>الإثنين</option>
                  <option>الثلاثاء</option>
                  <option>الأربعاء</option>
                  <option>الخميس</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>الحصة / الوقت</Label>
                <Input
                  value={form.slot}
                  onChange={(e) => setForm((prev) => ({ ...prev, slot: e.target.value }))}
                  placeholder="مثال: الحصة الثالثة"
                />
              </div>
              <div className="space-y-2">
                <Label>تاريخ محدد (اختياري)</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>اللون</Label>
                <Input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
                />
              </div>
            </div>

            <Button type="submit" disabled={addMutation.isPending}>
              {addMutation.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جار الإضافة...
                </>
              ) : (
                <>
                  <Plus className="ml-2 h-4 w-4" /> إضافة موعد
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" /> إعدادات التذكير
          </CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>تفعيل التذكيرات</Label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2"
              value={settings.reminders_enabled ? "on" : "off"}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  reminders_enabled: e.target.value === "on",
                }))
              }
            >
              <option value="on">مفعل</option>
              <option value="off">معطل</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>عدد الأيام قبل التذكير</Label>
            <Input
              type="number"
              min={0}
              max={14}
              value={settings.remind_days_before}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  remind_days_before: Number(e.target.value) || 0,
                }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <Button onClick={persistSettings} disabled={settingsMutation.isPending || settingsQuery.isLoading}>
              {settingsMutation.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" /> جار الحفظ...
                </>
              ) : (
                "حفظ إعدادات التذكير"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>المواعيد المضافة في الجلسة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد مواعيد حتى الآن.</p>
          ) : (
            events.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-1">
                  <p className="font-medium">{item.subj}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.day} - {item.cls} {item.slot ? `- ${item.slot}` : ""}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    deleteMutation.mutate({ user_sub: userSub, event_id: item.id })
                  }
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
