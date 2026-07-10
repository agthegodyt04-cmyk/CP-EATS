-- CP EATS: disable RLS on all app tables and storage
-- Run this once in Supabase Dashboard > SQL Editor
-- This allows the app to read/write freely without auth policies.

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'users',
    'kitchens',
    'menu_items',
    'feed_posts',
    'orders',
    'favorites',
    'follows',
    'comments',
    'reviews',
    'notifications',
    'chats',
    'kitchen_chats',
    'address_registry',
    'handle_registry'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;

ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- In case any legacy policies still exist, drop common ones
DROP POLICY IF EXISTS "Allow authenticated uploads to media 1ps738_0" ON storage.objects;

NOTIFY pgrst, 'reload schema';
