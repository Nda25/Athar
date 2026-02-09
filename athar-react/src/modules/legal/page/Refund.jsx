import { Layout } from "@modules/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";

export default function RefundPage() {
  return (
    <Layout>
      <section className="container mx-auto px-4 pt-28 pb-16">
        <div className="max-w-4xl mx-auto space-y-6">
          <header className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold">سياسة الاسترجاع</h1>
            <p className="text-muted-foreground">سياسة واضحة ومكتوبة لراحة العميل.</p>
            <p className="text-sm text-muted">آخر تحديث: 2025-09-21</p>
          </header>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">نطاق السياسة</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground leading-8">
              نظرًا لطبيعة خدماتنا الرقمية في منصة أثر، يتم تفعيل الاشتراكات فور إتمام عملية الدفع.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">أحكام الاسترجاع</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground leading-8">
              <ul className="list-disc pr-6 space-y-1">
                <li>لا يحق استرجاع المبلغ بعد تفعيل الاشتراك بنجاح.</li>
                <li>يحق استرداد المبلغ كاملًا إذا لم يتم تفعيل الاشتراك خلال 7 أيام من تاريخ الدفع.</li>
                <li>في حال وجود خطأ تقني يمنع الوصول للخدمة، يتم إرجاع المبلغ بعد التحقق.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">ملاحظات إضافية</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground leading-8">
              <ul className="list-disc pr-6 space-y-1">
                <li>الاشتراك يخص حسابًا واحدًا ولا يجوز نقله إلى حساب آخر بعد التفعيل.</li>
                <li>العروض والرموز الترويجية تُطبق وفق شروط العرض وقت الشراء.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">التواصل ورفع الشكاوى</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground leading-8 space-y-1">
              <p>البريد: <a className="underline" href="mailto:team@n-athar.co">team@n-athar.co</a></p>
              <p>واتساب: <a className="underline" href="https://wa.me/966556795993" target="_blank" rel="noopener noreferrer">اضغط هنا</a></p>
              <p>الشكاوى والاقتراحات: <a className="underline" href="/complaints">من هنا</a></p>
            </CardContent>
          </Card>
        </div>
      </section>
    </Layout>
  );
}
