import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Loader2, Printer } from "lucide-react";
import { generateEthraa } from "@shared/api";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Badge } from "@shared/ui/badge";

const FOCUS_LABEL = {
  auto: "تلقائي",
  latest: "أحدث الأبحاث",
  myth: "خرافة وتصحيح",
  fact: "معلومة مدهشة",
  activity: "نشاط تطبيقي",
};

function formatCards(cards) {
  return cards
    .map((item, idx) => {
      const rows = [
        `${idx + 1}) ${item.title}`,
        `شرح مختصر: ${item.brief}`,
        `تطبيق صفي: ${item.idea}`,
      ];
      if (item.source) rows.push(`المصدر: ${item.source}`);
      if (item.evidence_date) rows.push(`التاريخ: ${item.evidence_date}`);
      return rows.join("\n");
    })
    .join("\n\n");
}

export default function EthraaTool() {
  const [form, setForm] = useState({
    subject: "",
    stage: "متوسط",
    focus: "auto",
  });
  const [cards, setCards] = useState([]);

  const mutation = useMutation({
    mutationFn: generateEthraa,
    onSuccess: (data) => {
      const nextCards = Array.isArray(data?.cards) ? data.cards : [];
      setCards(nextCards);
      toast.success("تم توليد بطاقات الإثراء");
    },
    onError: (error) => toast.error("تعذر التوليد", { description: error.message }),
  });

  const submit = (e) => {
    e.preventDefault();
    if (!form.subject.trim()) return toast.error("أدخل المادة أولًا");
    mutation.mutate({ ...form, variant: Date.now() });
  };

  const handleCopyAll = async () => {
    if (!cards.length) return;
    await navigator.clipboard.writeText(formatCards(cards));
    toast.success("تم نسخ جميع البطاقات");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">إثــراء</h1>
        <p className="text-muted-foreground">أفكار مُلهمة تُجدد الدرس وتُواكب الجديد.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>إثراء - بطاقات معرفية</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>المادة</Label>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                  placeholder="علوم / رياضيات / لغة عربية"
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
                <Label>تركيز الإثراء</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2"
                  value={form.focus}
                  onChange={(e) => setForm((p) => ({ ...p, focus: e.target.value }))}
                >
                  <option value="auto">تلقائي</option>
                  <option value="latest">أحدث الأبحاث</option>
                  <option value="myth">خرافة وتصحيح</option>
                  <option value="fact">معلومة مدهشة</option>
                  <option value="activity">نشاط تطبيقي</option>
                </select>
              </div>
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جار التوليد...
                </>
              ) : (
                "ولّدي البطاقات"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {cards.length ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle>بطاقات الإثراء</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCopyAll}>
                <Copy className="ml-2 h-4 w-4" /> نسخ جميع البطاقات
              </Button>
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="ml-2 h-4 w-4" /> طباعة
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {cards.map((item, idx) => (
              <div key={`${item.title}-${idx}`} className="rounded-xl border p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-lg">{item.title}</h3>
                  <Badge className="bg-indigo-100 text-indigo-700">
                    {FOCUS_LABEL[form.focus] || "إثراء"}
                  </Badge>
                </div>
                <p className="text-muted-foreground leading-7">{item.brief}</p>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-sm text-muted-foreground mb-1">فكرة تطبيقية:</p>
                  <p className="leading-7">{item.idea}</p>
                </div>
                {item.source || item.evidence_date ? (
                  <p className="text-xs text-muted-foreground">
                    {item.source ? `المصدر: ${item.source}` : ""}
                    {item.source && item.evidence_date ? " - " : ""}
                    {item.evidence_date ? `التاريخ: ${item.evidence_date}` : ""}
                  </p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
