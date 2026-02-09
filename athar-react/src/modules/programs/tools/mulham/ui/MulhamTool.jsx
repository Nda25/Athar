import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Loader2, Printer } from "lucide-react";
import { generateMulham } from "@shared/api";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Badge } from "@shared/ui/badge";

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatActivitiesForCopy(meta, sets, tips) {
  const lines = [];
  lines.push(`ملهم - ${meta.subject || ""} / ${meta.topic || ""}`.trim());
  lines.push(`المرحلة: ${meta.age || "-"} - الزمن: ${meta.time || "-"} دقيقة`);
  lines.push("");

  const blocks = [
    { key: "movement", label: "أنشطة حركية" },
    { key: "group", label: "أنشطة جماعية" },
    { key: "individual", label: "أنشطة فردية" },
  ];

  blocks.forEach((block) => {
    const item = sets[block.key] || {};
    lines.push(block.label);
    lines.push(`العنوان: ${item.title || "-"}`);
    lines.push(`الملخص: ${item.summary || "-"}`);
    lines.push(`المدة: ${item.duration || "-"} دقيقة`);
    lines.push(`المواد: ${toArray(item.materials).join(" | ") || "لا توجد"}`);
    lines.push(`الخطوات: ${toArray(item.steps).join(" | ") || "-"}`);
    lines.push(`تذكرة الخروج: ${item.exit || "-"}`);
    lines.push(`الأثر المتوقع: ${item.impact || "-"}`);
    lines.push("");
  });

  if (tips.length) {
    lines.push("نصائح عامة");
    tips.forEach((tip, idx) => lines.push(`${idx + 1}. ${tip}`));
  }

  return lines.join("\n");
}

function ActivityCard({ title, activity }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-blue-100 text-blue-700">{activity.duration || "-"} دقيقة</Badge>
          <Badge variant="outline">{activity.title || "نشاط مقترح"}</Badge>
        </div>
        <p className="text-muted-foreground">{activity.summary || "لا يوجد ملخص."}</p>

        <div>
          <p className="text-sm text-muted-foreground mb-1">الخطوات</p>
          <ul className="list-disc pr-6 space-y-1">
            {toArray(activity.steps).length ? (
              toArray(activity.steps).map((step, idx) => <li key={idx}>{step}</li>)
            ) : (
              <li>لا توجد خطوات محددة</li>
            )}
          </ul>
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-1">المواد</p>
          <div className="flex flex-wrap gap-2">
            {toArray(activity.materials).length ? (
              toArray(activity.materials).map((item, idx) => (
                <Badge key={idx} variant="outline">{item}</Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">لا توجد مواد خاصة</span>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-muted/40 p-3 space-y-2">
          <p><strong>تذكرة الخروج:</strong> {activity.exit || "-"}</p>
          <p><strong>الأثر المتوقع:</strong> {activity.impact || "-"}</p>
          {activity.lowMotivation ? <p><strong>تكييف منخفض التحفيز:</strong> {activity.lowMotivation}</p> : null}
          {activity.differentiation ? <p><strong>فروق فردية:</strong> {activity.differentiation}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default function MulhamTool() {
  const [form, setForm] = useState({
    subject: "",
    topic: "",
    stage: "متوسط",
    time: 45,
  });
  const [result, setResult] = useState(null);

  const mutation = useMutation({
    mutationFn: generateMulham,
    onSuccess: (data) => {
      setResult(data);
      toast.success("تم توليد باقات الأنشطة");
    },
    onError: (error) => toast.error("تعذر التوليد", { description: error.message }),
  });

  const submit = (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.topic.trim()) return toast.error("أكمل الحقول المطلوبة");
    mutation.mutate({ ...form, variant: Date.now(), time: Number(form.time) || 45 });
  };

  const meta = result?.meta || {};
  const sets = result?.sets || {};
  const tips = toArray(result?.tips);

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(formatActivitiesForCopy(meta, sets, tips));
    toast.success("تم نسخ باقة الأنشطة");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">مُلـهِم</h1>
        <p className="text-muted-foreground">أنشطة ملهمة لكل درس.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ملهم - أنشطة صفية</CardTitle>
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
                <Label>موضوع الدرس</Label>
                <Input
                  value={form.topic}
                  onChange={(e) => setForm((p) => ({ ...p, topic: e.target.value }))}
                />
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
                <Label>الوقت المتاح (دقائق)</Label>
                <Input
                  type="number"
                  min={10}
                  max={90}
                  value={form.time}
                  onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
                />
              </div>
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جار التوليد...
                </>
              ) : (
                "صمّم الأنشطة"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle>باقات الأنشطة</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCopy}>
                <Copy className="ml-2 h-4 w-4" /> نسخ جميع المخرجات
              </Button>
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="ml-2 h-4 w-4" /> طباعة
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-blue-100 text-blue-700">{meta.subject || form.subject}</Badge>
              <Badge className="bg-emerald-100 text-emerald-700">{meta.topic || form.topic}</Badge>
              <Badge className="bg-violet-100 text-violet-700">{meta.time || form.time} دقيقة</Badge>
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
              <ActivityCard title="أنشطة صفّية حركية" activity={sets.movement || {}} />
              <ActivityCard title="أنشطة صفّية جماعية" activity={sets.group || {}} />
              <ActivityCard title="أنشطة صفّية فردية" activity={sets.individual || {}} />
            </div>

            {tips.length ? (
              <div className="rounded-xl border p-4">
                <h3 className="font-semibold mb-2">نصائح تنفيذية</h3>
                <ul className="list-disc pr-6 space-y-1 text-muted-foreground">
                  {tips.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
