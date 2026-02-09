import { Layout } from "@modules/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";

const sections = [
  {
    title: "١) التعريف بالخدمة",
    text: "«أثر» منصة تعليمية تساعد المعلمين والمعلمات على تصميم أنشطة وأسئلة وخطط درسية مرنة. استخدامك للمنصة يعني موافقتك على هذه الشروط.",
  },
  {
    title: "٢) إنشاء الحساب",
    list: [
      "يجب تقديم معلومات صحيحة ومحدثة وحفظ بيانات الدخول بسرية.",
      "أنت مسؤول عن أي نشاط يتم عبر حسابك.",
      "يجوز إيقاف الحساب عند إساءة الاستخدام أو مخالفة البنود.",
    ],
  },
  {
    title: "٣) الاستخدام المقبول",
    list: [
      "يمنع استخدام المنصة في أي نشاط مخالف للقانون.",
      "يمنع نشر محتوى مسيء أو منتهك لحقوق الملكية الفكرية.",
      "يمنع التحايل أو تجاوز القيود التقنية بشكل يضر بالخدمة.",
    ],
  },
  {
    title: "٤) الدقة والمسؤولية المهنية",
    text: "قد تولد المنصة محتوى آليا يحتاج إلى مراجعة تربوية قبل الاستخدام، والمعلم مسؤول عن التحقق من الملاءمة والدقة.",
  },
  {
    title: "٥) إخلاء المسؤولية",
    text: "تقدم الخدمة كما هي دون ضمانات صريحة أو ضمنية، ولا نتحمل الأضرار غير المباشرة بالقدر الذي يسمح به النظام.",
  },
];

export default function TermsPage() {
  return (
    <Layout>
      <section className="container mx-auto px-4 pt-28 pb-16">
        <div className="max-w-4xl mx-auto space-y-6">
          <header className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold">الشروط والأحكام</h1>
            <p className="text-muted-foreground">تنظيم استخدامك لمنصة أثر. الرجاء القراءة بعناية.</p>
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
              للاستفسارات القانونية أو الدعم: <a className="underline" href="mailto:team@n-athar.co">team@n-athar.co</a>
            </CardContent>
          </Card>
        </div>
      </section>
    </Layout>
  );
}
