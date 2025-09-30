// POST /.netlify/functions/storage-ensure
// ينشئ bucket: avatars (عام) ويضبط سياسات القراءة/الرفع إن لم تكن موجودة
exports.handler = async () => {
  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)
      return { statusCode: 500, body: "Missing Supabase envs" };

    // 1) تأكد وجود البكِت
    const list = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
    }).then(r => r.json());

    const has = Array.isArray(list) && list.find(b => b.name === "avatars");
    if (!has) {
      const mk = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: "avatars", public: true, file_size_limit: 10485760 }) // 10MB
      });
      if (!mk.ok) {
        const t = await mk.text();
        return { statusCode: 500, body: `Bucket create failed: ${t}` };
      }
    }

    // 2) سياسات RLS (اختياري عبر SQL؛ يفضّل ضبطها يدويًا مرة من لوحة Supabase)
    const sql = `
      do $$
      begin
        if not exists (select 1 from pg_policies where policyname = 'avatars public read') then
          create policy "avatars public read"
          on storage.objects for select
          to public
          using (bucket_id = 'avatars');
        end if;

        if not exists (select 1 from pg_policies where policyname = 'avatars authenticated write own prefix') then
          create policy "avatars authenticated write own prefix"
          on storage.objects for insert
          to authenticated
          with check (bucket_id = 'avatars');

          create policy "avatars authenticated update own"
          on storage.objects for update
          to authenticated
          using (bucket_id = 'avatars');
        end if;
      end
      $$;
    `;

    // قد لا تتوفر execute_sql في مشروعك — لو فشل الطلب عادي نتجاهله
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ query: sql })
      });
    } catch (_) {}

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: e.message || "Server error" };
  }
};
