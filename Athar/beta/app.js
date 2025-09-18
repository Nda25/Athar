

// (اختياري) تبقين العميل لو احتجتي قراءات مستقبلاً.

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
