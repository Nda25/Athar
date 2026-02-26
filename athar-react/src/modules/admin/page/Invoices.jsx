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
import { getAdminInvoicesList } from "@shared/api";

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getAdminInvoicesList();
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
    let result = safeInvoices;

    // Apply status filter
    if (statusFilter !== "all") {
      result = result.filter((inv) => {
        const s = String(inv.status || "").toLowerCase();
        if (statusFilter === "paid") {
          return s === "paid" || s === "succeeded";
        }
        if (statusFilter === "pending") {
          return s === "pending" || s === "initiated";
        }
        if (statusFilter === "failed") {
          return (
            s === "failed" || s === "canceled" || s === "400" || s === "401"
          );
        }
        return true;
      });
    }

    // Apply text search
    const term = search.toLowerCase().trim();
    if (!term) return result;

    return result.filter((inv) => {
      const id = String(inv.id || "").toLowerCase();
      const email = String(inv.user_email || "").toLowerCase();
      return id.includes(term) || email.includes(term);
    });
  }, [safeInvoices, search, statusFilter]);

  const metrics = useMemo(() => {
    let paid = 0;
    let pending = 0;
    let failed = 0;

    for (const inv of safeInvoices) {
      const status = String(inv.status || "").toLowerCase();
      if (status === "paid" || status === "succeeded") paid += 1;
      else if (status === "pending" || status === "initiated") pending += 1;
      else if (
        status === "failed" ||
        status === "canceled" ||
        status === "400" ||
        status === "401"
      )
        failed += 1;
    }

    return {
      total: safeInvoices.length,
      paid,
      pending,
      failed,
    };
  }, [safeInvoices]);

  const getStatusBadge = (status) => {
    const s = String(status || "").toLowerCase();

    if (s === "paid" || s === "succeeded") {
      return (
        <Badge className="bg-green-100 text-green-800  dark:bg-green-900/30 dark:text-green-300">
          <CheckCircle className="w-3 h-3 ml-1" /> مدفوع
        </Badge>
      );
    }
    if (s === "pending" || s === "initiated") {
      return (
        <Badge className="bg-amber-100 text-amber-800  dark:bg-amber-900/30 dark:text-amber-300">
          <Clock className="w-3 h-3 ml-1" /> معلق
        </Badge>
      );
    }
    if (s === "failed" || s === "canceled" || s === "400" || s === "401") {
      return (
        <Badge className="bg-red-100 text-red-800  dark:bg-red-900/30 dark:text-red-300">
          <XCircle className="w-3 h-3 ml-1" /> فشل
        </Badge>
      );
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge className="mb-3 bg-primary text-primary-foreground">
              إدارة الفواتير
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              الفواتير والعمليات
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              متابعة المدفوعات وحالات الفواتير بشكل مباشر وواضح.
            </p>
          </div>
          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-secondary px-3 py-2">
              <span className="block text-xs text-muted-foreground">
                الإجمالي
              </span>
              <span className="font-semibold text-foreground">
                {loading ? "..." : metrics.total}
              </span>
            </div>
            <div className="rounded-xl border border-border bg-secondary px-3 py-2">
              <span className="block text-xs text-muted-foreground">
                مدفوعة
              </span>
              <span className="font-semibold text-foreground">
                {loading ? "..." : metrics.paid}
              </span>
            </div>
            <div className="rounded-xl border border-border bg-secondary px-3 py-2">
              <span className="block text-xs text-muted-foreground">معلقة</span>
              <span className="font-semibold text-foreground">
                {loading ? "..." : metrics.pending}
              </span>
            </div>
            <div className="rounded-xl border border-border bg-secondary px-3 py-2">
              <span className="block text-xs text-muted-foreground">فاشلة</span>
              <span className="font-semibold text-foreground">
                {loading ? "..." : metrics.failed}
              </span>
            </div>
          </div>
        </div>
      </section>

      <Card className="border-border shadow-sm bg-card">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث برقم الفاتورة أو البريد..."
                  className="border-border bg-card pr-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="flex h-10 items-center align-center justify-between w-30 rounded-md border border-input bg-background px-3  text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">كل الحالات</option>
                <option value="paid">مدفوعة</option>
                <option value="pending">معلقة</option>
                <option value="failed">فاشلة</option>
              </select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              className="text-primary"
            >
              <RefreshCw className="mr-2 h-4 w-4 " />
              تحديث
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>لا توجد فواتير</p>
            </div>
          ) : (
            <div className="rounded-md border border-border bg-card overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-right text-muted-foreground">
                      رقم الفاتورة
                    </TableHead>
                    <TableHead className="text-right text-muted-foreground">
                      المستخدم
                    </TableHead>
                    <TableHead className="text-right text-muted-foreground">
                      المبلغ
                    </TableHead>
                    <TableHead className="text-right text-muted-foreground">
                      التاريخ
                    </TableHead>
                    <TableHead className="text-right text-muted-foreground">
                      الحالة
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((inv) => (
                    <TableRow
                      key={inv.id}
                      className="border-border transition-colors duration-200 hover:bg-secondary/50"
                    >
                      <TableCell className="font-mono text-xs text-foreground">
                        {inv.id}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">
                            {inv.user_name || "مستخدم"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {inv.user_email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground">
                        {inv.amount
                          ? `${inv.amount / 100} ${inv.currency?.toUpperCase() || "SAR"}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-foreground">
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
