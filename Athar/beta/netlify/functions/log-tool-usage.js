// يرسل السجل إلى Netlify Function (يعتمد على البريد)
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
        user_email,        // ← هذا المهم
        meta: meta || {}
      })
    });

    if (!res.ok && res.status !== 204) {
      return { ok: false, error: await res.text() };
    }
    return { ok: true, data: (res.status === 204 ? null : await res.json()) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
