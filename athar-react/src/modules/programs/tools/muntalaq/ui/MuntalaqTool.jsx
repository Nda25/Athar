import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Loader2,
  Copy,
  Printer,
  RefreshCw,
  Wand2,
  ChevronDown,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { generateStrategy } from "@shared/api";
import { Button } from "@shared/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@shared/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@shared/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/ui/select";
import { Input } from "@shared/ui/input";
import { Badge } from "@shared/ui/badge";
import { Separator } from "@shared/ui/separator";

// ===== Data Constants =====
const SUBJECTS = {
  "primary-lower": [
    "اللغة العربية",
    "الرياضيات",
    "العلوم",
    "مهارات رقمية",
    "اللغة الإنجليزية",
    "الدراسات الإسلامية",
    "التربية الفنية",
    "التربية البدنية والدفاع عن النفس",
    "مهارات حياتية وأسرية",
  ],
  "primary-upper": [
    "اللغة العربية",
    "الرياضيات",
    "العلوم",
    "المهارات الرقمية",
    "اللغة الإنجليزية",
    "الدراسات الإجتماعية",
    "الدراسات الإسلامية",
    "التفكير الناقد",
    "التربية الفنية",
    "التربية البدنية والدفاع عن النفس",
  ],
  middle: [
    "اللغة العربية",
    "الرياضيات",
    "العلوم",
    "اللغة الإنجليزية",
    "الدراسات الإجتماعية",
    "الدراسات الإسلامية",
    "التفكير الناقد والمنطق",
    "مهارات رقمية",
    "التربية الفنية",
    "التربية البدنية والدفاع عن النفس",
  ],
  secondary: [
    "الفيزياء",
    "الكيمياء",
    "الأحياء",
    "الرياضيات",
    "اللغة العربية",
    "اللغة الإنجليزية",
    "التاريخ",
    "الدراسات الإسلامية",
    "مهارات رقمية",
    "علم الأرض والفضاء",
    "التفكير الناقد",
  ],
};

const STAGES = {
  "primary-lower": "المرحلة الإبتدائية — دنيا",
  "primary-upper": "المرحلة الإبتدائية — عليا",
  middle: "المرحلة المتوسطة",
  secondary: "المرحلة الثانوية",
};

const BLOOM_TYPES = [
  "الكل",
  "تذكّر",
  "فهم",
  "تطبيق",
  "تحليل",
  "تقييم",
  "إبداع",
];

const PREFERRED_STRATEGIES = [
  "بدون تفضيل",
  "مخطط فن",
  "السبب والنتيجة",
  "الرؤوس المرقمة",
  "فكر–زاوج–شارك",
  "بطاقات الأرقام",
  "القبعات الست (مبسطة)",
  "محطات التعلم",
  "CER (ادّعاء–دليل–تفسير)",
];

const formSchema = z.object({
  stage: z.string().min(1, "الرجاء اختيار المرحلة"),
  subject: z.string().min(1, "الرجاء اختيار المادة"),
  bloom: z.string().optional(),
  lesson: z.string().min(2, "الرجاء كتابة اسم الدرس"),
  preferred: z.string().optional().nullable(),
});

