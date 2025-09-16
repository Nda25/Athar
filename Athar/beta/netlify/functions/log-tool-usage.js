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

  try {
    const body = JSON.parse(event.body || '{}');
    const { tool_name, user_email, meta } = body;

    if (!tool_name) {
      return { statusCode: 400, body: 'missing tool_name' };
    }

    const payload = {
      tool_name,
      user_email: user_email || null,
      meta: meta || {}
    };

    const { data, error } = await supaAdmin
      .from('tool_usage')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error(error);
      return { statusCode: 500, body: error.message };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, item: data })
    };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: 'server error' };
  }
};
