// (اختياري) تبقين العميل لو احتجتي قراءات مستقبلاً.
// مع RLS المشدد، القراءات من المتصفح بتتفشل إلا إذا سويتي سياسات قراءة.
const SUPABASE_URL = "https://oywqpkzaudmzwvytxaop.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95d3Fwa3phdWRtend2eXR4YW9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4OTczMTYsImV4cCI6MjA3MzQ3MzMxNn0.nhjbZMiHPkWvcPnNDeGu3sGSP2TloC0jESZjQ03FnyM";

// تقدرِين تحذفين السطرين هذولا إذا ما تحتاجين قراءات client-side
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * حفظ/تحديث المستخدم — عبر الدالة الخادمية (Netlify Function)
 * ما عاد نكتب مباشرة من المتصفح بسبب RLS المشدد.
 */
async function supaEnsureUser(u = {}) {
  if (!u.email) return { ok:false, error: "missing email" };

  try {
    const res = await fetch('/.netlify/functions/upsert-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: String(u.email).toLowerCase(),
        full_name: u.full_name || null,
        plan: u.subscription_type || null // لو حابة تمريّرين خطة الاشتراك
      })
      // لو تبين تحقق JWT في الخادم:
      // headers: {
      //   'Content-Type': 'application/json',
      //   'Authorization': `Bearer ${await auth0Client.getTokenSilently()}`
      // }
    });

    if (!res.ok) {
      const msg = await res.text();
      return { ok:false, error: msg || 'server error' };
    }
    const json = await res.json();
    return { ok:true, data: json.user };
  } catch (e) {
    return { ok:false, error: e.message || 'network error' };
  }
}

/**
 * تسجيل استخدام أداة — خليه أيضاً عبر خادم (مستقبلاً)
 * مؤقتاً نخليه يرسل للخادم (لا يكتب مباشرة).
 */
async function supaLogToolUsage(toolName, meta = {}, user_email) {
  try {
    const res = await fetch('/.netlify/functions/log-tool-usage', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        tool_name: toolName,
        user_email: user_email || null,
        meta
      })
    });
    if (!res.ok) return { ok:false, error: await res.text() };
    return { ok:true, data: await res.json() };
  } catch (e) {
    return { ok:false, error: e.message };
  }
}

/**
 * قراءة بروفايل المستخدم — تنجح فقط إذا عندك سياسة READ مناسبة.
 * مع RLS “المشدّد بدون سياسات قراءة”، هذي بتفشل.
 * إما تضيفين سياسة READ محدودة، أو تسوين دالة خادمية read-user.
 */
async function supaGetUserByEmail(email){
  const { data, error } = await supa
    .from("users")
    .select("*")
    .eq("email", email)
    .single();
  return { ok: !error, data, error };
}
