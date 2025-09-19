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
    let   { tool_name, user_sub, path, meta } = body;

    if (!tool_name) {
      return { statusCode: 400, body: 'missing tool_name' };
    }
    if (!user_sub) {
      // نكتفي بتجاهل التسجيل إذا ما فيه مستخدم مُسجّل
      return { statusCode: 204, body: '' };
    }

    const ua = event.headers['user-agent'] || null;
    const ip = event.headers['x-nf-client-connection-ip']
            || event.headers['x-forwarded-for']
            || event.headers['client-ip']
            || null;

    const payload = {
      tool_name,
      user_sub,
      path: path || null,
      meta: meta || {},
      user_agent: ua,
      ip
    };

    const { data, error } = await supaAdmin
      .from('tool_usage')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('log-tool-usage error:', error);
      return { statusCode: 500, body: error.message };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, item: data }) };
  } catch (e) {
    console.error('log-tool-usage exception:', e);
    return { statusCode: 500, body: 'server error' };
  }
};
