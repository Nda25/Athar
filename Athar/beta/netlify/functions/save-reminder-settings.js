// بنستدعي مكتبة supabase-js
const { createClient } = require('@supabase/supabase-js');

// اقرا بيانات المشروع من إعدادات Netlify
const SUPABASE_URL = process.env.SUPABASE_URL;
// !! استخدم اسم المتغير الصح اللي إنت قولتلي عليه !!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE; 

// بنعمل "عميل سوبر-أدمن"
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

exports.handler = async (event, context) => {
  // نتأكد إن الطلب نوعه POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // الـ body اللي جاي هو الـ payload اللي عايزين نعمله upsert
    const payload = JSON.parse(event.body);

    // نتأكد إن البيانات الأساسية موجودة
    if (!payload || !payload.user_id) {
      return { statusCode: 400, body: 'Missing payload or user_id' };
    }

    // هنا الأمر السحري: بنعمل upsert باستخدام صلاحيات الأدمن
    // الـ payload جاهز (فيه user_id, email, reminders_enabled, ...)
    const { data, error } = await supabaseAdmin
      .from('miyad_settings')
      .upsert(payload, { 
        onConflict: 'user_id' // مهم عشان يعمل update لو موجود
      });

    // لو حصل خطأ من Supabase نفسها
    if (error) {
      throw error;
    }

    // كله تمام
    return { statusCode: 200, body: JSON.stringify(data) };

  } catch (error) {
    console.error('Error in save-reminder-settings:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};