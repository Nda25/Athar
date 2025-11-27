# Database Migration Instructions

## ⚠️ IMPORTANT - Read Before Proceeding

This document contains the SQL commands needed to add the `target_pages` field to your announcements system in Supabase.

---

## Migration Steps

### Step 1: Access Supabase SQL Editor

1. Go to your Supabase project dashboard: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click on your project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New query**

### Step 2: Add the target_pages Column

Copy and paste the following SQL command into the SQL editor:

```sql
-- Add target_pages column to site_announcements table
ALTER TABLE site_announcements
ADD COLUMN IF NOT EXISTS target_pages text[] DEFAULT ARRAY['all']::text[];

-- Update existing announcements to have 'all' target (backwards compatibility)
UPDATE site_announcements
SET target_pages = ARRAY['all']::text[]
WHERE target_pages IS NULL OR array_length(target_pages, 1) IS NULL;
```

**What this does:**

- Adds a new column called `target_pages` that stores an array of text values
- Sets the default value to `['all']` (meaning all pages)
- Updates any existing announcements to target all pages

### Step 3: Run the Migration

1. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`)
2. Wait for the "Success. No rows returned" message
3. You should see a green success indicator

### Step 4: Verify the Migration

Run this query to verify the column was added successfully:

```sql
SELECT
  id,
  text,
  target_pages,
  active,
  created_at
FROM site_announcements
ORDER BY created_at DESC
LIMIT 5;
```

**What to expect:**

- All existing announcements should have `target_pages = ["all"]`
- No errors should appear
- The table structure should include the new column

---

## Rollback (If Needed)

If you need to undo this change, run:

```sql
-- Remove the target_pages column
ALTER TABLE site_announcements
DROP COLUMN IF EXISTS target_pages;
```

⚠️ **Warning:** This will permanently delete all page targeting data!

---

## Testing the Feature

After migration, test the feature:

1. **Go to the admin panel** (admin.html)
2. **Create a new announcement:**
   - Select specific pages (e.g., "mueen" and "darsi")
   - Click "نشر/تحديث"
3. **Verify on frontend:**
   - Visit mueen.html - announcement SHOULD appear
   - Visit darsi.html - announcement SHOULD appear
   - Visit other pages - announcement should NOT appear
4. **Create an "all pages" announcement:**
   - Check "جميع الصفحات"
   - Click "نشر/تحديث"
5. **Verify it appears on all pages**

---

## Troubleshooting

### Error: "column already exists"

**Solution:** The column was already added. You can skip Step 2.

### Error: "permission denied"

**Solution:** Make sure you're logged in with the correct Supabase project and have admin privileges.

### Announcements not filtering correctly

**Checklist:**

- [ ] Database migration completed successfully
- [ ] All code files have been updated (admin-announcement.js, banners.js, admin.js, admin.html)
- [ ] Browser cache cleared (Ctrl+Shift+R or Cmd+Shift+R)
- [ ] Netlify dev server restarted

---

## Next Steps

Once the migration is complete:

1. Test creating announcements with different page targets
2. Verify announcements appear on correct pages
3. Check that existing announcements still work (they should all target "all pages" by default)
4. Monitor for any errors in the browser console

✅ **Migration complete!** The page-specific announcements feature is now active.
