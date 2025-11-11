const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
// استخدم اسم المتغير الصح بتاعك
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE; 

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { user_sub, event_id } = JSON.parse(event.body);

    if (!user_sub || !event_id) {
      return { statusCode: 400, body: 'Missing user_sub or event_id' };
    }

    
    const { data, error } = await supabaseAdmin
      .from('miyad_events')
      .delete()
      .eq('id', event_id)
      .eq('user_id', user_sub);

    if (error) {
      throw error;
    }

    return { statusCode: 200, body: JSON.stringify(data) };

  } catch (error) {
    console.error('Error in delete-miyad-event:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};