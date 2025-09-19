// يرسل السجل إلى Netlify Function
async function supaLogToolUsage(toolName, meta = {}) {
  try {
    // نحاول جلب user_sub من Auth0 إن وُجد
    let user_sub = null;
    try {
      const u = await window.auth?.getUser();
      user_sub = u?.sub || null;
    } catch (_) {}

    const res = await fetch('/.netlify/functions/log-tool-usage', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        tool_name: toolName,
        user_sub,
        path: location.pathname,
        meta
      })
    });

    if (!res.ok && res.status !== 204) {
      // 204 = ما فيه مستخدم، ونتجاهل بهدوء
      return { ok:false, error: await res.text() };
    }
    return { ok:true, data: (res.status === 204 ? null : await res.json()) };
  } catch (e) {
    return { ok:false, error: e.message };
  }
}
