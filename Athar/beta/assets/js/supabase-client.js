// assets/js/supabase-client.js
const SUPABASE_URL = "https://oywqpkzaudmzwvytxaop.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95d3Fwa3phdWRtend2eXR4YW9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4OTczMTYsImV4cCI6MjA3MzQ3MzMxNn0.nhjbZMiHPkWvcPnNDeGu3sGSP2TloC0jESZjQ03FnyM";

// إبقي العميل لو احتجت قراءات مستقبلًا (مع RLS لن تُقرأ بدون سياسات)
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// حفظ/تحديث المستخدم في Supabase على أساس Auth0
async function supaEnsureUserFromAuth0() {
  try {
    const u = await window.auth?.getUser();
    if (!u || !u.sub) return { ok:false, error:'no auth0 user' };

    const res = await fetch('/.netlify/functions/upsert-user', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        sub: u.sub,
        email: u.email || null,
        name: u.name || u.nickname || null,
        picture: u.picture || null
      })
    });
    if (!res.ok) return { ok:false, error: await res.text() };
    return { ok:true, data: await res.json() };
  } catch (e) {
    return { ok:false, error: e.message };
  }
}

// تسجيل استخدام أداة (يرسل sub + مسار الصفحة + meta اختياري)
async function supaLogToolUsage(toolName, meta = {}) {
  try {
    const u = await window.auth?.getUser().catch(()=>null);
    const path = location.pathname + location.search + location.hash;

    const res = await fetch('/.netlify/functions/log-tool-usage', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        tool_name: toolName,
        user_sub: u?.sub || null,
        path,
        meta
      })
    });
    if (res.status === 204) return { ok:true, data:null }; // لا مستخدم
    if (!res.ok) return { ok:false, error: await res.text() };
    return { ok:true, data: await res.json() };
  } catch (e) {
    return { ok:false, error: e.message };
  }
}
