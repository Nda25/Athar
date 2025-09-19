// netlify/functions/log-tool-usage.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE;

const supaAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // ✅ تأكيد متغيرات البيئة
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE');
    return { statusCode: 500, body: 'server misconfigured' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    let { tool_name, user_email, meta } = body;

    if (!tool_name) {
      return { statusCode: 400, body: 'missing tool_name' };
    }

    // ✅ تطبيع meta: خزّنيه كـ JSON صالح دائمًا
    // لو عمودك في Supabase نوعه json/jsonb فهذا ممتاز.
    // لو كان TEXT، غيّريه إلى jsonb أو فعلياً نخزّنه كسلسلة.
    if (meta == null) meta = {};
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta); } catch { meta = { value: meta }; }
    }
    if (typeof meta !== 'object') {
      meta = { value: String(meta) };
    }

    const payload = {
      tool_name: String(tool_name),
      user_email: user_email ? String(user_email).toLowerCase() : null,
      meta
    };

    const { data, error } = await supaAdmin
      .from('tool_usage')
      .insert([payload])   // 👈 الأفضل كمصفوفة
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return { statusCode: 500, body: error.message };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, item: data })
    };
  } catch (e) {
    console.error('handler error:', e);
    return { statusCode: 500, body: e.message || 'server error' };
  }
};
