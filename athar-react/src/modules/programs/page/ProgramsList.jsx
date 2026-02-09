import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Layout } from "@modules/layout";
import { Button } from "@shared/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@shared/ui/card";
import { Badge } from "@shared/ui/badge";
import { Input } from "@shared/ui/input";
import { Link } from "react-router-dom";
import { tools } from "@shared/config/content";

const ACTIVE_IDS = new Set([
  "montalaq",
  "murtakiz",
  "masar",
  "miaad",
  "mueen",
  "mithaq",
  "ethraa",
  "mulham",
  "mutasiq",
]);

const CATEGORY_MAP = {
  montalaq: "التخطيط الذكي",
  murtakiz: "بناء الخطط",
  masar: "تنظيم الجداول",
  miaad: "التذكير والمتابعة",
  mueen: "الخطة الأسبوعية",
  mithaq: "الربط المعرفي",
  ethraa: "الإثراء",
  mulham: "الأنشطة الصفية",
  mutasiq: "المتابعة والتقييم",
};

export default function ProgramsList() {
  const allPrograms = useMemo(
    () =>
      Object.entries(tools).map(([id, tool]) => ({
        id,
        title: tool.name,
        desc: tool.description,
        href: tool.href,
        category: CATEGORY_MAP[id] || "أدوات ذكية",
        active: ACTIVE_IDS.has(id),
      })),
    [],
  );

  const categories = useMemo(() => {
    const unique = [...new Set(allPrograms.map((item) => item.category))];
    return ["الكل", ...unique];
  }, [allPrograms]);

  const [filter, setFilter] = useState("الكل");
  const [search, setSearch] = useState("");

  const filtered = allPrograms.filter((p) => {
    const matchCat = filter === "الكل" || p.category === filter;
    const matchSearch = p.title.includes(search) || p.desc.includes(search);
    return matchCat && matchSearch;
  });

  return (
    <Layout>
      <div className="bg-[var(--sea-25)] py-12 border-b border-[var(--sea-50)]">
        <div className="container mx-auto px-4 md:px-8 text-center">
          <h1 className="text-3xl font-bold mb-4">البرامج والأدوات</h1>
          <p className="text-[var(--muted)] max-w-xl mx-auto">
            اختر الأداة المناسبة لمرحلتك التعليمية، وابدأ التحضير الذكي مباشرة.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-8 py-12">
        {/* Filter Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12">
          {/* Categories */}
          <div className="flex flex-wrap gap-2 justify-center">
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={filter === cat ? "default" : "outline"}
                onClick={() => setFilter(cat)}
                size="sm"
                className="rounded-full"
              >
                {cat}
              </Button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] w-4 h-4" />
            <Input
              placeholder="ابحث عن برنامج..."
              className="pr-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((prog) => (
            <Link
              key={prog.id}
              to={prog.active ? prog.href : "#"}
              onClick={(event) => {
                if (!prog.active) event.preventDefault();
              }}
            >
              <Card className="h-full hover:shadow-lg transition-all border-[var(--sea-50)] hover:border-[var(--sea-200)] group cursor-pointer">
                <CardHeader>
                  <Badge className="w-fit mb-2 bg-[var(--sea-50)] text-[var(--sea-700)] hover:bg-[var(--sea-100)] border-0">
                    {prog.category}
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
                    {prog.active ? "فتح الأداة" : "قريبًا"}
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
