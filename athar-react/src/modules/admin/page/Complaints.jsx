import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  MessageSquare,
  Search,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Loader2,
  Mail,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";

import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Textarea } from "@shared/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/ui/select";
import { Badge } from "@shared/ui/badge";
import { ScrollArea } from "@shared/ui/scroll-area";
import {
  filterComplaints,
  getAdminComplaintDetails,
  adminReplyToComplaint,
} from "@shared/api";

export default function Complaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [nextStatus, setNextStatus] = useState("");

  const [filters, setFilters] = useState({
    q: "",
    type: "",
    status: "",
  });

  const loadComplaints = async () => {
    setLoading(true);
    try {
      const data = await filterComplaints(filters);
      setComplaints(data.rows || []);
      // If we have selected one that is no longer in the list (rare but possible), clear selection?
      // Or keep it.
    } catch (error) {
      console.error(error);
      toast.error("فشل تحميل الشكاوى");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce search? For now simple effect
    const timer = setTimeout(loadComplaints, 500);
    return () => clearTimeout(timer);
  }, [filters]);

  const handleSelectComplaint = async (c) => {
    setSelectedComplaint(c);
    setDetailsLoading(true);
    setMessages([]); // clear previous
    try {
      const data = await getAdminComplaintDetails(c.id);
      setSelectedComplaint(data.complaint); // Update with full details if any
      setMessages(data.messages || []);
      // Reset reply form
      setReplyText("");
      setNextStatus("");
    } catch (error) {
      toast.error("فشل تحميل التفاصيل");
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) return;

    setSending(true);
    try {
      await adminReplyToComplaint({
        complaint_id: selectedComplaint.id,
        message: replyText,
        next_status: nextStatus || undefined,
      });

      toast.success("تم إرسال الرد");

      // Refresh details to show new message
      const data = await getAdminComplaintDetails(selectedComplaint.id);
      setMessages(data.messages || []);
      setReplyText("");

      // Refresh list if status changed
      if (nextStatus) {
        loadComplaints();
        // Update local state for immediate feedback
        setSelectedComplaint((prev) => ({ ...prev, status: nextStatus }));
      }
    } catch (error) {
      toast.error("فشل إرسال الرد");
    } finally {
      setSending(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      new: "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
      in_progress:
        "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
      resolved:
        "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300",
      rejected:
        "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300",
    };
    const labels = {
      new: "جديدة",
      in_progress: "قيد المعالجة",
      resolved: "مغلقة",
      rejected: "مرفوضة",
    };
    return (
      <Badge className={styles[status] || "bg-slate-100 text-slate-700"}>
        {labels[status] || status}
      </Badge>
    );
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          الشكاوى والمقترحات
        </h2>
        <p className="mt-2 text-slate-700 dark:text-slate-300">
          متابعة تذاكر الدعم الفني ورسائل المستخدمين.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* List Section */}
        <Card className="flex min-w-[320px] flex-col border-slate-200 dark:border-slate-700 dark:bg-slate-900 lg:w-1/3">
          <CardHeader className="space-y-3 border-b border-slate-200 p-4 dark:border-slate-700">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث..."
                    className="pr-8 dark:border-slate-700 dark:bg-slate-800"
                  value={filters.q}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, q: e.target.value }))
                  }
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={loadComplaints}
                title="تحديث"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex gap-2">
              <Select
                value={filters.status}
                onValueChange={(val) =>
                  setFilters((prev) => ({ ...prev, status: val }))
                }
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="كل الحالات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_statuses">كل الحالات</SelectItem>{" "}
                  {/* Special value to clear? Or just empty string logic handled in handler */}
                  <SelectItem value="new">جديدة</SelectItem>
                  <SelectItem value="in_progress">قيد المعالجة</SelectItem>
                  <SelectItem value="resolved">مغلقة</SelectItem>
                  <SelectItem value="rejected">مرفوضة</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.type}
                onValueChange={(val) =>
                  setFilters((prev) => ({ ...prev, type: val }))
                }
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="النوع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_types">الكل</SelectItem>
                  <SelectItem value="complaint">شكوى</SelectItem>
                  <SelectItem value="suggestion">اقتراح</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 min-h-0">
            <ScrollArea className="h-full">
              {loading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="animate-spin text-slate-400" />
                </div>
              ) : complaints.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  لا توجد شكاوى مطابقة
                </div>
              ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {complaints.map((c) => (
                      <div
                        key={c.id}
                        className={`cursor-pointer p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${selectedComplaint?.id === c.id ? "bg-blue-100 dark:bg-blue-900/30" : ""}`}
                        onClick={() => handleSelectComplaint(c)}
                      >
                      <div className="flex justify-between items-start mb-1">
                          <h4 className="line-clamp-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {c.subject}
                          </h4>
                        <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                          {format(new Date(c.created_at), "dd/MM/yy", {
                            locale: arSA,
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                          <User className="h-3 w-3" /> {c.user_name || "مجهول"}
                        </span>
                        {getStatusBadge(c.status)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-[10px] h-5 font-normal"
                        >
                          {c.type === "complaint" ? "شكوى" : "اقتراح"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Detail Section */}
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-slate-200 dark:border-slate-700 dark:bg-slate-900">
          {!selectedComplaint ? (
            <div className="flex flex-1 flex-col items-center justify-center bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
              <p>اختر شكوى لعرض التفاصيل</p>
            </div>
          ) : (
            <>
              <CardHeader className="border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">
                        {selectedComplaint.type === "complaint"
                          ? "شكوى"
                          : "اقتراح"}
                      </Badge>
                      <span className="text-xs text-slate-600 dark:text-slate-400">
                        {format(
                          new Date(selectedComplaint.created_at),
                          "PPP p",
                          { locale: arSA },
                        )}
                      </span>
                    </div>
                    <CardTitle className="text-xl text-slate-900 dark:text-slate-100">
                      {selectedComplaint.subject}
                    </CardTitle>
                  </div>
                  {getStatusBadge(selectedComplaint.status)}
                </div>
                <div className="mt-2 flex items-center gap-4 text-sm text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <User className="h-4 w-4" />
                    <span>{selectedComplaint.user_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-4 w-4" />
                    <span className="font-mono text-xs">
                      {selectedComplaint.user_email}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col gap-4 p-0 min-h-0">
                {/* Messages Area */}
                <ScrollArea className="flex-1 bg-slate-50 p-4 dark:bg-slate-800">
                  {detailsLoading ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="animate-spin text-slate-400" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Original Message (Implicitly usually the first message or body of complaint in some systems, 
                               but here standard seems to be messages list. If message list is empty, show nothing?) 
                           */}
                      {messages.length === 0 && (
                        <div className="p-4 rounded-lg bg-white border shadow-sm text-sm">
                          <p className="whitespace-pre-wrap">
                            {/* Original body if available separate from messages? */}
                          </p>
                          {/* If admin.js logic implies messages contains everything including user first msg */}
                        </div>
                      )}

                      {messages.map((msg) => (
                        <div
                          key={msg.id || msg.created_at}
                          className={`flex flex-col max-w-[85%] rounded-lg p-3 text-sm ${
                            msg.sender === "admin"
                              ? "ml-auto self-end border border-blue-200 bg-blue-100 dark:border-blue-800 dark:bg-blue-900/30"
                              : "self-start border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
                          }`}
                        >
                          <div className="flex justify-between items-center gap-4 mb-2 opacity-70 text-xs">
                            <span className="font-semibold">
                              {msg.sender === "admin" ? "فريق الدعم" : "العميل"}
                            </span>
                            <span>
                              {format(new Date(msg.created_at), "p", {
                                locale: arSA,
                              })}
                            </span>
                          </div>
                          <div className="whitespace-pre-wrap leading-relaxed">
                            {msg.body}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                {/* Reply Area */}
                <div className="border-t border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <div className="mb-3">
                    <Label className="text-xs text-muted-foreground mb-1 block">
                      تغيير الحالة (اختياري)
                    </Label>
                    <Select value={nextStatus} onValueChange={setNextStatus}>
                      <SelectTrigger className="w-[180px] h-8 text-xs">
                        <SelectValue placeholder="تغيير الحالة..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in_progress">
                          قيد المعالجة
                        </SelectItem>
                        <SelectItem value="resolved">مغلقة</SelectItem>
                        <SelectItem value="rejected">مرفوضة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="اكتب ردك هنا..."
                      className="min-h-[80px] resize-none"
                    />
                  </div>
                  <div className="flex justify-end mt-2">
                    <Button
                      onClick={handleSendReply}
                      disabled={sending || !replyText.trim()}
                    >
                      {sending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      إرسال الرد
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
