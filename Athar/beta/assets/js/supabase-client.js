// assets/js/supabase-client.js
(() => {
  // 1) ثوابت الاتصال — لا تعاد إذا كانت معرّفة مسبقًا
  window.SUPABASE_URL      = window.SUPABASE_URL      || "https://oywqpkzaudmzwvytxaop.supabase.co";
  window.SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95d3Fwa3phdWRtend2eXR4YW9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4OTczMTYsImV4cCI6MjA3MzQ3MzMxNn0.nhjbZMiHPkWvcPnNDeGu3sGSP2TloC0jESZjQ03FnyM";

  // 2) تأكد أن SDK الأساسي محمّل
  if (typeof window.supabase === "undefined") {
    console.error("[Supabase] SDK not loaded (check CDN script in index.html).");
    return;
  }

  // 3) أنشئ عميل واحد فقط
  window.sb = window.sb || window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY
  );

  // 4) دوال المساعدة — تُعرّف مرة واحدة فقط

  // حفظ/تحديث المستخدم عبر Netlify Function
  window.supaEnsureUser = window.supaEnsureUser || (async (u = {}) => {
    if (!u.email) return { ok: false, error: "missing email" };
    try {
      const res = await fetch('/.netlify/functions/upsert-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: String(u.email).toLowerCase(),
          full_name: u.full_name || null,
          plan: u.subscription_type || null
        })
        // إن رغبتِ بالتحقق بواسطة JWT من Auth0 لاحقًا:
        // headers: {
        //   'Content-Type': 'application/json',
        //   'Authorization': `Bearer ${await auth0Client.getTokenSilently()}`
        // }
      });
      if (!res.ok) {
        const msg = await res.text();
        return { ok: false, error: msg || 'server error' };
      }
      const json = await res.json();
      return { ok: true, data: json.user };
    } catch (e) {
      return { ok: false, error: e.message || 'network error' };
    }
  });

  // تسجيل استخدام أداة عبر Netlify Function
  window.supaLogToolUsage = window.supaLogToolUsage || (async (toolName, meta = {}, user_email) => {
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
  });

  // قراءة بروفايل المستخدم (ستنجح فقط إن وُجدت سياسة READ مناسبة)
  window.supaGetUserByEmail = window.supaGetUserByEmail || (async (email) => {
    const { data, error } = await window.sb
      .from("users")
      .select("*")
      .eq("email", email)
      .single();
    return { ok: !error, data, error };
  });
})();
