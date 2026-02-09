import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Loader2, Printer, Sparkles } from "lucide-react";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Textarea } from "@shared/ui/textarea";
import { generateMueenPlan } from "@shared/api";
import { Badge } from "@shared/ui/badge";

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatPlanForCopy(meta, days) {
  const lines = [];
  lines.push(`خطة أسبوعية - ${meta.subject || ""}`.trim());
  lines.push(`المرحلة: ${meta.grade || "غير محدد"}`);
  lines.push("");

  days.forEach((day, idx) => {
    lines.push(`اليوم ${idx + 1}: ${day.lesson || "-"}`);
    lines.push(`الأهداف: ${toArray(day.goals).join(" | ") || "-"}`);
    lines.push(`المفردات: ${toArray(day.vocab).join(" | ") || "-"}`);
    lines.push(`النواتج: ${day.outcomes || "-"}`);
    lines.push(`الواجب: ${day.homework || "-"}`);
    lines.push("");
  });

  return lines.join("\n");
}

export default function MueenTool() {
  const [form, setForm] = useState({
    subject: "",
    topic: "",
    stage: "متوسط",
    goals: "",
    notes: "",
  });
  const [result, setResult] = useState(null);

  const mutation = useMutation({
    mutationFn: generateMueenPlan,
    onSuccess: (data) => {
      setResult(data);
      toast.success("تم توليد الخطة الأسبوعية");
    },
    onError: (error) => {
      toast.error("تعذر توليد الخطة", { description: error.message });
    },
  });

  const submit = (event) => {
    event.preventDefault();
    if (!form.subject.trim() || !form.topic.trim()) {
      toast.error("يرجى تعبئة المادة وموضوع الدرس");
      return;
    }
    mutation.mutate({
      ...form,
      grade: form.stage,
      lessons: form.topic
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      count: 5,
      goals: form.goals
        .split("\n")
        .map((g) => g.trim())
        .filter(Boolean),
      variant: Date.now(),
    });
  };

  const meta = result?.meta || {};
  const days = toArray(result?.days);

  const handleCopy = async () => {
    if (!days.length) return;
    await navigator.clipboard.writeText(formatPlanForCopy(meta, days));
    toast.success("تم نسخ الخطة الأسبوعية");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">مُعين</h1>
        <p className="text-muted-foreground">خطتك الأسبوعية بين يديك.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>مُعين - الخطة الأسبوعية</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المادة</Label>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>الموضوع</Label>
                <Input
                  value={form.topic}
                  onChange={(e) => setForm((p) => ({ ...p, topic: e.target.value }))}
                  placeholder="يمكن إدخال أكثر من درس بفاصلة"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>المرحلة</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2"
                value={form.stage}
                onChange={(e) => setForm((p) => ({ ...p, stage: e.target.value }))}
              >
                <option>ابتدائي دُنيا</option>
                <option>ابتدائي عُليا</option>
                <option>متوسط</option>
                <option>ثانوي</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>أهداف الأسبوع (كل هدف بسطر)</Label>
              <Textarea
                rows={4}
                value={form.goals}
                onChange={(e) => setForm((p) => ({ ...p, goals: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>ملاحظات إضافية</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <><Loader2 className="ml-2 h-4 w-4 animate-spin" />جار التوليد...</>
              ) : (
                <><Sparkles className="ml-2 h-4 w-4" />ولد الخطة</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle>الخطة الأسبوعية</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCopy}>
                <Copy className="ml-2 h-4 w-4" /> نسخ جميع المخرجات
              </Button>
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="ml-2 h-4 w-4" /> طباعة
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-blue-100 text-blue-700">المادة: {meta.subject || form.subject}</Badge>
              <Badge className="bg-emerald-100 text-emerald-700">المرحلة: {meta.grade || form.stage}</Badge>
              <Badge className="bg-violet-100 text-violet-700">عدد الأيام: {days.length || meta.count || 0}</Badge>
            </div>

            {days.length ? (
              days.map((day, idx) => (
                <div key={`${day.lesson}-${idx}`} className="rounded-xl border p-4 space-y-3">
                  <h3 className="font-semibold text-lg">اليوم {idx + 1}: {day.lesson || "درس غير محدد"}</h3>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">الأهداف</p>
                    <ul className="list-disc pr-6 space-y-1">
                      {toArray(day.goals).length ? (
                        toArray(day.goals).map((goal, gIdx) => <li key={gIdx}>{goal}</li>)
                      ) : (
                        <li>لا توجد أهداف محددة</li>
                      )}
                    </ul>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">المفردات</p>
                    <div className="flex flex-wrap gap-2">
                      {toArray(day.vocab).length ? (
                        toArray(day.vocab).map((vocab, vIdx) => (
                          <Badge key={vIdx} variant="outline">{vocab}</Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">لا توجد مفردات محددة</span>
                      )}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-sm text-muted-foreground mb-1">نواتج التعلم</p>
                      <p>{day.outcomes || "-"}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-sm text-muted-foreground mb-1">الواجب المنزلي</p>
                      <p>{day.homework || "-"}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">لا توجد بيانات أيام في الاستجابة.</p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
