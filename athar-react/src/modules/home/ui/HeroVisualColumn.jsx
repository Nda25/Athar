import { motion } from "framer-motion";

const FEED_ITEMS = [
  {
    title: "تخطيط سريع",
    time: "منذ دقيقتين",
    content: "خطط خلال دقائق معدودة وانطلق",
    avatarBg: "bg-sky-200",
  },
  {
    title: "وقت موفّر",
    time: "منذ 5 دقائق",
    content: "وفر  أكتر من 70% من وقتك وجهدك",
    avatarBg: "bg-emerald-200",
  },
  {
    title: "جودة المحتوى",
    time: "منذ 12 دقيقة",
    content: "محتوي تعليمي مبني على بلوم",
    avatarBg: "bg-amber-200",
  },
  {
    title: "بدون تكرار",
    time: "منذ 20 دقيقة",
    content: "قوالب جاهزة تُسرّع إعداد الدروس الإبداعية",
    avatarBg: "bg-purple-200",
  },
  {
    title: "رؤية أثَر",
    time: "منذ 30 دقيقة",
    content: "نحترم عقل المتعلم ونُعطي المعلم أدواتٍ دقيقة",
    avatarBg: "bg-rose-200",
  },
];

export function HeroVisualColumn() {
  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7, delay: 0.3 }}
      className="lg:col-span-5 relative flex items-center justify-center"
    >
      {/* Phone frame */}
      <div className="relative w-[300px] h-[600px]">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-gray-800 rounded-[3rem] shadow-2xl p-3">
          {/* Screen */}
          <div className="w-full h-full bg-background rounded-[2.5rem] overflow-hidden relative">
            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-900 rounded-b-2xl z-10" />

            {/* App content — auto-scrolling feed */}
            <motion.div
              animate={{ y: [0, -300, 0] }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: "linear",
              }}
              className="p-6 pt-10 space-y-4"
            >
              {FEED_ITEMS.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-card rounded-xl p-4 border border-border"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={`w-10 h-10 rounded-full ${item.avatarBg}`}
                    />
                    <div>
                      <h5 className="font-bold text-sm">{item.title}</h5>
                    </div>
                  </div>
                  <p className="text-sm">{item.content}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
