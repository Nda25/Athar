import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  Megaphone,
  Trash2,
  RefreshCw,
  StopCircle,
  Pencil,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";

import { Button } from "@shared/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@shared/ui/card";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Textarea } from "@shared/ui/textarea";
import { Checkbox } from "@shared/ui/checkbox";
import { Badge } from "@shared/ui/badge";
import {
  getAdminAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "@shared/api";

// Page options matching original admin.html
const TARGET_PAGES = [
  { id: "all", label: "جميع الصفحات", icon: "🌐" },
  { id: "mueen", label: "معين", icon: "📊" },
  { id: "darsi", label: "مُرتكز", icon: "📚" },
  { id: "mutasiq", label: "مُتسق", icon: "✍️" },
  { id: "mulham", label: "مُلهم", icon: "💡" },
  { id: "miyad", label: "ميعاد", icon: "📅" },
  { id: "masar", label: "مسار", icon: "🗺️" },
  { id: "mithaq", label: "ميثاق", icon: "📜" },
  { id: "ethraa", label: "إثراء", icon: "⭐" },
  { id: "athar", label: "أثر الأساسية", icon: "🏠" },
  { id: "programs", label: "البرامج", icon: "🎓" },
  { id: "pricing", label: "الأسعار", icon: "💰" },
  { id: "profile", label: "الملف الشخصي", icon: "👤" },
];

const announcementSchema = z.object({
  text: z.string().min(1, "نص الإعلان مطلوب"),
  active: z.boolean().default(true),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  targetPages: z.array(z.string()).min(1, "يجب اختيار صفحة واحدة على الأقل"),
});

const DEFAULT_FORM_VALUES = {
  text: "",
  active: true,
  startDate: "",
  endDate: "",
  targetPages: ["all"],
};

function toDateInputValue(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function normalizeTargetPages(value) {
  if (Array.isArray(value) && value.length > 0) return value;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value.replace(/'/g, '"'));
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      const fallback = value
        .replace(/[[\]"']/g, "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (fallback.length > 0) return fallback;
    }
  }

  return ["all"];
}

export default function Announcements() {
  const [announcements, setAnnouncements] = useState({
    latest: null,
    items: [],
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form setup
  const form = useForm({
    resolver: zodResolver(announcementSchema),
    defaultValues: DEFAULT_FORM_VALUES,
  });

  // Watch target pages to handle "all" logic
  const selectedPages = form.watch("targetPages");

  const handlePageToggle = (pageId) => {
    let current = [...selectedPages];

    if (pageId === "all") {
      // If clicking "all", clear others and set only "all"
      // Or if unchecking "all" (and it's the only one), prevent empty?
      // Let's toggle: if on -> off (requires at least one?), if off -> on (clear others)
      if (current.includes("all")) {
        // Cannot uncheck if it's the only one? Or just allow empty and let validation catch it
        current = [];
      } else {
        current = ["all"];
      }
    } else {
      // If clicking specific page
      if (current.includes("all")) {
        // Remove "all" and add specific
        current = [pageId];
      } else {
        // Toggle specific
        if (current.includes(pageId)) {
          current = current.filter((p) => p !== pageId);
        } else {
          current.push(pageId);
        }
      }
    }
    form.setValue("targetPages", current);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getAdminAnnouncements();
      setAnnouncements(data);
    } catch {
      toast.error("فشل تحميل الإعلانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const metrics = useMemo(() => {
    const items = Array.isArray(announcements.items) ? announcements.items : [];
    let active = 0;
    let scheduled = 0;

    for (const item of items) {
      if (item?.active) active += 1;
      if (item?.start_at && new Date(item.start_at) > new Date())
        scheduled += 1;
    }

    return {
      total: items.length,
      active,
      scheduled,
    };
  }, [announcements.items]);

  const onSubmit = async (data) => {
    const payload = {
      text: data.text,
      active: data.active,
      start: data.startDate ? new Date(data.startDate).toISOString() : null,
      expires: data.endDate ? new Date(data.endDate).toISOString() : null,
      target_pages: data.targetPages,
    };

    setSubmitting(true);
    try {
      if (editingId) {
        await updateAnnouncement({
          id: editingId,
          ...payload,
        });
        toast.success("تم تحديث الإعلان بنجاح");
      } else {
        await createAnnouncement(payload);
        toast.success("تم نشر الإعلان بنجاح");
      }

      setEditingId(null);
      form.reset(DEFAULT_FORM_VALUES);
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error(editingId ? "حدث خطأ أثناء التحديث" : "حدث خطأ أثناء النشر");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (item) => {
    if (!item?.id) {
      toast.error("تعذر تعديل هذا الإعلان");
      return;
    }

    setEditingId(item.id);
    form.reset({
      text: item.text || "",
      active: !!item.active,
      startDate: toDateInputValue(item.start_at),
      endDate: toDateInputValue(item.expires_at),
      targetPages: normalizeTargetPages(item.target_pages),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    form.reset(DEFAULT_FORM_VALUES);
  };

  const handleDelete = async (id) => {
    if (!id) {
      toast.error("معرف الإعلان غير متوفر");
      return;
    }

    if (!confirm("هل أنت متأكد من حذف هذا الإعلان؟")) return;
    try {
      await deleteAnnouncement(id);
      if (editingId === id) {
        cancelEdit();
      }
      toast.success("تم الحذف");
      await loadData();
    } catch {
      toast.error("فشل الحذف");
    }
  };

  const handleToggleStatus = async (item, newStatus) => {
    if (!item?.id) {
      toast.error("معرف الإعلان غير متوفر");
      return;
    }

    try {
      await updateAnnouncement({
        id: item.id,
        active: newStatus,
      });
      toast.success(newStatus ? "تم تفعيل الإعلان" : "تم إيقاف الإعلان");
      await loadData();
    } catch {
      toast.error("حدث خطأ");
    }
  };

  const handleRepublish = async (item) => {
    if (!item?.id) {
      toast.error("معرف الإعلان غير متوفر");
      return;
    }

    try {
      await updateAnnouncement({
        id: item.id,
        active: true,
        start: null, // Reset start time to now implies immediate?
        // Original code sent start: null on republish
      });
      toast.success("تم إعادة النشر");
      await loadData();
    } catch {
      toast.error("حدث خطأ");
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge className="mb-3 bg-primary text-primary-foreground">
              إدارة الإعلانات
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              مركز التنبيهات العامة
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              إنشاء الإعلانات ومتابعة حالتها ونطاق استهدافها من مكان واحد.
            </p>
          </div>
          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-secondary px-3 py-2">
              <span className="block text-xs text-muted">الإجمالي</span>
              <span className="font-semibold text-foreground">
                {loading ? "..." : metrics.total}
              </span>
            </div>
            <div className="rounded-xl border border-border bg-secondary px-3 py-2">
              <span className="block text-xs text-muted">إعلانات نشطة</span>
              <span className="font-semibold text-foreground">
                {loading ? "..." : metrics.active}
              </span>
            </div>
            <div className="rounded-xl border border-border bg-secondary px-3 py-2">
              <span className="block text-xs text-muted">مجدولة</span>
              <span className="font-semibold text-foreground">
                {loading ? "..." : metrics.scheduled}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Create / Edit Announcement Form */}
        <Card className="border-border shadow-sm bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">
              {editingId ? "تعديل الإعلان" : "نشر إعلان جديد"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="text">نص الإعلان</Label>
                <Textarea
                  id="text"
                  placeholder="اكتب نص الإعلان هنا..."
                  {...form.register("text")}
                  className={form.formState.errors.text ? "border-red-500" : ""}
                />
                {form.formState.errors.text && (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.text.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">تاريخ البدء (اختياري)</Label>
                  <Input
                    id="startDate"
                    type="date"
                    {...form.register("startDate")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">تاريخ الانتهاء (اختياري)</Label>
                  <Input
                    id="endDate"
                    type="date"
                    {...form.register("endDate")}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-md border border-border bg-secondary p-3">
                <Controller
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <Checkbox
                      id="active"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label
                  htmlFor="active"
                  className="cursor-pointer text-foreground"
                >
                  تفعيل الإعلان فور النشر
                </Label>
              </div>

              <div className="space-y-3">
                <Label>الصفحات المستهدفة</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TARGET_PAGES.map((page) => {
                    const isChecked = selectedPages.includes(page.id);
                    return (
                      <div
                        key={page.id}
                        onClick={() => handlePageToggle(page.id)}
                        className={`
                                    cursor-pointer flex items-center gap-2 p-2 rounded-md border text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm
                                    ${
                                      isChecked
                                        ? "bg-primary/20 border-primary text-primary font-medium"
                                        : "bg-card border-border hover:bg-secondary text-foreground"
                                    }
                                `}
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center ${isChecked ? "bg-primary border-primary" : "border-border"}`}
                        >
                          {isChecked && (
                            <span className="text-primary-foreground text-[10px]">
                              ✓
                            </span>
                          )}
                        </div>
                        <span className="text-lg">{page.icon}</span>
                        <span>{page.label}</span>
                      </div>
                    );
                  })}
                </div>
                {form.formState.errors.targetPages && (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.targetPages.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="submit"
                  className="w-full transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Megaphone className="mr-2 h-4 w-4" />
                  )}
                  {editingId ? "حفظ التعديلات" : "نشر الإعلان"}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={cancelEdit}
                    disabled={submitting}
                  >
                    <X className="mr-2 h-4 w-4" />
                    إلغاء التعديل
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Existing Announcements List */}
        <div className="space-y-6">
          <Card className="border-border shadow-sm bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium text-foreground">
                المنشور حالياً
              </CardTitle>
            </CardHeader>
            <CardContent>
              {announcements.latest ? (
                <div className="space-y-3 rounded-lg border border-border bg-secondary p-4 text-foreground">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{announcements.latest.text}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>
                            {announcements.latest.start_at
                              ? format(
                                  new Date(announcements.latest.start_at),
                                  "d MMM yyyy",
                                  { locale: arSA },
                                )
                              : "فوري"}
                          </span>
                          <span>→</span>
                          <span>
                            {announcements.latest.expires_at
                              ? format(
                                  new Date(announcements.latest.expires_at),
                                  "d MMM yyyy",
                                  { locale: arSA },
                                )
                              : "∞"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(announcements.latest)}
                        title="تعديل"
                      >
                        <Pencil className="h-4 w-4 text-blue-600" />
                      </Button>
                      {announcements.latest.active ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleToggleStatus(announcements.latest, false)
                          }
                          title="إيقاف"
                        >
                          <StopCircle className="h-4 w-4 text-amber-600" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRepublish(announcements.latest)}
                          title="إعادة نشر"
                        >
                          <RefreshCw className="h-4 w-4 text-blue-600" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(announcements.latest.id)}
                        title="حذف"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {normalizeTargetPages(announcements.latest.target_pages).map(
                      (p, idx) => {
                        const label =
                          TARGET_PAGES.find((tp) => tp.id === p)?.label || p;
                        return (
                          <Badge
                            key={`${p}-${idx}`}
                            variant="secondary"
                            className="h-5 px-1 text-[10px] font-normal"
                          >
                            {label}
                          </Badge>
                        );
                      },
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-sm italic text-slate-500 dark:text-slate-400">
                  لا يوجد إعلان نشط حالياً
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="text-slate-900 dark:text-slate-100">
                سجل الإعلانات
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin text-slate-400" />
                </div>
              ) : announcements.items.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">
                  لا توجد إعلانات سابقة
                </p>
              ) : (
                <div className="space-y-3">
                  {announcements.items.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="flex flex-col gap-4 rounded-lg border border-border p-3 transition-colors duration-200 hover:bg-secondary/40 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {item.active ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <StopCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span
                            className={`font-medium text-foreground ${!item.active && "text-muted-foreground line-through"}`}
                          >
                            {item.text}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>
                            {item.start_at
                              ? format(new Date(item.start_at), "d MMM", {
                                  locale: arSA,
                                })
                              : "فوري"}
                          </span>
                          <span>→</span>
                          <span>
                            {item.expires_at
                              ? format(new Date(item.expires_at), "d MMM", {
                                  locale: arSA,
                                })
                              : "∞"}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {normalizeTargetPages(item.target_pages).map(
                            (p, idx) => {
                              const label =
                                TARGET_PAGES.find((tp) => tp.id === p)?.label ||
                                p;
                              return (
                                <Badge
                                  key={p || idx}
                                  variant="secondary"
                                  className="h-5 px-1 text-[10px] font-normal"
                                >
                                  {label}
                                </Badge>
                              );
                            },
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(item)}
                          title="تعديل"
                        >
                          <Pencil className="h-4 w-4 text-blue-600" />
                        </Button>
                        {!item.active ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRepublish(item)}
                            title="إعادة نشر"
                          >
                            <RefreshCw className="h-4 w-4 text-blue-600" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(item, false)}
                            title="إيقاف"
                          >
                            <StopCircle className="h-4 w-4 text-amber-600" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                          title="حذف"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
