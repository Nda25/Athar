// assets/js/supabase-client.js  (نسخة آمنة عند التكرار)
(function(){
  "use strict";

  // امنعي التحميل المزدوج لنفس الملف
  if (window.__ATHAR_SUPA_LOADED__) return;
  window.__ATHAR_SUPA_LOADED__ = true;

  // ===== إعداد Supabase للمتصفح (نستخدم window.* حتى لا نعيد التصريح) =====
  if (typeof window.SUPABASE_URL === "undefined") {
    window.SUPABASE_URL = "https://oywqpkzaudmzwvytxaop.supabase.co";
  }
  if (typeof window.SUPABASE_ANON_KEY === "undefined") {
    window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95d3Fwa3phdWRtend2eXR4YW9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4OTczMTYsImV4cCI6MjA3MzQ3MzMxNn0.nhjbZMiHPkWvcPnNDeGu3sGSP2TloC0jESZjQ03FnyM";
  }

  // أنشئي عميلًا واحدًا مشتركًا (أو أعيدي استخدام الموجود)
  // التحصين: لو مكتبة supabase ما بعد لود، نخلي supa=null ونحذّر
  const supa = window.supa || (window.supabase ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY) : null);
  if (!supa) {
    console.warn("[Athar][supa] لم يتم تحميل مكتبة Supabase بعد. تأكدي من ترتيب السكربتات:\
\n  1) https://unpkg.com/@supabase/supabase-js@2\
\n  2) assets/js/supabase-client.js");
  }

  // ===== Helpers صغيرة: قراءة مستخدم Auth0 بأمان =====
  const auth0SafeGetUser = async () => {
    try {
      if (window.auth?.getUser) return await window.auth.getUser();
      if (window.auth0Client?.getUser) return await window.auth0Client.getUser();
    } catch(_) {}
    return null;
  };

  /** -------------------------------------------
   * upsert-user عبر Function (service role)
   * body المتوقع: { sub, email, name, picture }
   * ------------------------------------------ */
  async function supaEnsureUserProfile(profile = {}) {
    if (!profile.sub || !profile.email) {
      // نحاول جلبها تلقائيًا من Auth0
      const u = await auth0SafeGetUser();
      if (!u) return { ok:false, error:"no auth0 user" };
      profile = {
        sub: u.sub,
        email: String(u.email||"").toLowerCase(),
        name: u.name || u.nickname || null,
        picture: u.picture || null
      };
    }

    try {
      const res = await fetch('/.netlify/functions/upsert-user', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(profile)
      });
      if (!res.ok) return { ok:false, error: await res.text() };
      const json = await res.json();
      return { ok:true, data: json.user };
    } catch (e) {
      return { ok:false, error: e.message || 'network error' };
    }
  }

  /** -------------------------------------------
   * تسجيل استخدام أداة (log-tool-usage)
   * يمرّر: tool_name + meta (+ نحاول تمرير email وsub للمطابقة)
   * السيرفر سيحوّلها إلى user_sub ويُدخلها في الجدول.
   * ------------------------------------------ */
  async function supaLogToolUsage(toolName, meta = {}) {
    try {
      const u = await auth0SafeGetUser();
      const payload = {
        tool_name:  toolName,
        user_email: u?.email ? String(u.email).toLowerCase() : null,
        user_sub:   u?.sub || null,
        meta
      };
      const res = await fetch('/.netlify/functions/log-tool-usage', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
      });
      // 204 = لا شيء لإرجاعه لكن بدون خطأ (مثلاً لايوجد مستخدم مسجّل)
      if (!res.ok && res.status !== 204) {
        return { ok:false, error: await res.text() };
      }
      return { ok:true, data: res.status===204 ? null : await res.json() };
    } catch (e) {
      return { ok:false, error: e.message };
    }
  }

  // (اختياري) قراءة مستخدم عبر الإيميل إن أضفتِ سياسة قراءة لاحقًا
  async function supaGetUserByEmail(email){
    if (!supa) {
      return { ok:false, error:"supabase client not ready (script order)" };
    }
    const { data, error } = await supa
      .from('users')
      .select('*')
      .eq('email', String(email).toLowerCase())
      .single();
    return { ok: !error, data, error };
  }

  // ===== تعريض الدوال عالميًا مرة واحدة =====
  window.supaEnsureUserProfile = window.supaEnsureUserProfile || supaEnsureUserProfile;
  window.supaLogToolUsage     = window.supaLogToolUsage     || supaLogToolUsage;
  window.supaGetUserByEmail   = window.supaGetUserByEmail   || supaGetUserByEmail;
  window.supa                 = supa;
})();
