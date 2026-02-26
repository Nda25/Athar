import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { Badge } from "@shared/ui/badge";

const STORAGE_KEY = "athar:admin:categories";

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [label, setLabel] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) setCategories(parsed);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
  }, [categories]);

  const addCategory = () => {
    const value = label.trim();
    if (!value) return;
    if (categories.some((c) => c.name === value)) return;
    setCategories((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: value },
    ]);
    setLabel("");
  };

  const removeCategory = (id) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge className="mb-3 bg-primary text-primary-foreground">
              إدارة التصنيفات
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              التصنيفات
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              إضافة وحذف التصنيفات المستخدمة في صفحات الإدارة.
            </p>
          </div>
        </div>
      </section>

      <Card className="border-border shadow-sm bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">إضافة تصنيف</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="اسم التصنيف"
            className="border-border bg-card"
          />
          <Button
            onClick={addCategory}
            className="transition-transform hover:scale-105"
          >
            <Plus className="ml-2 h-4 w-4" /> إضافة
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">التصنيفات الحالية</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              لا توجد تصنيفات بعد.
            </p>
          ) : (
            categories.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3 transition-colors duration-200 hover:bg-secondary/50"
              >
                <p className="font-medium text-foreground">{item.name}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeCategory(item.id)}
                  className="hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
