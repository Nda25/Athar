
// إعداد Supabase (مفتاح anon مخصص للمتصفح)
const SUPABASE_URL = "https://oywqpkzaudmzwvytxaop.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95d3Fwa3phdWRtend2eXR4YW9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4OTczMTYsImV4cCI6MjA3MzQ3MzMxNn0.nhjbZMiHPkWvcPnNDeGu3sGSP2TloC0jESZjQ03FnyM";

// عميل Supabase للعميل (Frontend)
// (مع RLS المشدد لن تُسمح قراءات/كتابات إلا عبر دوال الخادم)
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** -------------------------------------------
 * upsert-user (Frontend helper)
 * يستدعي دالة Netlify لكتابة/تحديث المستخدم في جدول users
 * عبر service_role (على الخادم)
 * ------------------------------------------ */
async function supaEnsureUser(u = {}) {
  if (!u.email) return { ok:false, error: "missing email" };

  try {
    const res = await fetch('/.netlify/functions/upsert-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // عدلي الحقول هنا حسب ما تقبله الدالة الخادمية upsert-user
      body: JSON.stringify({
        email: String(u.email).toLowerCase(),
        full_name: u.full_name || null,
        picture: u.picture || null,
        plan: u.plan || null
      })
    });

    if (!res.ok) {
      const msg = await res.text();
      return { ok:false, error: msg || 'server error' };
    }
    const json = await res.json();
    return { ok:true, data: json.user || json };
  } catch (e) {
    return { ok:false, error: e.message || 'network error' };
  }
}

/** -------------------------------------------
 * يقرأ مستخدم Auth0 ويعمل upsert في Supabase (بالبريد)
 * تناديها بعد auth0:ready
 * ------------------------------------------ */
async function supaEnsureUserFromAuth0() {
  try {
    const u = await window.auth?.getUser();
    if (!u || !u.email) return { ok:false, error:'no auth0 email' };

    return await supaEnsureUser({
      email: String(u.email).toLowerCase(),
      full_name: u.name || u.nickname || null,
      picture: u.picture || null
    });
  } catch (e) {
    return { ok:false, error: e.message };
  }
}

/** -------------------------------------------
 * تسجيل استخدام أداة (يعتمد على البريد)
 * يستدعي Netlify Function: /.netlify/functions/log-tool-usage
 * المتوقّع في الخادم: { tool_name, user_email, meta }
 * الخادم ممكن يرجّع 204 لو ما فيه مستخدم مسجل الدخول.
 * ------------------------------------------ */
async function supaLogToolUsage(toolName, meta = {}) {
  try {
    // نحاول جلب الإيميل من Auth0
    let user_email = null;
    try {
      const u = await window.auth?.getUser();
      user_email = u?.email ? String(u.email).toLowerCase() : null;
    } catch (_) {}

    const res = await fetch('/.netlify/functions/log-tool-usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool_name: toolName,
        user_email,        // ← المفتاح هنا صار بالإيميل
        meta: meta || {}
      })
    });

    if (!res.ok && res.status !== 204) {
      // 204 = لا يوجد مستخدم (نتجاهل بهدوء)
      return { ok:false, error: await res.text() };
    }
    return { ok:true, data: (res.status === 204 ? null : await res.json()) };
  } catch (e) {
    return { ok:false, error: e.message };
  }
}

/** -------------------------------------------
 * (اختياري) قراءة المستخدم من جدول users عبر الإيميل
 * ستنجح فقط إذا لديك سياسة READ مناسبة في RLS
 * أو لو تنفذينها من دالة خادمية.
 * ------------------------------------------ */
async function supaGetUserByEmail(email){
  const { data, error } = await supa
    .from("users")
    .select("*")
    .eq("email", String(email).toLowerCase())
    .single();
  return { ok: !error, data, error };
}
