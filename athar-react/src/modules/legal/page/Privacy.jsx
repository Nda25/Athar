import { Layout } from "@modules/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";

const sections = [
  {
    title: "أولًا: ما الذي نجمعه؟",
    text: "نكتفي بالحد الأدنى اللازم لتشغيل الحساب والخدمة، مثل: الاسم، البريد الإلكتروني، وإعدادات الحساب.",
  },
  {
    title: "ثانيًا: كيف نستخدم البيانات؟",
    list: [
      "إنشاء حسابك وتفعيل الدخول وإدارة الجلسة.",
      "تشغيل الميزات التعليمية وحفظ تفضيلاتك.",
      "التواصل بخصوص التحديثات المهمة أو الأعطال.",
    ],
  },
  {
    title: "ثالثًا: كيف نحمي بياناتك؟",
    text: "نستخدم ممارسات أمنية معيارية، وتشفير أثناء النقل، وصلاحيات وصول محدودة عند الضرورة.",
  },
  {
    title: "رابعًا: مشاركة البيانات",
    text: "لا نبيع بياناتك ولا نشاركها لأغراض تسويقية. قد نستخدم مزودي خدمات بنية تحتية أو دفع ضمن حدود تشغيل الخدمة فقط.",
  },
  {
    title: "خامسًا: حقوقك",
    list: [
      "الاطلاع على بياناتك الأساسية.",
      "تحديث معلومات الحساب وتصحيحها.",
      "طلب حذف الحساب وفق الأنظمة المعمول بها.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <Layout>
      <section className="container mx-auto px-4 pt-28 pb-16">
        <div className="max-w-4xl mx-auto space-y-6">
          <header className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold">سياسة الخصوصية</h1>
            <p className="text-muted-foreground">
              نحترم خصوصيتك، ونبني الخدمة على مبدأ الحد الأدنى من جمع البيانات.
            </p>
            <p className="text-sm text-muted">آخر تحديث: 2025-09-21</p>
          </header>

          {sections.map((section) => (
            <Card key={section.title}>
              <CardHeader>
                <CardTitle className="text-xl">{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground leading-8 space-y-2">
                {section.text ? <p>{section.text}</p> : null}
                {section.list ? (
                  <ul className="list-disc pr-6 space-y-1">
                    {section.list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">تواصل</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              لأي استفسار متعلق بالخصوصية: <a className="underline" href="mailto:support@n-athar.co">support@n-athar.co</a>
            </CardContent>
          </Card>
        </div>
      </section>
    </Layout>
  );
}
