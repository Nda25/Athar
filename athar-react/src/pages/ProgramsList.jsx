import { useState } from "react";
import { Search, Filter } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input"; // Need to create Input
import { Link } from "react-router-dom";

// Mock Data
const ALL_PROGRAMS = [
  {
    id: "montaleq",
    slug: "montaleq",
    title: "برنامج منطلق",
    category: "startups",
    desc: "حول فكرتك إلى مشروع واعد مع خطة عمل متكاملة.",
    active: true,
  },
  {
    id: "mortakaz",
    slug: "mortakaz",
    title: "برنامج مرتكز",
    category: "growth",
    desc: "نظم عملياتك وارفع كفاءة مشروعك القائم.",
    active: true,
  },
  {
    id: "market-analysis",
    slug: "market-analysis",
    title: "أداة تحليل السوق",
    category: "mtools",
    desc: "تحليل ذكي للمنافسين والفرص المتاحة.",
    active: true,
  },
  {
    id: "fin-health",
    slug: "financial-health",
    title: "فحص الصحة المالية",
    category: "finance",
    desc: "تقرير فوري عن وضعك المالي وتوصيات بالتحسين.",
    active: true,
  },
];

const CATEGORIES = [
  { id: "all", label: "الكل" },
  { id: "startups", label: "مشاريع ناشئة" },
  { id: "growth", label: "نمو وتوسع" },
  { id: "finance", label: "مالية" },
  { id: "mtools", label: "أدوات ذكية" },
];

export default function ProgramsList() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = ALL_PROGRAMS.filter((p) => {
    const matchCat = filter === "all" || p.category === filter;
    const matchSearch = p.title.includes(search) || p.desc.includes(search);
    return matchCat && matchSearch;
  });

  return (
    <Layout>
      <div className="bg-[var(--sea-25)] py-12 border-b border-[var(--sea-50)]">
        <div className="container mx-auto px-4 md:px-8 text-center">
          <h1 className="text-3xl font-bold mb-4">البرامج والأدوات</h1>
          <p className="text-[var(--muted)] max-w-xl mx-auto">
            اختر البرنامج أو الأداة المناسبة لمرحلة مشروعك وابدأ النمو الآن.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-8 py-12">
        {/* Filter Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12">
          {/* Categories */}
          <div className="flex flex-wrap gap-2 justify-center">
            {CATEGORIES.map((cat) => (
              <Button
                key={cat.id}
                variant={filter === cat.id ? "default" : "outline"}
                onClick={() => setFilter(cat.id)}
                size="sm"
                className="rounded-full"
              >
                {cat.label}
              </Button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] w-4 h-4" />
            <input
              type="text"
              placeholder="ابحث عن برنامج..."
              className="w-full h-10 pr-10 pl-4 rounded-[var(--radius)] border border-[var(--sea-200)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] bg-[var(--bg)] text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((prog) => (
            <Link key={prog.id} to={`/programs/${prog.slug}`}>
              <Card className="h-full hover:shadow-lg transition-all border-[var(--sea-50)] hover:border-[var(--sea-200)] group cursor-pointer">
                <CardHeader>
                  <Badge className="w-fit mb-2 bg-[var(--sea-50)] text-[var(--sea-700)] hover:bg-[var(--sea-100)] border-0">
                    {CATEGORIES.find((c) => c.id === prog.category)?.label}
                  </Badge>
                  <CardTitle className="group-hover:text-[var(--brand)] transition-colors">
                    {prog.title}
                  </CardTitle>
                  <CardDescription>{prog.desc}</CardDescription>
                </CardHeader>
                <CardFooter className="pt-4 mt-auto">
                  <Button
                    variant="ghost"
                    className="w-full justify-between hover:bg-[var(--sea-25)] group-hover:text-[var(--brand)]"
                  >
                    عرض التفاصيل
                    <span className="text-xl">←</span>
                  </Button>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
