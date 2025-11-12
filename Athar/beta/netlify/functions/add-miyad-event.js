// بنستدعي مكتبة supabase-js
const { createClient } = require('@supabase/supabase-js');

// اقرا بيانات المشروع من إعدادات Netlify
const SUPABASE_URL = process.env.SUPABASE_URL;
// !! ده المفتاح السري، مش مفتاح الزائر !!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE;

// بنعمل "عميل سوبر-أدمن" بيقدر يعمل أي حاجة
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

exports.handler = async (event, context) => {
  // نتأكد إن الطلب نوعه POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // بنقرا البيانات اللي بعتناها من المتصفح
    const { user_sub, event_data } = JSON.parse(event.body);

    // نتأكد إن البيانات الأساسية موجودة
    if (!user_sub || !event_data) {
      return { statusCode: 400, body: 'Missing user_sub or event_data' };
    }
    
    // بنجهز البيانات عشان نحفظها في الداتابيز
    const { subj, cls, day, slot, date, color } = event_data;

    if (!subj || !cls || !day) {
      return { statusCode: 400, body: 'Missing required event fields (subj, class, day)' };
    }

    // بنضيف الموعد باستخدام صلاحيات الأدمن
    const { data, error } = await supabaseAdmin
      .from('miyad_events')
      .insert({
        user_id: user_sub, // بنربط الموعد برقم المستخدم
        subj: subj,
        class: cls, // اسم العمود في الداتابيز
        day: day,
        slot: slot,
        date: date || null, // لو التاريخ فاضي، ابعته null
        color: color
      }).select('id');

    // لو حصل خطأ من Supabase نفسها
    if (error) {
      throw error;
    }

    // كله تمام
    return { statusCode: 200, body: JSON.stringify(data) };

  } catch (error) {
    console.error('Error inserting miyad event:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};