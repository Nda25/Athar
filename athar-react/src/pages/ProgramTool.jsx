import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ChevronRight,
  Sparkles,
  Copy,
  AlertTriangle,
  ChevronDown,
  Check,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { useForm } from "react-hook-form";

export default function ProgramTool() {
  const { slug } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  // Simulate AI Generation
  const onSubmit = async (data) => {
    setLoading(true);
    setResult(null);

    // Fake API delay
    setTimeout(() => {
      setLoading(false);
      setResult({
        summary:
          "بناءً على المعلومات المدخلة، مشروعك يمتلك فرصة نمو عالية في قطاع التجزئة نظراً لقلة المنافسين الحاليين.",
        steps: [
          "التركيز على التسويق الرقمي عبر منصات التواصل.",
          "بناء قاعدة عملاء أولية من خلال العروض الترويجية.",
          "مراقبة التدفقات النقدية بعناية في أول 6 أشهر.",
        ],
        raw: JSON.stringify(data, null, 2), // Just echo back for demo
      });
    }, 2000);
  };

  return (
    <Layout>
      {/* Header Breadcrumb */}
      <div className="bg-[var(--sea-25)] border-b border-[var(--sea-50)] py-8">
        <div className="container mx-auto px-4 md:px-8">
          <div className="flex items-center gap-2 text-sm text-[var(--muted)] mb-4">
            <Link to="/programs" className="hover:text-[var(--brand)]">
              البرامج
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-[var(--ink)] font-semibold">{slug}</span>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Sparkles className="text-[var(--gold)] w-8 h-8" />
            تحليل {slug}
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-8 py-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Input Form Column */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>بيانات المشروع</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2 text-[var(--ink)]">
                    اسم المشروع
                  </label>
                  <input
                    {...register("projectName", { required: true })}
                    className="w-full p-3 rounded-[var(--radius-sm)] border border-[var(--sea-200)] bg-[var(--bg)] focus:ring-2 focus:ring-[var(--brand)] outline-none"
                    placeholder="مثال: متجر أثر"
                  />
                  {errors.projectName && (
                    <span className="text-red-500 text-xs">مطلوب</span>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-[var(--ink)]">
                    وصف النشاط
                  </label>
                  <textarea
                    {...register("description", { required: true })}
                    className="w-full p-3 rounded-[var(--radius-sm)] border border-[var(--sea-200)] bg-[var(--bg)] focus:ring-2 focus:ring-[var(--brand)] outline-none min-h-[120px]"
                    placeholder="اشرح نشاطك التجاري باختصار..."
                  />
                  {errors.description && (
                    <span className="text-red-500 text-xs">مطلوب</span>
                  )}
                </div>

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "جاري التحليل..." : "ابدأ التحليل الآن"}
                  {!loading && <Sparkles className="mr-2 w-4 h-4" />}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Results Column */}
        <div className="lg:col-span-2">
          {loading && (
            <div className="h-full flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
              <div className="animate-spin w-12 h-12 border-4 border-[var(--sea-100)] border-t-[var(--brand)] rounded-full" />
              <p className="text-[var(--muted)]">
                جاري معالجة البيانات بواسطة الذكاء الاصطناعي...
              </p>
            </div>
          )}

          {!loading && !result && (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center border-2 border-dashed border-[var(--sea-200)] rounded-[var(--radius)] bg-[var(--sea-25)]/50">
              <Sparkles className="w-12 h-12 text-[var(--sea-300)] mb-4" />
              <h3 className="text-xl font-bold text-[var(--muted)]">
                النتائج ستظهر هنا
              </h3>
              <p className="text-sm text-[var(--muted)]/70 max-w-xs mt-2">
                قم بتعبئة النموذج ليمينك للحصول على استشارة فورية.
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Summary Section */}
              <div className="bg-white rounded-[var(--radius)] shadow-[var(--shadow)] p-8 border border-[var(--sea-100)]">
                <div className="flex justify-between items-start mb-6">
                  <h2 className="text-2xl font-bold text-[var(--brand)]">
                    النتيجة والتحليل
                  </h2>
                  <CopyButton content={result.summary} />
                </div>
                <p className="text-lg leading-relaxed text-[var(--ink)] bg-[var(--sea-25)] p-6 rounded-[var(--radius-sm)] border border-[var(--sea-50)]">
                  {result.summary}
                </p>
              </div>

              {/* Steps Section */}
              <div className="bg-white rounded-[var(--radius)] shadow-[var(--shadow)] p-8 border border-[var(--sea-100)]">
                <h3 className="text-xl font-bold mb-6">الخطوات المقترحة</h3>
                <ul className="space-y-4">
                  {result.steps.map((step, i) => (
                    <li key={i} className="flex gap-4 items-start">
                      <div className="w-8 h-8 rounded-full bg-[var(--green-100)] text-[var(--brand)] flex items-center justify-center shrink-0 font-bold bg-[var(--sea-50)]">
                        {i + 1}
                      </div>
                      <p className="pt-1 text-[var(--muted)]">{step}</p>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Raw Fallback */}
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="raw">
                  <AccordionTrigger className="text-[var(--muted)] text-sm">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      عرض النص الخام (للتحقق)
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <pre
                      className="bg-gray-900 text-green-400 p-4 rounded-[var(--radius-sm)] text-xs overflow-x-auto text-left"
                      dir="ltr"
                    >
                      {result.raw}
                    </pre>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function CopyButton({ content }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={handleCopy}
      className="text-[var(--muted)]"
    >
      {copied ? (
        <Check className="w-4 h-4 mr-2" />
      ) : (
        <Copy className="w-4 h-4 mr-2" />
      )}
      {copied ? "تم النسخ" : "نسخ"}
    </Button>
  );
}
