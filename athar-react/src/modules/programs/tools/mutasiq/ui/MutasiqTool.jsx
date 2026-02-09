import { useMemo, useState } from "react";
import { Download, Plus, Printer, Trash2 } from "lucide-react";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";

const DEFAULT_COLUMNS = ["حضور", "مشاركة", "واجبات"];

function csv(rows) {
  const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  return rows.map((row) => row.map(esc).join(",")).join("\n");
}

export default function MutasiqTool() {
  const [weeks, setWeeks] = useState(10);
  const [studentsText, setStudentsText] = useState("");
  const [newCol, setNewCol] = useState("");
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [cells, setCells] = useState({});

  const students = useMemo(
    () =>
      studentsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    [studentsText],
  );

  const weekHeaders = useMemo(
    () => Array.from({ length: Number(weeks) || 1 }).map((_, i) => `الأسبوع ${i + 1}`),
    [weeks],
  );

  const toggle = (student, week, col) => {
    const key = `${student}__${week}__${col}`;
    setCells((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const addColumn = () => {
    const label = newCol.trim();
    if (!label) return;
    if (columns.includes(label)) return;
    setColumns((prev) => [...prev, label]);
    setNewCol("");
  };

  const removeColumn = (label) => {
    setColumns((prev) => prev.filter((c) => c !== label));
    setCells((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (k.endsWith(`__${label}`)) delete next[k];
      });
      return next;
    });
  };

  const clearAll = () => setCells({});

  const exportCsv = () => {
    const header = ["الطالب", ...weekHeaders.flatMap((w) => columns.map((c) => `${w} - ${c}`))];
    const rows = students.map((student) => [
      student,
      ...weekHeaders.flatMap((week) =>
        columns.map((col) => (cells[`${student}__${week}__${col}`] ? "1" : "")),
      ),
    ]);

    const text = csv([header, ...rows]);
    const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mutasiq-tracker.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">مُتَّسِق</h1>
        <p className="text-muted-foreground">سجل متابعة قابل للتشكيل.. يُرتِّب وقتك.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>الإعدادات</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>عدد الأسابيع</Label>
              <Input
                type="number"
                min={1}
                max={52}
                value={weeks}
                onChange={(e) => setWeeks(Number(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>بنود التقييم</Label>
              <div className="flex gap-2">
                <Input
                  value={newCol}
                  onChange={(e) => setNewCol(e.target.value)}
                  placeholder="أضف بند تقييم جديد"
                />
                <Button onClick={addColumn}>
                  <Plus className="ml-2 h-4 w-4" /> إضافة
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {columns.map((c) => (
                  <Button key={c} variant="outline" size="sm" onClick={() => removeColumn(c)}>
                    <Trash2 className="ml-1 h-3.5 w-3.5" /> {c}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>قائمة الطلاب (كل اسم بسطر)</Label>
            <textarea
              className="w-full min-h-28 rounded-md border bg-background px-3 py-2"
              value={studentsText}
              onChange={(e) => setStudentsText(e.target.value)}
              placeholder="محمد\nسارة\nريم"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={clearAll}>
              <Trash2 className="ml-2 h-4 w-4" /> مسح العلامات
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="ml-2 h-4 w-4" /> طباعة
            </Button>
            <Button onClick={exportCsv}>
              <Download className="ml-2 h-4 w-4" /> تصدير CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>سجل المتابعة</CardTitle>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="text-sm text-muted-foreground">أضف أسماء الطلاب لعرض الجدول.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[960px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border p-2 bg-muted/40 text-right">الطالب</th>
                    {weekHeaders.map((week) => (
                      <th key={week} className="border p-2 bg-muted/40 text-center" colSpan={columns.length}>
                        {week}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th className="border p-2 bg-muted/20" />
                    {weekHeaders.flatMap((week) =>
                      columns.map((col) => (
                        <th key={`${week}-${col}`} className="border p-2 bg-muted/20 text-center">
                          {col}
                        </th>
                      )),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student}>
                      <td className="border p-2 font-medium">{student}</td>
                      {weekHeaders.flatMap((week) =>
                        columns.map((col) => {
                          const key = `${student}__${week}__${col}`;
                          const checked = !!cells[key];
                          return (
                            <td key={key} className="border p-2 text-center">
                              <button
                                type="button"
                                className={`w-6 h-6 rounded border ${checked ? "bg-brand text-white border-brand" : "bg-white"}`}
                                onClick={() => toggle(student, week, col)}
                                aria-label={`تبديل ${student} ${week} ${col}`}
                              >
                                {checked ? "✓" : ""}
                              </button>
                            </td>
                          );
                        }),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
