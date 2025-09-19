// netlify/functions/log-tool-usage.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE;

// عميل خدمة يتجاوز RLS
const supaAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

exports.handler = async (event) => {
  // السماح فقط بالـ POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { tool_name, user_email, meta } = body;

    // اسم الأداة مطلوب
    if (!tool_name) {
      return { statusCode: 400, body: 'missing tool_name' };
    }

    // لو ما فيه إيميل للمستخدم، نتجاهل بهدوء (لا نرمي خطأ)
    if (!user_email) {
      return { statusCode: 204, body: '' };
    }

    const payload = {
      tool_name,
      user_email: String(user_email).toLowerCase(),
      meta: meta || {}
      // used_at في الجدول له DEFAULT now()
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

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, item: data })
    };
  } catch (e) {
    console.error('log-tool-usage exception:', e);
    return { statusCode: 500, body: 'server error' };
  }
};
