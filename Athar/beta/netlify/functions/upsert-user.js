// netlify/functions/upsert-user.js
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
    // توقع: { sub, email, name, picture }
    const sub     = body.sub;
    const email   = body.email ? String(body.email).toLowerCase() : null;
    const name    = body.name || null;
    const picture = body.picture || null;

    if (!sub || !email) return { statusCode: 400, body: 'missing sub or email' };

    const payload = { auth0_sub: sub, email, name, picture };

    const { data, error } = await supaAdmin
      .from('users')
      .upsert(payload, { onConflict: 'auth0_sub' })
      .select()
      .single();

    if (error) {
      console.error('upsert-user error:', error);
      return { statusCode: 500, body: error.message };
    }

    return { statusCode: 200, body: JSON.stringify({ ok:true, user:data }) };
  } catch (e) {
    console.error('upsert-user exception:', e);
    return { statusCode: 500, body: 'server error' };
  }
};
