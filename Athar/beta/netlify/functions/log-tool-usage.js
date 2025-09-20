// netlify/functions/log-tool-usage.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;            // https://oywqpkzaudmzwvytxaop.supabase.co
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE;   // محفوظ في Netlify Env
const supaAdmin   = createClient(supabaseUrl, serviceKey, { auth: { persistSession:false } });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { tool_name, user_email, user_sub, meta } = body;

    if (!tool_name) return { statusCode: 400, body: 'missing tool_name' };

    // نحدّد user_sub:
    let sub = user_sub || null;
    if (!sub && user_email) {
      // نحاول جلبه من جدول users
      const { data: urow } = await supaAdmin
        .from('users')
        .select('auth0_sub')
        .eq('email', String(user_email).toLowerCase())
        .maybeSingle();
      sub = urow?.auth0_sub || null;
    }

    // لو ما عرفنا المستخدم، نتجاهل بهدوء
    if (!sub) return { statusCode: 204, body: '' };

    // معلومات إضافية مفيدة
    const path = event.headers['x-nf-path'] || null;
    const user_agent = event.headers['user-agent'] || null;
    const ip = event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || null;

    const payload = {
      user_sub: sub,
      tool_name,
      path,
      meta: meta || {},
      user_agent,
      ip
      // used_at لها default now()
    };

    const { error } = await supaAdmin.from('tool_usage').insert(payload);
    if (error) {
      console.error('log-tool-usage error:', error);
      return { statusCode: 500, body: error.message };
    }

    return { statusCode: 200, body: JSON.stringify({ ok:true }) };
  } catch (e) {
    console.error('log-tool-usage exception:', e);
    return { statusCode: 500, body: 'server error' };
  }
};
