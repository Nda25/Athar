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

  // ✅ السطر المطلوب موجود صراحة — إن أردتِ نسخه حرفيًا:
  // window.supa = supabase.createClient("https://oywqpkzaudmzwvytxaop.supabase.co","ANON_PUBLIC_KEY");

  // جهّزيه عالميًا
  window.supa = supa;

  if (!supa) {
    console.warn("[Athar][supa] لم يتم تحميل مكتبة Supabase بعد. تأكدي من ترتيب السكربتات:\n  1) https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2\n  2) assets/js/supabase-client.js");
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
 * إضافة موعد (miyad-add-event)
 * يمرّر: بيانات الموعد + (نحاول تمرير user_sub للمطابقة)
 * السيرفر سيحوّلها إلى user_id ويُدخلها في الجدول.
 * ------------------------------------------ */
async function supaAddMiyadEvent(eventData = {}) {
  try {
    const u = await auth0SafeGetUser(); // بنجيب اليوزر زي كل مرة

    // لو مفيش مستخدم مسجل دخول، هنوقف بهدوء
    // (الموعد اتحفظ محلياً وده كفاية مؤقتاً)
    if (!u || !u.sub) {
      console.debug('No auth user, skipping Supabase event sync.');
      return { ok: true, data: null };
    }

    const payload = {
      user_sub: u.sub, // الـ Function محتاجة تعرف مين اليوزر
      event_data: eventData // كل بيانات الموعد (المادة، الفصل.. الخ)
    };

    // هننده الـ Function الجديدة (اللي هنعملها في الخطوة 3)
    const res = await fetch('/.netlify/functions/add-miyad-event', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });

    // تعامل مع الأخطاء
    if (!res.ok && res.status !== 204) {
      return { ok:false, error: await res.text() };
    }
    return { ok:true, data: res.status===204 ? null : await res.json() };
  } catch (e) {
    return { ok:false, error: e.message };
  }
}


/** -------------------------------------------
 * حفظ إعدادات التذكير (save-reminder-settings)
 * يمرّر: الـ payload كاملًا (user_id, email, settings)
 * السيرفر سيتولى عملية الـ upsert
 * ------------------------------------------ */
async function supaSaveReminderSettings(settingsPayload = {}) {
  // الـ payload اللي جاي من index.html فيه كل حاجة (user_id, email)
  // فمش محتاجين نجيب اليوزر هنا تاني
  if (!settingsPayload.user_id) {
    console.warn('supaSaveReminderSettings: No user_id in payload.');
    return { ok: false, error: 'No user_id provided' };
  }

  try {
    // هننده الـ Function الجديدة (اللي هنعملها في الخطوة 3)
    const res = await fetch('/.netlify/functions/save-reminder-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settingsPayload) // ابعت الـ payload زي ما هو
    });

    if (!res.ok) {
      return { ok: false, error: await res.text() };
    }
    
    // رجع 'ok' عشان الدالة الأصلية تكمل شغلها (تعرض "تم الحفظ")
    return { ok: true, data: await res.json() };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/** -------------------------------------------
 * جلب إعدادات التذكير (get-reminder-settings)
 * يكلم الـ Function عشان تجيب إعدادات المستخدم ده
 * ------------------------------------------ */
async function supaGetReminderSettings() {
  const u = await auth0SafeGetUser(); // بنجيب اليوزر
  if (!u || !u.sub) {
    return { ok: false, data: null, error: 'No authenticated user' };
  }

  try {
    // هننده الـ Function الجديدة (اللي هنعملها في الخطوة 3)
    // هنستخدم POST عشان نبعت الـ user_sub في الـ body زي الباقي
    const res = await fetch('/.netlify/functions/get-reminder-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_sub: u.sub })
    });

    if (!res.ok) {
      return { ok: false, data: null, error: await res.text() };
    }
    
    // هترجع الداتا (أو null لو مفيش إعدادات)
    const data = await res.json();
    return { ok: true, data: data, error: null };
  } catch (e) {
    return { ok: false, data: null, error: e.message };
  }
}

/** -------------------------------------------
 * حذف موعد (delete-miyad-event)
 * يبعت الـ ID للـ Function عشان تمسحه
 * ------------------------------------------ */
async function supaDeleteMiyadEvent(eventId) {
  const u = await auth0SafeGetUser(); // بنجيب اليوزر عشان الأمان
  if (!u || !u.sub) {
    console.debug('No auth user, skipping Supabase event delete.');
    return { ok: true, data: null };
  }

  try {
    const payload = {
      user_sub: u.sub, // عشان نتأكد إنه بيمسح حاجته هو بس
      event_id: eventId
    };

    // هننده الـ Function الجديدة (اللي هنعملها في الخطوة 5)
    const res = await fetch('/.netlify/functions/delete-miyad-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) { return { ok: false, error: await res.text() }; }
    return { ok: true, data: await res.json() };
  } catch (e) {
    return { ok: false, error: e.message };
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
  window.supaAddMiyadEvent   = window.supaAddMiyadEvent   || supaAddMiyadEvent;
  window.supaSaveReminderSettings = window.supaSaveReminderSettings || supaSaveReminderSettings;
  window.supaGetReminderSettings = window.supaGetReminderSettings || supaGetReminderSettings;
  window.supaDeleteMiyadEvent = window.supaDeleteMiyadEvent || supaDeleteMiyadEvent;
})();
