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
    // واجهي الواجهة بهذا الشكل:
    // { sub, email, name, picture }
    const { sub, email, name, picture } = body;

    if (!sub) return { statusCode: 400, body: 'missing auth0 sub' };

    const payload = {
      auth0_sub: sub,
      email: email ? String(email).toLowerCase() : null,
      name: name || null,
      picture: picture || null
    };

    const { data, error } = await supaAdmin
      .from('users')
      .upsert(payload, { onConflict: 'auth0_sub' })
      .select()
      .single();

    if (error) {
      console.error('upsert-user error:', error);
      return { statusCode: 500, body: error.message };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, user: data }) };
  } catch (e) {
    console.error('upsert-user exception:', e);
    return { statusCode: 500, body: 'server error' };
  }
};
