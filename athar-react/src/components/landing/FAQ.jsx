import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "ما نوع الاستشارات التي تقدمونها؟",
    a: "نقدم استشارات متنوعة تشمل تطوير الأعمال، التخطيط المالي، تحسين العمليات التشغيلية، وبناء استراتيجيات النمو للمشاريع الناشئة والقائمة.",
  },
  {
    q: "هل الاستشارة مجانية؟",
    a: "الجلسة التعريفية الأولى مجانية بالكامل لنفهم احتياجاتك ونحدد المسار الأنسب لك. بعد ذلك، يمكنك اختيار الباقة التي تناسب مشروعك.",
  },
  {
    q: "كم مدة الجلسة؟ وكيف تتم؟",
    a: "تتراوح مدة الجلسات بين 45 إلى 60 دقيقة، وتتم عادة عبر الإنترنت (Zoom/Google Meet) أو حضورياً في مقر الشركة بالرياض حسب رغبة العميل.",
  },
  {
    q: "هل أنتم شركة سعودية؟",
    a: "نعم، أثر هي شركة سعودية 100% متخصصة في تمكين قطاع الأعمال في المملكة وفهم تحديات السوق المحلي.",
  },
];

export function FAQ() {
  return (
    <section className="py-24 bg-[var(--bg)]">
      <div className="container mx-auto px-4 md:px-8 max-w-3xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-[var(--ink)] mb-4">
            الأسئلة الشائعة
          </h2>
        </div>

        <Accordion type="single" collapsible className="space-y-4">
          {FAQS.map((faq, idx) => (
            <AccordionItem key={idx} value={`item-${idx}`}>
              <AccordionTrigger>{faq.q}</AccordionTrigger>
              <AccordionContent>{faq.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
