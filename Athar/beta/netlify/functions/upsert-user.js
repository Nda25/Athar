// netlify/functions/upsert-user.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE; // سرّي

const supaAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const email = (body.email || '').toLowerCase();
    const full_name = body.full_name || null;
    const plan = body.plan || null;

    if (!email) {
      return { statusCode: 400, body: 'missing email' };
    }

    const payload = {
      email,
      name: full_name,
      plan,
      source: 'auth0'
    };

    const { data, error } = await supaAdmin
      .from('users')
      .upsert(payload, { onConflict: 'email' })
      .select()
      .single();

    if (error) {
      console.error(error);
      return { statusCode: 500, body: error.message };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, user: data })
    };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: 'server error' };
  }
};
