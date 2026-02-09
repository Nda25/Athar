import { useState, useEffect } from "react";
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

  const filteredInvoices = invoices.filter(
    (inv) =>
      inv.id?.toLowerCase().includes(search.toLowerCase()) ||
      inv.user_email?.toLowerCase().includes(search.toLowerCase()),
  );

  const getStatusBadge = (status) => {
    if (status === "paid" || status === "succeeded") {
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-200">
          <CheckCircle className="w-3 h-3 mr-1" /> مدفوع
        </Badge>
      );
    }
    if (status === "pending") {
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200">
          <Clock className="w-3 h-3 mr-1" /> معلق
        </Badge>
      );
    }
    if (status === "failed" || status === "canceled") {
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-200">
          <XCircle className="w-3 h-3 mr-1" /> فشل
        </Badge>
      );
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            الفواتير والطلبات
          </h2>
          <p className="text-muted-foreground mt-2">
            سجل العمليات المالية والاشتراكات.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex gap-4 justify-between items-center">
            <div className="relative w-72">
              <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث برقم الفاتورة أو البريد..."
                className="pr-8"
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
            <div className="rounded-md border">
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
                          <span className="text-sm font-medium">
                            {inv.user_name || "مستخدم"}
                          </span>
                          <span className="text-xs text-muted-foreground">
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
