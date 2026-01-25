import { Button } from "@/components/ui/button";

export function FinalCTA() {
  return (
    <section className="py-20 bg-sea-900 text-white text-center">
      <div className="container mx-auto px-4 md:px-8 max-w-4xl">
        <h2 className="text-3xl md:text-5xl font-bold mb-6">
          جاهز لنقل مشروعك للمستوى التالي؟
        </h2>
        <p className="text-sea-50 text-lg mb-10 max-w-2xl mx-auto font-medium opacity-90">
          لا تدع التحديات توقفك. احجز استشارتك الآن وابدأ رحلة النمو مع "أثر".
        </p>
        <div className="flex justify-center gap-4">
          <Button
            size="lg"
            className="h-14 px-10 text-lg rounded-full bg-brand hover:bg-white hover:text-brand border-2 border-transparent hover:border-brand transition-all duration-300"
          >
            احجز موعدك الآن
          </Button>
        </div>
      </div>
    </section>
  );
}
