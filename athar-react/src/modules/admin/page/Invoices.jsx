import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  FileText,
  Search,
  RefreshCw,
  Loader2,
  Download,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";

import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { Input } from "@shared/ui/input";
import { Badge } from "@shared/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shared/ui/table";
import { getInvoicesList } from "@shared/api";

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getInvoicesList();
      setInvoices(data.invoices || data || []);
    } catch (error) {
      console.error(error);
      toast.error("فشل تحميل الفواتير");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const safeInvoices = Array.isArray(invoices) ? invoices : [];

  const filteredInvoices = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return safeInvoices;
    return safeInvoices.filter((inv) => {
      const id = String(inv.id || "").toLowerCase();
      const email = String(inv.user_email || "").toLowerCase();
      return id.includes(term) || email.includes(term);
    });
  }, [safeInvoices, search]);

  const metrics = useMemo(() => {
    let paid = 0;
    let pending = 0;
    let failed = 0;

    for (const inv of safeInvoices) {
      const status = String(inv.status || "").toLowerCase();
      if (status === "paid" || status === "succeeded") paid += 1;
      else if (status === "pending") pending += 1;
      else if (status === "failed" || status === "canceled") failed += 1;
    }

    return {
      total: safeInvoices.length,
      paid,
      pending,
      failed,
    };
  }, [safeInvoices]);

  const getStatusBadge = (status) => {
    if (status === "paid" || status === "succeeded") {
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300">
          <CheckCircle className="w-3 h-3 mr-1" /> مدفوع
        </Badge>
      );
    }
    if (status === "pending") {
      return (
        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300">
          <Clock className="w-3 h-3 mr-1" /> معلق
        </Badge>
      );
    }
    if (status === "failed" || status === "canceled") {
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300">
          <XCircle className="w-3 h-3 mr-1" /> فشل
        </Badge>
      );
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge className="mb-3 bg-slate-900 text-white hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-100">
              إدارة الفواتير
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              الفواتير والعمليات
            </h2>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              متابعة المدفوعات وحالات الفواتير بشكل مباشر وواضح.
            </p>
          </div>
          <div className="grid gap-2 text-sm text-slate-700 dark:text-slate-300 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
              <span className="block text-xs text-slate-600 dark:text-slate-400">الإجمالي</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {loading ? "..." : metrics.total}
              </span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
              <span className="block text-xs text-slate-600 dark:text-slate-400">مدفوعة</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {loading ? "..." : metrics.paid}
              </span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
              <span className="block text-xs text-slate-600 dark:text-slate-400">معلقة</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {loading ? "..." : metrics.pending}
              </span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
              <span className="block text-xs text-slate-600 dark:text-slate-400">فاشلة</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {loading ? "..." : metrics.failed}
              </span>
            </div>
          </div>
        </div>
      </section>

      <Card className="border-slate-200 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <CardHeader className="pb-3">
          <div className="flex gap-4 justify-between items-center">
            <div className="relative w-72">
              <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث برقم الفاتورة أو البريد..."
                className="border-slate-200 bg-white pr-8 dark:border-slate-700 dark:bg-slate-800"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="mr-2 h-4 w-4" />
              تحديث
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="animate-spin text-slate-400" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>لا توجد فواتير</p>
            </div>
          ) : (
            <div className="rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">رقم الفاتورة</TableHead>
                    <TableHead className="text-right">المستخدم</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs">
                        {inv.id}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {inv.user_name || "مستخدم"}
                          </span>
                          <span className="text-xs text-slate-600 dark:text-slate-400">
                            {inv.user_email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {inv.amount
                          ? `${inv.amount / 100} ${inv.currency?.toUpperCase() || "SAR"}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {inv.created_at
                          ? format(
                              new Date(inv.created_at),
                              "dd MMM yyyy, HH:mm",
                              { locale: arSA },
                            )
                          : "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(inv.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
