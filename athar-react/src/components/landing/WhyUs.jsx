import { Check, Star } from "lucide-react";

const FEATURES = [
  "بيانات فعلية، وليست مجرد آراء عامة.",
  "خبرة عميقة في السوق السعودي واحتياجاته.",
  "منهج عملي مبني على الواقع بعيداً عن النظريات.",
  "شبكة واسعة من الخبراء في مختلف المجالات.",
];

export function WhyUs() {
  return (
    <section className="py-24 bg-[var(--bg)] relative overflow-hidden">
      {/* Subtle Gold Background Accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[var(--sea-50)]/40 rounded-full blur-[120px] -z-10" />

      <div className="container mx-auto px-4 md:px-8">
        <div className="max-w-4xl mx-auto bg-[var(--ink)] rounded-[var(--radius)] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden">
          {/* Texture (CSS only) */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "radial-gradient(var(--sea-600) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-4 text-[var(--gold)]">
                <Star className="fill-current w-5 h-5" />
                <span className="font-bold uppercase tracking-wider text-sm">
                  لماذا تختار أثر؟
                </span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6 leading-tight">
                استشاراتك تعتمد على{" "}
                <span className="text-[var(--gold)]">حقائق</span>، لا تخمينات.
              </h2>
              <p className="text-gray-400 mb-8">
                نحن لا نقدم لك مجرد نصائح، بل نبني معك استراتيجيات قابلة للتنفيذ
                مدعومة بالأرقام والخبرة الواقعية.
              </p>
            </div>

            <ul className="space-y-6">
              {FEATURES.map((item, idx) => (
                <li key={idx} className="flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full bg-[var(--gold)] flex items-center justify-center shrink-0 mt-1">
                    <Check className="w-4 h-4 text-[var(--ink)]" />
                  </div>
                  <span className="text-lg font-medium text-gray-100">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
