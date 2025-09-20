// netlify/functions/log-tool-usage.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE;
const supaAdmin   = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { tool_name, user_email, meta } = body;

    if (!tool_name) {
      return { statusCode: 400, body: 'missing tool_name' };
    }

    // لو ما فيه إيميل، نتجاهل بهدوء (لا نسجل)
    if (!user_email) {
      return { statusCode: 204, body: '' };
    }

    // نجيب auth0_sub من جدول users بناء على الإيميل
    const email = String(user_email).toLowerCase();
    const { data: userRow, error: userErr } = await supaAdmin
      .from('users')
      .select('auth0_sub')
      .eq('email', email)
      .single();

    // لو المستخدم غير موجود في users، نتجاهل بهدوء
    if (userErr || !userRow || !userRow.auth0_sub) {
      return { statusCode: 204, body: '' };
    }

    // معلومات إضافية مفيدة
    const ua = event.headers['user-agent'] || null;
    const ref = event.headers['referer'] || event.headers['referrer'] || null;
    const ip  =
      event.headers['x-nf-client-connection-ip'] ||
      (event.headers['x-forwarded-for']?.split(',')[0] || null);

    const payload = {
      user_sub: userRow.auth0_sub,      // << المهم: الحقل الصحيح
      tool_name,
      path: ref,
      meta: meta || {},
      user_agent: ua,
      ip
      // used_at = default now()
    };

    const { data, error } = await supaAdmin
      .from('tool_usage')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('log-tool-usage insert error:', error);
      return { statusCode: 500, body: error.message };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, item: data }) };
  } catch (e) {
    console.error('log-tool-usage exception:', e);
    return { statusCode: 500, body: 'server error' };
  }
};
