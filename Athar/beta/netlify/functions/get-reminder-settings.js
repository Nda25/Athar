const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
// استخدم اسم المتغير الصح بتاعك
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE; 

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

exports.handler = async (event, context) => {
  // نتأكد إن الطلب نوعه POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // بنقرا الـ user_sub اللي بعتناه من المتصفح
    const { user_sub } = JSON.parse(event.body);

    if (!user_sub) {
      return { statusCode: 400, body: 'Missing user_sub' };
    }

    // هنا الأمر السحري: بنجيب الإعدادات باستخدام صلاحيات الأدمن
    const { data, error } = await supabaseAdmin
      .from('miyad_settings')
      .select('reminders_enabled, remind_days_before') // اختار بس اللي محتاجينه
      .eq('user_id', user_sub)
      .maybeSingle(); // (هيرجع صف واحد أو null)

    if (error) {
      throw error;
    }

    // كله تمام (هيرجع الداتا أو null)
    return { statusCode: 200, body: JSON.stringify(data) };

  } catch (error) {
    console.error('Error in get-reminder-settings:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};