// assets/js/supabase-client.js

// بيانات مشروعك (آمنة للنشر في المتصفح)
const SUPABASE_URL = "https://oywqpkzaudmzwvytxaop.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95d3Fwa3phdWRtend2eXR4YW9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4OTczMTYsImV4cCI6MjA3MzQ3MzMxNn0.nhjbZMiHPkWvcPnNDeGu3sGSP2TloC0jESZjQ03FnyM";

// إنشاء العميل
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * حفظ/تحديث سجل المستخدم (مرّة عند تسجيل الدخول)
 * @param {Object} u - { email, full_name, role, subscription_type }
 */
async function supaEnsureUser(u = {}) {
  if (!u.email) return { ok:false, error: "missing email" };

  // UPSERT على جدول users (بالإيميل كمفتاح فريد)
  const { data, error } = await supa
    .from("users")
    .upsert(
      {
        email: u.email,
        full_name: u.full_name || null,
        role: u.role || "user",
        subscription_type: u.subscription_type || null,
        last_login: new Date().toISOString()
      },
      { onConflict: "email" } // لازم يكون عندك UNIQUE(email)
    )
    .select()
    .single();

  return { ok: !error, data, error };
}

/**
 * تسجيل استخدام أداة (للاحصائيات)
 * @param {string} toolName - اسم الأداة (مثال: 'masar' أو 'ethraa')
 * @param {Object} meta - بيانات إضافية اختيارية
 * @param {string} user_email - الإيميل (إن كان معك من Auth0)
 */
async function supaLogToolUsage(toolName, meta = {}, user_email) {
  if (!toolName) return { ok:false, error:"missing tool name" };

  const payload = {
    tool_name: toolName,
    used_at: new Date().toISOString(),
    meta
  };

  // إن معك الإيميل مرّريه
  if (user_email) payload.user_email = user_email;

  const { data, error } = await supa
    .from("tool_usage")
    .insert(payload)
    .select()
    .single();

  return { ok: !error, data, error };
}

/**
 * قراءة بروفايل المستخدم من users
 * @param {string} email
 */
async function supaGetUserByEmail(email){
  if (!email) return { ok:false, error: "missing email" };
  const { data, error } = await supa
    .from("users")
    .select("*")
    .eq("email", email)
    .single();
  return { ok: !error, data, error };
}
