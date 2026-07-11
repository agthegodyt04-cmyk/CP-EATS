# CP EATS - Supabase Setup Instructions

## Fixing Console Errors

### 1. Fix kitchen_chats 400 Error

**Run the SQL migration:**
1. Go to your Supabase Dashboard: https://eqslifnlscywjppcwupn.supabase.co
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New query**
4. Copy and paste the contents of `fix-participants-array.sql`
5. Click **Run** (or press Ctrl+Enter)

This will change the `participants` column from JSONB to TEXT[], fixing the 400 error.

---

### 2. Fix Realtime Subscription Failures

**Enable Realtime for all tables:**

1. In Supabase Dashboard, go to **Database** → **Replication**
2. Find the **Realtime** section
3. Enable replication for these tables:
   - ✅ kitchens
   - ✅ menu_items
   - ✅ feed_posts
   - ✅ orders
   - ✅ reviews
   - ✅ notifications
   - ✅ users
   - ✅ kitchen_chats
   - ✅ favorites
   - ✅ follows
   - ✅ comments
   - ✅ chats

**OR use SQL:**
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE kitchens;
ALTER PUBLICATION supabase_realtime ADD TABLE menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE feed_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE reviews;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE kitchen_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE favorites;
ALTER PUBLICATION supabase_realtime ADD TABLE follows;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE chats;
```

---

### 3. Verify Fixes

After completing both steps:

1. **Refresh your browser** (Ctrl+Shift+R or Cmd+Shift+R for hard refresh)
2. Open Developer Console (F12)
3. Check for errors:
   - ❌ BEFORE: `Supabase realtime subscription failed for table: ...`
   - ✅ AFTER: No realtime errors
   - ❌ BEFORE: `kitchen_chats 400 error`
   - ✅ AFTER: Successful XHR requests

---

## What Was Fixed

### Issue 1: kitchen_chats participants column
- **Problem:** Column was JSONB, but code used `array-contains` operator which only works with native Postgres arrays
- **Solution:** Changed column type to `TEXT[]`
- **Result:** 400 errors eliminated

### Issue 2: Realtime subscriptions
- **Problem:** Realtime wasn't enabled in Supabase for the tables
- **Solution:** Enabled replication for all 12 tables
- **Result:** Real-time updates now work across all dashboards

---

## Additional Notes

- **Source map errors** in console are harmless - they're just development warnings
- **Cookie "__cf_bm" warning** is from Cloudflare and can be ignored
- **favicon.ico 404** is expected (no favicon file exists yet)

---

## If Issues Persist

1. Check Supabase logs: Dashboard → Logs → Postgres logs
2. Verify your `.env` file has correct Supabase credentials
3. Ensure you're running the latest schema: `supabase-schema.sql`
4. Check browser console for any new errors after refresh

---

## Need Help?

If you encounter any issues after following these instructions, check:
- Supabase Dashboard → Database → Tables → kitchen_chats (verify participants column is TEXT[])
- Supabase Dashboard → Database → Replication (verify all tables are enabled)