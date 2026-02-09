import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";

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
    setCategories((prev) => [...prev, { id: crypto.randomUUID(), name: value }]);
    setLabel("");
  };

  const removeCategory = (id) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">إدارة التصنيفات</h2>
        <p className="text-muted-foreground mt-2">إضافة/حذف التصنيفات المستخدمة في صفحات الإدارة.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>إضافة تصنيف</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="اسم التصنيف"
          />
          <Button onClick={addCategory}>
            <Plus className="ml-2 h-4 w-4" /> إضافة
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>التصنيفات الحالية</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد تصنيفات بعد.</p>
          ) : (
            categories.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                <p className="font-medium">{item.name}</p>
                <Button variant="outline" size="sm" onClick={() => removeCategory(item.id)}>
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
