import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Sparkles, Tag } from "lucide-react";
import { Layout } from "@modules/layout";
import { useAuth } from "@modules/auth";
import { pricing } from "@shared/config/content";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { Input } from "@shared/ui/input";
import { createInvoice, redeemCode } from "../api";

const PLAN_MAP = {
  weekly: "weekly",
  monthly: "monthly",
  semiannual: "semi",
  annual: "annual",
};

export default function PricingPage() {
  const { isAuthenticated, isLoading, loginWithRedirect, user } = useAuth();
  const [searchParams] = useSearchParams();
  const [promo, setPromo] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [processingPlan, setProcessingPlan] = useState("");

  const plans = useMemo(
    () => [
      { id: "weekly", ...pricing.plans.weekly },
      { id: "monthly", ...pricing.plans.monthly, featured: true },
      { id: "semiannual", ...pricing.plans.semiannual },
      { id: "annual", ...pricing.plans.annual },
    ],
    [],
  );

  useEffect(() => {
    if (searchParams.get("paid") === "1") {
      toast.success("تم الدفع بنجاح!", {
        description: "شكرا لاشتراكك في أثر. تم تفعيل العملية بنجاح.",
      });
    }
  }, [searchParams]);

  const handleRedeem = async () => {
    const code = promo.trim();
    if (!code) {
      toast.error("الرجاء إدخال رمز ترويجي");
      return;
    }
    if (!isAuthenticated) {
      loginWithRedirect({ appState: { returnTo: "/pricing" } });
      return;
    }

    try {
      setIsRedeeming(true);
      const res = await redeemCode(code);
      toast.success("تم تفعيل الرمز بنجاح", {
        description: res?.expires_at
          ? `تاريخ الانتهاء: ${new Date(res.expires_at).toLocaleDateString("ar-SA")}`
          : "تم تحديث اشتراكك بنجاح.",
      });
    } catch (error) {
      toast.error("تعذر تفعيل الرمز", {
        description: error.message || "تأكد من صحة الرمز وحاول مرة أخرى.",
      });
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleSubscribe = async (planId) => {
    if (!isAuthenticated) {
      loginWithRedirect({ appState: { returnTo: "/pricing" } });
      return;
    }

    const backendPlan = PLAN_MAP[planId];
    if (!backendPlan) {
      toast.error("الخطة غير مدعومة حاليا");
      return;
    }

    try {
      setProcessingPlan(planId);
      const res = await createInvoice({
        plan: backendPlan,
        promo: promo.trim() || null,
        email: user?.email || "",
      });

      if (!res?.url) {
        throw new Error("تعذر إنشاء رابط الدفع");
      }

      window.location.replace(res.url);
    } catch (error) {
      toast.error("تعذر إنشاء الفاتورة", {
        description: error.message || "حاول مرة أخرى بعد لحظات.",
      });
      setProcessingPlan("");
    }
  };

  return (
    <Layout>
      <section className="container mx-auto px-4 pt-28 pb-20 space-y-10">
        <div className="max-w-3xl mx-auto text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold">{pricing.title}</h1>
          <p className="text-muted">{pricing.tagline}</p>
          <p className="text-muted-foreground">{pricing.lead}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const isLoadingPlan = processingPlan === plan.id;
            return (
              <Card
                key={plan.id}
                className={`relative ${plan.featured ? "border-brand shadow-md" : ""}`}
              >
                {plan.featured && (
                  <span className="absolute -top-3 right-4 rounded-full bg-brand px-3 py-1 text-xs text-white">
                    الأكثر اختيارا
                  </span>
                )}
                <CardHeader>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-2xl font-bold text-brand">{plan.price}</p>
                  <Button
                    className="w-full"
                    disabled={isLoading || isLoadingPlan}
                    onClick={() => handleSubscribe(plan.id)}
                  >
                    {isLoadingPlan ? (
                      <>
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        جار التوجيه...
                      </>
                    ) : (
                      pricing.cta
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Tag className="h-5 w-5 text-brand" />
              {pricing.promo.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <Input
              value={promo}
              onChange={(e) => setPromo(e.target.value)}
              placeholder={pricing.promo.placeholder}
              className="sm:max-w-sm"
            />
            <Button
              variant="outline"
              onClick={handleRedeem}
              disabled={isRedeeming || isLoading}
            >
              {isRedeeming ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جار التفعيل...
                </>
              ) : (
                pricing.promo.button
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-brand" />
                {pricing.why.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">{pricing.why.text}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="h-5 w-5 text-brand" />
                {pricing.whyPaid.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                {pricing.whyPaid.text}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </Layout>
  );
}
