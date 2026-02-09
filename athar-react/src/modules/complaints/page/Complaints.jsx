import { Layout } from "@modules/layout";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquare, Send, Loader2, LogIn } from "lucide-react";
import { useAuth } from "@modules/auth";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Textarea } from "@shared/ui/textarea";
import { Badge } from "@shared/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/ui/select";
import {
  createComplaint,
  getComplaintMessages,
  getUserComplaints,
  replyToComplaint,
} from "../api";

function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.complaints)) return value.complaints;
  return [];
}

function normalizeMessages(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.messages)) return value.messages;
  if (Array.isArray(value?.rows)) return value.rows;
  return [];
}

export default function ComplaintsPage() {
  const queryClient = useQueryClient();
  const { isAuthenticated, user, loginWithRedirect } = useAuth();
  const [selectedId, setSelectedId] = useState("");
  const [reply, setReply] = useState("");
  const [form, setForm] = useState({
    type: "complaint",
    subject: "",
    name: "",
    email: "",
    message: "",
    order_number: "",
  });

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      name: prev.name || user.name || "",
      email: prev.email || user.email || "",
    }));
  }, [user]);

  const complaintsQuery = useQuery({
    queryKey: ["user-complaints", user?.email],
    queryFn: () => getUserComplaints(user?.email?.toLowerCase()),
    enabled: isAuthenticated,
  });

  const complaints = useMemo(
    () => normalizeList(complaintsQuery.data),
    [complaintsQuery.data],
  );

  useEffect(() => {
    if (!complaints.length) {
      setSelectedId("");
      return;
    }
    if (!selectedId) {
      setSelectedId(complaints[0].id);
    }
  }, [complaints, selectedId]);

  const selectedComplaint = useMemo(
    () => complaints.find((item) => item.id === selectedId),
    [complaints, selectedId],
  );

  const messagesQuery = useQuery({
    queryKey: ["complaint-messages", selectedId, user?.email],
    queryFn: () =>
      getComplaintMessages(selectedId, user?.email?.toLowerCase()),
    enabled: Boolean(selectedId && isAuthenticated),
  });

  const messages = useMemo(
    () => normalizeMessages(messagesQuery.data),
    [messagesQuery.data],
  );

  const createMutation = useMutation({
    mutationFn: createComplaint,
    onSuccess: () => {
      toast.success("تم إرسال الرسالة بنجاح");
      setForm((prev) => ({
        ...prev,
        subject: "",
        message: "",
        order_number: "",
      }));
      queryClient.invalidateQueries({ queryKey: ["user-complaints"] });
    },
    onError: (error) => {
      toast.error("تعذر إرسال الرسالة", {
        description: error.message || "حاول مرة أخرى.",
      });
    },
  });

  const replyMutation = useMutation({
    mutationFn: replyToComplaint,
    onSuccess: () => {
      toast.success("تم إرسال الرد");
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["complaint-messages", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["user-complaints"] });
    },
    onError: (error) => {
      toast.error("تعذر إرسال الرد", {
        description: error.message || "حاول مرة أخرى.",
      });
    },
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.subject.trim() || !form.message.trim() || !form.email.trim()) {
      toast.error("الرجاء تعبئة الحقول المطلوبة");
      return;
    }

    createMutation.mutate({
      ...form,
      subject: form.subject.trim(),
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      message: form.message.trim(),
      order_number: form.order_number.trim() || null,
    });
  };

  const handleReply = () => {
    if (!selectedId || !reply.trim()) return;
    replyMutation.mutate({
      complaint_id: selectedId,
      message: reply.trim(),
      user_email: user?.email?.toLowerCase(),
    });
  };

  const promptLogin = () => {
    loginWithRedirect({ appState: { returnTo: "/complaints" } });
  };

  const statusText = {
    new: "جديدة",
    in_progress: "قيد المعالجة",
    resolved: "مغلقة",
    rejected: "مرفوضة",
  };

  const statusTone = {
    new: "bg-blue-100 text-blue-700",
    in_progress: "bg-amber-100 text-amber-700",
    resolved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-rose-100 text-rose-700",
  };

  return (
    <Layout>
      <section className="container mx-auto px-4 pt-28 pb-16 space-y-8">
        <div className="max-w-3xl space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold">الشكاوى والاقتراحات</h1>
          <p className="text-muted-foreground">
            شاركنا ملاحظاتك وسنتابع الطلب حتى الإغلاق.
          </p>
        </div>

        {!isAuthenticated ? (
          <Card>
            <CardContent className="pt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <p className="text-muted-foreground">
                لتتمكن من متابعة رسائلك والرد عليها، سجّل الدخول أولًا.
              </p>
              <Button onClick={promptLogin}>
                <LogIn className="ml-2 h-4 w-4" />
                تسجيل الدخول
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>أرسل رسالة</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>نوع المراسلة</Label>
                    <Select
                      value={form.type}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="complaint">شكوى</SelectItem>
                        <SelectItem value="suggestion">اقتراح</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>العنوان</Label>
                    <Input
                      value={form.subject}
                      onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                      placeholder="اكتب عنوانًا مختصرًا"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>الاسم</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="اسمك"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>البريد الإلكتروني</Label>
                    <Input
                      value={form.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="example@email.com"
                      type="email"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>الرسالة</Label>
                  <Textarea
                    value={form.message}
                    onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                    rows={6}
                    placeholder="اكتب التفاصيل هنا..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>رقم الطلب (اختياري)</Label>
                  <Input
                    value={form.order_number}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, order_number: e.target.value }))
                    }
                    placeholder="إن وجد"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full md:w-auto"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جار الإرسال...
                    </>
                  ) : (
                    "إرسال"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>رسائلي</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isAuthenticated ? (
                <p className="text-sm text-muted-foreground">
                  بعد تسجيل الدخول ستظهر هنا جميع الشكاوى والمقترحات الخاصة بك.
                </p>
              ) : complaintsQuery.isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> جار التحميل...
                </div>
              ) : complaints.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد رسائل بعد.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-auto">
                  {complaints.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`w-full text-right border rounded-lg p-3 transition ${
                        selectedId === item.id ? "border-brand bg-brand/5" : "hover:bg-muted/40"
                      }`}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium truncate">{item.subject || "بدون عنوان"}</p>
                        <Badge className={statusTone[item.status] || "bg-slate-100 text-slate-700"}>
                          {statusText[item.status] || item.status || "جديدة"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {item.type === "suggestion" ? "اقتراح" : "شكوى"}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {isAuthenticated && selectedComplaint ? (
                <div className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MessageSquare className="h-4 w-4" />
                    المحادثة
                  </div>

                  <div className="space-y-2 max-h-56 overflow-auto">
                    {messagesQuery.isLoading ? (
                      <div className="text-sm text-muted-foreground">جاري تحميل الرسائل...</div>
                    ) : messages.length === 0 ? (
                      <div className="text-sm text-muted-foreground">لا توجد ردود حتى الآن.</div>
                    ) : (
                      messages.map((msg) => (
                        <div
                          key={msg.id || `${msg.created_at}-${msg.body}`}
                          className={`rounded-lg p-2 text-sm ${
                            msg.sender === "admin" ? "bg-blue-50" : "bg-muted/50"
                          }`}
                        >
                          <p className="mb-1 text-xs text-muted-foreground">
                            {msg.sender === "admin" ? "فريق الدعم" : "أنت"}
                          </p>
                          <p className="whitespace-pre-wrap">{msg.body}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="أضف ردًا..."
                      rows={3}
                    />
                    <Button
                      onClick={handleReply}
                      disabled={replyMutation.isPending || !reply.trim()}
                    >
                      {replyMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </section>
    </Layout>
  );
}
