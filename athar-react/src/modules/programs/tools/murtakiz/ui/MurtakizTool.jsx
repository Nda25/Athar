import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Copy, Printer } from "lucide-react";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Textarea } from "@shared/ui/textarea";
import { generateMurtakaz } from "@modules/programs/api";

const AGES = [
  { value: "p1", label: "ابتدائي دُنيا" },
  { value: "p2", label: "ابتدائي عُليا" },
  { value: "m", label: "متوسط" },
  { value: "h", label: "ثانوي" },
];

const BLOOM = [
  { value: "remember", label: "تذكر" },
  { value: "understand", label: "فهم" },
  { value: "apply", label: "تطبيق" },
  { value: "analyze", label: "تحليل" },
  { value: "evaluate", label: "تقويم" },
  { value: "create", label: "إبداع" },
];

export default function MurtakizTool() {
  const [form, setForm] = useState({
    mode: "topic",
    subject: "",
    topic: "",
    sourceText: "",
    age: "p2",
    duration: 45,
    bloomMain: "understand",
    bloomSupport: "",
    goalCount: 3,
    notes: "",
    level: "متفاوت",
    adapt: false,
  });
  const [result, setResult] = useState(null);

  const mutation = useMutation({
    mutationFn: (payload) => generateMurtakaz(payload),
    onSuccess: (data) => {
      setResult(data);
      toast.success("تم توليد الخطة بنجاح");
    },
    onError: (error) => {
      toast.error("تعذر توليد الخطة", {
        description: error.message || "حاول مرة أخرى.",
      });
    },
  });

  const submit = (event) => {
    event.preventDefault();
    if (!form.subject.trim()) {
      toast.error("يرجى إدخال المادة");
      return;
    }
    if (form.mode === "topic" && !form.topic.trim()) {
      toast.error("يرجى إدخال موضوع الدرس");
      return;
    }
    if (form.mode === "text" && !form.sourceText.trim()) {
      toast.error("يرجى إدخال النص للتحليل");
      return;
    }

    mutation.mutate({
      ...form,
      variant: Date.now(),
      duration: Number(form.duration) || 45,
      goalCount: Number(form.goalCount) || 3,
    });
  };

  const copyPlan = async () => {
    if (!result) return;
    const parts = [
      "ملخص سريع",
      ...(result.goals || []).map((item) => `- ${item}`),
      "",
      "مخطط الدرس",
      ...(result.structure || []).map((item) => `- ${item}`),
      "",
      "أنشطة",
      ...(result.activities || []).map((item) => `- ${item}`),
      "",
      "تقويم",
      ...(result.assessment || []).map((item) => `- ${item}`),
    ];
    await navigator.clipboard.writeText(parts.join("\n"));
    toast.success("تم نسخ جميع المخرجات");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">مُـرتكز</h1>
        <p className="text-muted-foreground">أســاسٌ عميق.. يُرسـِّخ الأثـَـر.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>مُـرتكز</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>نمط الإدخال</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2"
                  value={form.mode}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, mode: e.target.value }))
                  }
                >
                  <option value="topic">موضوع مختصر</option>
                  <option value="text">نص للتحليل</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>المادة</Label>
                <Input
                  value={form.subject}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, subject: e.target.value }))
                  }
                  placeholder="رياضيات / علوم / لغة عربية"
                />
              </div>
            </div>

            {form.mode === "topic" ? (
              <div className="space-y-2">
                <Label>موضوع الدرس</Label>
                <Input
                  value={form.topic}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, topic: e.target.value }))
                  }
                  placeholder="الكسور / دورة حياة النبات"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>النص للتحليل</Label>
                <Textarea
                  rows={5}
                  value={form.sourceText}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, sourceText: e.target.value }))
                  }
                  placeholder="الصق فقرة تحليلية"
                />
              </div>
            )}

            <div className="grid md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>الفئة العمرية</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2"
                  value={form.age}
                  onChange={(e) => setForm((prev) => ({ ...prev, age: e.target.value }))}
                >
                  {AGES.map((age) => (
                    <option key={age.value} value={age.value}>
                      {age.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>زمن الحصة (دقيقة)</Label>
                <Input
                  type="number"
                  min={20}
                  max={120}
                  value={form.duration}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, duration: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>بلوم الأساسي</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2"
                  value={form.bloomMain}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, bloomMain: e.target.value }))
                  }
                >
                  {BLOOM.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>عدد الأهداف</Label>
                <Input
                  type="number"
                  min={1}
                  max={6}
                  value={form.goalCount}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, goalCount: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>ملاحظات خاصة (اختياري)</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="قيود صفية، أدوات متاحة..."
              />
            </div>

            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جار التوليد...
                </>
              ) : (
                "ولّد لي الخطة"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle>الخطة الناتجة</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={copyPlan}>
                <Copy className="ml-2 h-4 w-4" /> نسخ جميع المخرجات
              </Button>
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="ml-2 h-4 w-4" /> طباعة
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">الأهداف</h3>
              <ul className="list-disc pr-5 space-y-1 text-muted-foreground">
                {(result.goals || []).map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">مخطط الدرس</h3>
              <ul className="list-disc pr-5 space-y-1 text-muted-foreground">
                {(result.structure || []).map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">الأنشطة</h3>
              <ul className="list-disc pr-5 space-y-1 text-muted-foreground">
                {(result.activities || []).map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">التقويم</h3>
              <ul className="list-disc pr-5 space-y-1 text-muted-foreground">
                {(result.assessment || []).map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
