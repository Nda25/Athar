import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

import { Button } from "@shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/ui/card";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shared/ui/dialog";
import { adminActivateUser } from "@shared/api";

const activationSchema = z.object({
  email: z.string().email({ message: "البريد الإلكتروني غير صحيح" }),
  userId: z.string().optional(),
  amount: z.coerce
    .number()
    .min(1, { message: "المدة يجب أن تكون 1 على الأقل" }),
  unit: z.enum(["months", "days", "years"]),
  note: z.string().optional(),
});

export default function Activation() {
  const [isLoading, setIsLoading] = useState(false);
  const [confirmData, setConfirmData] = useState(null);

  const form = useForm({
    resolver: zodResolver(activationSchema),
    defaultValues: {
      email: "",
      userId: "",
      amount: 12,
      unit: "months",
      note: "",
    },
  });

  const onSubmit = (data) => {
    setConfirmData(data);
  };

  const handleConfirm = async () => {
    if (!confirmData) return;

    setIsLoading(true);
    setConfirmData(null); // Close modal

    try {
      // Call the API service
      await adminActivateUser({
        email: confirmData.email,
        user_id: confirmData.userId || undefined,
        amount: confirmData.amount,
        unit: confirmData.unit,
        note: confirmData.note,
      });

      toast.success("تم تفعيل الاشتراك بنجاح", {
        description: `للمستخدم: ${confirmData.email}`,
        icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
      });

      form.reset();
    } catch (error) {
      console.error("Activation Error:", error);
      toast.error("حدث خطأ أثناء التفعيل", {
        description: error.message || "يرجى المحاولة مرة أخرى",
        icon: <AlertTriangle className="h-5 w-5 text-red-600" />,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">التفعيل اليدوي</h2>
          <p className="text-muted-foreground mt-2">
            تفعيل أو تمديد اشتراك مستخدم يدوياً.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>بيانات الاشتراك</CardTitle>
          <CardDescription>
            أدخل تفاصيل المستخدم والمدة المطلوبة.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">
                  البريد الإلكتروني <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  placeholder="example@email.com"
                  {...form.register("email")}
                  className={
                    form.formState.errors.email ? "border-red-500" : ""
                  }
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="userId">UID (اختياري)</Label>
                <Input
                  id="userId"
                  placeholder="Auth0 sub إن وجد"
                  {...form.register("userId")}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">
                  المدة <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="amount"
                  type="number"
                  min="1"
                  {...form.register("amount")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">الوحدة</Label>
                <Select
                  defaultValue="months"
                  onValueChange={(val) => form.setValue("unit", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الوحدة" />
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
              <Label htmlFor="note">ملاحظة (اختياري)</Label>
              <Input
                id="note"
                placeholder="سبب التفعيل أو مرجع"
                {...form.register("note")}
              />
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                تفعيل الاشتراك
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog
        open={!!confirmData}
        onOpenChange={(open) => !open && setConfirmData(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد التفعيل</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من رغبتك في تفعيل الاشتراك لهذا المستخدم؟
            </DialogDescription>
          </DialogHeader>

          {confirmData && (
            <div className="grid gap-2 py-4 text-sm">
              <div className="grid grid-cols-4 items-center gap-4">
                <span className="font-semibold text-right">المستخدم:</span>
                <span className="col-span-3">{confirmData.email}</span>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <span className="font-semibold text-right">المدة:</span>
                <span className="col-span-3">
                  {confirmData.amount}
                  {confirmData.unit === "months" && " شهر"}
                  {confirmData.unit === "days" && " يوم"}
                  {confirmData.unit === "years" && " سنة"}
                </span>
              </div>
              {confirmData.note && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <span className="font-semibold text-right">ملاحظة:</span>
                  <span className="col-span-3 text-muted-foreground">
                    {confirmData.note}
                  </span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmData(null)}>
              إلغاء
            </Button>
            <Button onClick={handleConfirm} disabled={isLoading}>
              تأكيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
