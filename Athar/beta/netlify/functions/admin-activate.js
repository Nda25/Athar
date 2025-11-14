// /netlify/functions/admin-activate.js
const { createClient } = require("@supabase/supabase-js");
const { requireAdmin } = require("./_auth.js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // بوابة الأدمن (JWT من Auth0)
  const gate = await requireAdmin(event);
  if (!gate.ok) return { statusCode: gate.status, body: gate.error };

  try {
    const body = JSON.parse(event.body || "{}");

    const email = (body.email || "").trim().toLowerCase() || null; // اختياري
    const user_id = (body.user_id || "").trim() || null; // اختياري
    const amount = Math.max(1, parseInt(body.amount || 1, 10)); // عدد الوحدات
    const unit = body.unit || "months"; // days | months | years
    const note = body.note || null;

    if (!email && !user_id) {
      return { statusCode: 400, body: "email or user_id is required" };
    }
    if (!["days", "months", "years"].includes(unit)) {
      return {
        statusCode: 400,
        body: "invalid unit (allowed: days|months|years)",
      };
    }

    // --- [بداية التعديل لحل المشكلة] ---
    // اشتراك حالي
    let q = supabase
      .from("memberships")
      .select("id, expires_at, email, user_id, note") // تأكدنا من جلب note
      .limit(1);

    //

    // الحل: نبني فلتر يبحث بـ OR (أو)
    // يعني: لو الـ user_id متطابق هاته، ولو الـ email متطابق هاته
    const orFilter = [];
    if (user_id) orFilter.push(`user_id.eq.${user_id}`);
    if (email) orFilter.push(`email.eq.${email}`);

    // تطبيق البحث المزدوج
    q = q.or(orFilter.join(","));

    /* الكود القديم اللي كان بيعمل المشكلة:
       if (user_id) q = q.eq("user_id", user_id);
       else q = q.eq("email", email);
    */

    const { data: existingRow, error: selErr } = await q.maybeSingle();
    if (selErr) throw selErr;
    // --- [نهاية التعديل] ---

    // قاعدة التمديد
    const now = new Date();
    let base = now;
    if (existingRow?.expires_at) {
      const cur = new Date(existingRow.expires_at);
      if (cur > now) base = cur;
    }

    // أضف المدة
    const expires = new Date(base);
    if (unit === "days") expires.setDate(expires.getDate() + amount);
    if (unit === "months") expires.setMonth(expires.getMonth() + amount);
    if (unit === "years") expires.setFullYear(expires.getFullYear() + amount);

    // ===== التجهيز للحفظ =====

    const nowIso = new Date().toISOString();
    const endIso = expires.toISOString(); // نهاية الاشتراك المحسوبة

    let data, error;

    if (existingRow) {
      // ---- 1. المستخدم موجود: قم بعمل UPDATE ----
      const updatePayload = {
        plan: "free",
        status: "active",
        // (لا نغير start_at عند التجديد)
        end_at: endIso,
        expires_at: endIso,
        note: note || existingRow.note, // الاحتفاظ بالملاحظة القديمة إذا لم يتم إدخال ملاحظة جديدة
        updated_at: nowIso,
        // التأكد من وجود email و user_id إذا كانت ناقصة
        email: existingRow.email || email,
        user_id: existingRow.user_id || user_id,
      };

      const { data: updateData, error: updateError } = await supabase
        .from("memberships")
        .update(updatePayload)
        .eq("id", existingRow.id) // نستخدم الـ ID لضمان تحديث الصف الصحيح
        .select()
        .single();

      data = updateData;
      error = updateError;
    } else {
      // ---- 2. المستخدم جديد: قم بعمل INSERT ----
      const insertPayload = {
        email: email, // من المدخلات
        user_id: user_id, // من المدخلات
        plan: "free",
        status: "active",
        start_at: nowIso, // يبدأ الآن لأنه اشتراك جديد
        end_at: endIso,
        expires_at: endIso,
        note: note,
        tenant_id: gate.org_id || null,
        updated_at: nowIso, // (updated_at هو نفسه created_at هنا)
      };

      const { data: insertData, error: insertError } = await supabase
        .from("memberships")
        .insert(insertPayload)
        .select()
        .single();

      data = insertData;
      error = insertError;
    }

    // تحقق من خطأ الـ INSERT أو UPDATE
    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, expires_at: data.expires_at }),
    };
  } catch (e) {
    console.error("admin-activate error:", e);
    // إرجاع رسالة الخطأ الحقيقية من قاعدة البيانات إذا كانت موجودة
    const errorMessage = e.message || String(e);
    return { statusCode: 500, body: errorMessage };
  }
};
