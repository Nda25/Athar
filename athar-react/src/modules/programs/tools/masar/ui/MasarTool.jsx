import { useMemo, useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";

function toCsv(rows) {
  const esc = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return rows.map((row) => row.map(esc).join(",")).join("\n");
}

export default function MasarTool() {
  const [daysCount, setDaysCount] = useState(5);
  const [periodsCount, setPeriodsCount] = useState(7);
  const [start, setStart] = useState("07:30");
  const [duration, setDuration] = useState(45);
  const [table, setTable] = useState({});

  const dayNames = useMemo(() => {
    const all = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس"];
    return all.slice(0, daysCount);
  }, [daysCount]);

  const periods = useMemo(() => {
    const [h, m] = start.split(":").map(Number);
    const totalStart = h * 60 + m;
    return Array.from({ length: periodsCount }).map((_, idx) => {
      const begin = totalStart + idx * duration;
      const end = begin + duration;
      const fmt = (mins) =>
        `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
      return {
        id: idx + 1,
        label: `الحصة ${idx + 1}`,
        time: `${fmt(begin)} - ${fmt(end)}`,
      };
    });
  }, [duration, periodsCount, start]);

  const setCell = (day, periodId, value) => {
    const key = `${day}-${periodId}`;
    setTable((prev) => ({ ...prev, [key]: value }));
  };

  const clearTable = () => setTable({});

  const downloadCsv = () => {
    const header = ["الوقت", ...dayNames];
    const rows = periods.map((period) => [
      `${period.label} (${period.time})`,
      ...dayNames.map((day) => table[`${day}-${period.id}`] || ""),
    ]);
    const csv = toCsv([header, ...rows]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "masar-schedule.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">مَسار</h1>
        <p className="text-muted-foreground">بترتيب الخطى تُـــدرَكُ الأهــداف.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>مَسار - إعداد الجدول</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>عدد الأيام</Label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2"
              value={daysCount}
              onChange={(e) => setDaysCount(Number(e.target.value))}
            >
              <option value={5}>الأحد - الخميس</option>
              <option value={4}>الأحد - الأربعاء</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>عدد الحصص</Label>
            <Input
              type="number"
              min={4}
              max={10}
              value={periodsCount}
              onChange={(e) => setPeriodsCount(Number(e.target.value) || 7)}
            />
          </div>
          <div className="space-y-2">
            <Label>بداية اليوم</Label>
            <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>مدة الحصة (دقائق)</Label>
            <Input
              type="number"
              min={30}
              max={90}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) || 45)}
            />
          </div>
          <div className="md:col-span-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={clearTable}>
              <Trash2 className="ml-2 h-4 w-4" /> مسح البيانات
            </Button>
            <Button onClick={downloadCsv}>
              <Download className="ml-2 h-4 w-4" /> تصدير CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الجدول</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr>
                  <th className="border p-2 bg-muted/40 text-right">الحصة / الوقت</th>
                  {dayNames.map((day) => (
                    <th key={day} className="border p-2 bg-muted/40 text-right">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => (
                  <tr key={period.id}>
                    <td className="border p-2 align-top text-sm">
                      <div className="font-medium">{period.label}</div>
                      <div className="text-muted-foreground">{period.time}</div>
                    </td>
                    {dayNames.map((day) => {
                      const key = `${day}-${period.id}`;
                      return (
                        <td key={key} className="border p-2">
                          <Input
                            value={table[key] || ""}
                            onChange={(e) => setCell(day, period.id, e.target.value)}
                            placeholder="اسم المادة / الفصل"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
            <Plus className="h-3 w-3" />
            التعديل مباشر، ثم استخدم التصدير لحفظ نسخة CSV.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
