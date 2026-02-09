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
import { motion, AnimatePresence } from "framer-motion";

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
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 mb-2">
          <Wand2 className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100">
          مـُـنـطـلـق
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
          حيـثُ تبدأ الخطوة.. ويستمـرُ الأثـر. ساعدني في بناء استراتيجيات وأنشطة
          وأسئلة تقويمية مناسبة لدرسي.
        </p>
      </div>

      {/* Input Form */}
      <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur">
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="stage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>المرحلة الدراسية</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
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
                    <FormItem>
                      <FormLabel>المادة</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={!selectedStage}
                      >
                        <FormControl>
                          <SelectTrigger>
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="bloom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>تصنيف بلوم</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value || "الكل"}
                      >
                        <FormControl>
                          <SelectTrigger>
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

                <FormField
                  control={form.control}
                  name="lesson"
                  render={({ field }) => (
                    <FormItem>
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="preferred"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>تفضيل شكل الاستراتيجية (اختياري)</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
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
                      <FormDescription>
                        لن يغيّر شكل الإخراج؛ فقط يوجّه اختيار الاستراتيجية.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full sm:w-auto text-lg gap-2 bg-blue-600 hover:bg-blue-700"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      جاري التحضير...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" />✨ ساعدني على الإبداع
                    </>
                  )}
                </Button>

                {result && (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => onSubmit(form.getValues())}
                    disabled={mutation.isPending}
                    className="w-full sm:w-auto"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    أبدع باستراتيجية أخرى
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Result Display */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
            ref={resultRef}
          >
            {/* Divider */}
            <div className="h-4 opacity-30 bg-[radial-gradient(circle_at_6px_6px,var(--color-blue-500)_3px,transparent_4px)_repeat-x_left/26px_12px]" />

            <Card className="border-2 border-blue-50 dark:border-blue-900/30 shadow-xl overflow-hidden">
              <CardHeader className="bg-blue-50/50 dark:bg-slate-800/50 border-b border-blue-100 dark:border-slate-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <CardTitle className="text-2xl font-bold text-blue-900 dark:text-blue-200">
                    {result.strategy_name || "استراتيجية مقترحة"}
                  </CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="bg-white">
                      {form.getValues().lesson}
                    </Badge>
                    <Badge variant="secondary" className="bg-white">
                      {STAGES[form.getValues().stage]}
                    </Badge>
                    <Badge variant="outline">{form.getValues().subject}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 md:p-8 space-y-8">
                {/* Importance & Materials */}
                <div className="grid md:grid-cols-2 gap-8">
                  <section>
                    <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                      <span className="w-2 h-6 bg-blue-500 rounded-full" />{" "}
                      الأهمية
                    </h3>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                      {result.importance}
                    </p>
                  </section>
                  <section>
                    <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                      <span className="w-2 h-6 bg-cyan-500 rounded-full" />{" "}
                      المواد والأدوات
                    </h3>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                      {result.materials}
                    </p>
                  </section>
                </div>

                <Separator />

                {/* Goals & Steps */}
                <div className="grid md:grid-cols-2 gap-8">
                  <section>
                    <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 mb-3">
                      🎯 الأهداف
                    </h3>
                    <ul className="space-y-2 list-disc list-inside text-slate-700 dark:text-slate-300">
                      {result.goals?.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </section>
                  <section>
                    <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 mb-3">
                      👣 خطوات التطبيق
                    </h3>
                    <ol className="space-y-3 list-decimal list-inside text-slate-700 dark:text-slate-300">
                      {result.steps?.map((step, i) => (
                        <li key={i} className="leading-relaxed pl-2">
                          {step}
                        </li>
                      ))}
                    </ol>
                  </section>
                </div>

                {/* Examples */}
                <section className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-xl border border-amber-100 dark:border-amber-900/20">
                  <h3 className="text-lg font-bold text-amber-800 dark:text-amber-400 mb-3">
                    💡 أمثلة عملية
                  </h3>
                  <ul className="space-y-2 list-disc list-inside text-slate-700 dark:text-slate-300">
                    {result.examples?.map((ex, i) => (
                      <li key={i}>{ex}</li>
                    ))}
                  </ul>
                </section>

                {/* Assessment & Differentiation */}
                <div className="grid md:grid-cols-2 gap-8">
                  <section>
                    <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 mb-2">
                      📊 التقويم
                    </h3>
                    <p className="text-slate-700 dark:text-slate-300">
                      {result.assessment}
                    </p>
                  </section>
                  <section>
                    <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 mb-2">
                      ⚖️ تفريق التعليم
                    </h3>
                    <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                      {result.diff_support && (
                        <p>
                          <strong>دعم:</strong> {result.diff_support}
                        </p>
                      )}
                      {result.diff_core && (
                        <p>
                          <strong>أساسي:</strong> {result.diff_core}
                        </p>
                      )}
                      {result.diff_challenge && (
                        <p>
                          <strong>تحدي:</strong> {result.diff_challenge}
                        </p>
                      )}
                    </div>
                  </section>
                </div>

                <Separator />

                {/* Impact */}
                <section>
                  <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 mb-2">
                    💎 الأثر المتوقع
                  </h3>
                  <p className="text-slate-700 dark:text-slate-300">
                    {result.expected_impact}
                  </p>
                </section>
              </CardContent>
              <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 border-t flex justify-end gap-2">
                <Button variant="outline" onClick={handleCopy} className="gap-2">
                  <Copy className="w-4 h-4" />
                  نسخ جميع المخرجات
                </Button>
                <Button variant="outline" onClick={handlePrint} className="gap-2">
                  <Printer className="w-4 h-4" />
                  طباعة
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