export default function MuntalaqTool() {
  const [result, setResult] = useState(null);
  const resultRef = useRef(null);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      stage: "",
      subject: "",
      bloom: "الكل",
      lesson: "",
      preferred: "",
    },
  });

  const selectedStage = form.watch("stage");
  const availableSubjects = selectedStage ? SUBJECTS[selectedStage] : [];

  const mutation = useMutation({
    mutationFn: (values) =>
      generateStrategy({
        stage: values.stage,
        subject: values.subject,
        bloomType: values.bloom,
        lesson: values.lesson,
        preferred: values.preferred === "بدون تفضيل" ? "" : values.preferred,
        variant: Math.floor(Math.random() * 1000000),
      }),
    onSuccess: (data) => {
      setResult(data);
      toast.success("تم توليد الاستراتيجية بنجاح! ✨");
      setTimeout(() => {
        resultRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    },
    onError: (error) => {
      toast.error(`حدث خطأ: ${error.message}`);
    },
  });

  const onSubmit = (values) => {
    mutation.mutate(values);
  };

  const handleCopy = () => {
    if (!resultRef.current) return;
    const text = resultRef.current.innerText;
    navigator.clipboard.writeText(text);
    toast.success("تم نسخ جميع المخرجات");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">مـُـنـطـلـق</h1>
        <p className="text-muted-foreground">
          حيـثُ تبدأ الخطوة.. ويستمـرُ الأثـر. ساعدني في بناء استراتيجيات وأنشطة
          وأسئلة تقويمية مناسبة لدرسي.
        </p>
      </div>

      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle>مـُـنـطـلـق - إعداد الدرس</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="stage"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>المرحلة الدراسية</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="اختر المرحلة" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.keys(STAGES).map((key) => (
                            <SelectItem key={key} value={key}>
                              {STAGES[key]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>المادة</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={!selectedStage}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="اختر المادة" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableSubjects.map((sub, idx) => (
                            <SelectItem key={idx} value={sub}>
                              {sub}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bloom"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>تصنيف بلوم</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value || "الكل"}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="اختر المستوى" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {BLOOM_TYPES.map((t, idx) => (
                            <SelectItem key={idx} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="lesson"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>عنوان الدرس</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="مثال: الاتزان الدوراني"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="preferred"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <div className="flex justify-between items-end">
                        <FormLabel>شكل الاستراتيجية (اختياري)</FormLabel>
                      </div>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="بدون تفضيل" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PREFERRED_STRATEGIES.map((t, idx) => (
                            <SelectItem key={idx} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="submit"
                disabled={mutation.isPending}
                className="mt-2"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري التحضير...
                  </>
                ) : (
                  "توليد الاستراتيجية"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Result Display */}
      {result && (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <CardTitle>
                {result.strategy_name || "استراتيجية مقترحة"}
              </CardTitle>
              <div className="hidden sm:flex gap-2">
                <Badge variant="secondary">{form.getValues().lesson}</Badge>
                <Badge variant="outline">{form.getValues().subject}</Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCopy}>
                <Copy className="ml-2 h-4 w-4" /> نسخ المخرجات
              </Button>
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="ml-2 h-4 w-4" /> طباعة
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6" ref={resultRef}>
            {/* Importance & Materials */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  الأهمية
                </h3>
                <div className="rounded-lg  p-4 border text-muted-foreground leading-relaxed">
                  {result.importance}
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  المواد والأدوات
                </h3>
                <div className="rounded-lg  p-4 border text-muted-foreground leading-relaxed">
                  {result.materials}
                </div>
              </div>
            </div>

            <Separator />

            {/* Goals & Steps */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">الأهداف</h3>
                <ul className="space-y-2 list-disc list-inside text-muted-foreground">
                  {result.goals?.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">خطوات التطبيق</h3>
                <ol className="space-y-3 list-decimal list-inside text-muted-foreground">
                  {result.steps?.map((step, i) => (
                    <li key={i} className="leading-relaxed pl-2">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Examples */}
            {result.examples && result.examples.length > 0 && (
              <div className="rounded-xl border p-5 space-y-3">
                <h3 className="font-semibold text-lg">أمثلة عملية</h3>
                <ul className="space-y-2 list-disc list-inside text-muted-foreground">
                  {result.examples?.map((ex, i) => (
                    <li key={i}>{ex}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Assessment & Differentiation */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">التقويم</h3>
                <p className="text-muted-foreground">{result.assessment}</p>
              </div>
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">تفريق التعليم</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {result.diff_support && (
                    <p>
                      <strong className="text-foreground">دعم:</strong>{" "}
                      {result.diff_support}
                    </p>
                  )}
                  {result.diff_core && (
                    <p>
                      <strong className="text-foreground">أساسي:</strong>{" "}
                      {result.diff_core}
                    </p>
                  )}
                  {result.diff_challenge && (
                    <p>
                      <strong className="text-foreground">تحدي:</strong>{" "}
                      {result.diff_challenge}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Impact */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">الأثر المتوقع</h3>
              <p className="text-muted-foreground leading-relaxed">
                {result.expected_impact}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
