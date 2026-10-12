-- CP EATS — demo seed data (run once in Supabase Dashboard > SQL Editor).
-- Runs as the `postgres` owner, which bypasses RLS, so it works even with RLS enabled.
-- Safe to re-run: every insert uses ON CONFLICT DO NOTHING.

-- ── Kitchen owner profiles (users) ──
insert into public.users (id, email, name, role, society, "flatAddress", status, handle, "themePreference", created_at) values
  ('kitchen_punjabi_tadka', 'simran@cpeats.com',  'Simran''s Punjabi Tadka',        'kitchen', 'Centurian Park - O2 Valley',        'Centurian Park - O2 Valley, F-18, Floor 4, Flat 04',        'verified', 'simrans-punjabi-tadka',      'light', now()),
  ('kitchen_south_tiffin',  'auntie@cpeats.com',  'Auntie''s South Indian Tiffin',  'kitchen', 'Centurian Park - Low Rise',         'Centurian Park - Low Rise, C1, Floor 3, Flat 02',           'verified', 'aunties-south-indian-tiffin','light', now()),
  ('kitchen_sweet_oven',    'priya@cpeats.com',   'The Sweet Oven',                 'kitchen', 'Centurian Park - Tropical Garden',  'Centurian Park - Tropical Garden, F2, Floor 18, Flat 05',   'verified', 'the-sweet-oven',             'light', now())
on conflict (id) do nothing;

-- ── Kitchens ──
insert into public.kitchens (id, "kitchenName", handle, "vegType", mov, "isOnline", "operatingMode", "cuisineType", society, "flatAddress", "deliveryLocations", "customCategories", "createdAt") values
  ('kitchen_punjabi_tadka', 'Simran''s Punjabi Tadka',       'simrans-punjabi-tadka',       'veg', 100, true, 'online', 'North Indian, Punjabi Delicacies', 'Centurian Park - O2 Valley',       'Centurian Park - O2 Valley, F-18, Floor 4, Flat 04',      '[]'::jsonb, '{}', now()),
  ('kitchen_south_tiffin',  'Auntie''s South Indian Tiffin', 'aunties-south-indian-tiffin', 'veg', 100, true, 'online', 'South Indian, Fresh Idli & Dosa',  'Centurian Park - Low Rise',        'Centurian Park - Low Rise, C1, Floor 3, Flat 02',         '[]'::jsonb, '{}', now()),
  ('kitchen_sweet_oven',    'The Sweet Oven',                'the-sweet-oven',              'veg', 100, true, 'online', 'Eggless Desserts & Bakery',        'Centurian Park - Tropical Garden', 'Centurian Park - Tropical Garden, F2, Floor 18, Flat 05', '[]'::jsonb, '{}', now())
on conflict (id) do nothing;

-- ── Menu items ──
insert into public.menu_items (id, "kitchenId", name, description, price, "isVeg", "isAvailable", category, "createdAt") values
  ('menu_p1',  'kitchen_punjabi_tadka', 'Butter Paneer with Butter Roti', 'Rich Punjabi gravy paneer served with hand-stretched butter rotis', 180, true, true, 'Main Course', now()),
  ('menu_p2',  'kitchen_punjabi_tadka', 'Dal Makhani',                    'Slow-simmered black lentils with butter and cream',                 140, true, true, 'Main Course', now()),
  ('menu_s1',  'kitchen_south_tiffin',  'Ghee Podi Dosa',                 'Crispy dosa roasted with gun-powder podi and cold-pressed ghee',    120, true, true, 'Breakfast Tiffin', now()),
  ('menu_s2',  'kitchen_south_tiffin',  'Idli with Sambhar (3 pcs)',      'Steamed rice cakes with hot sambhar and coconut chutney',            80, true, true, 'Breakfast Tiffin', now()),
  ('menu_sw1', 'kitchen_sweet_oven',    'Eggless Chocolate Cupcakes (Box of 2)', 'Cocoa sponge with dark chocolate ganache. 100% eggless.',    120, true, true, 'Cupcakes', now()),
  ('menu_sw2', 'kitchen_sweet_oven',    'Fresh Strawberry Pastry',        'Vanilla sponge with fresh strawberry slices and whipped cream',      90, true, true, 'Pastries', now())
on conflict (id) do nothing;

-- ── Feed posts ──
insert into public.feed_posts (id, "kitchenId", "kitchenName", description, "imageUrl", likes, "taggedItemIds", "createdAt") values
  ('post_punjabi_1', 'kitchen_punjabi_tadka', 'Simran''s Punjabi Tadka',       'Simmering a fresh batch of Butter Paneer for tonight''s dinner! Order cutoff 7:00 PM.', '', '{}', '{menu_p1}',  now() - interval '1 hour'),
  ('post_south_1',   'kitchen_south_tiffin',  'Auntie''s South Indian Tiffin', 'Sundays are meant for Podi Dosa! Freshly ground podi on cast iron with ghee.',            '', '{}', '{menu_s1}',  now() - interval '2 hours'),
  ('post_sweet_1',   'kitchen_sweet_oven',    'The Sweet Oven',                'Just pulled ultra-moist eggless chocolate velvet cupcakes out of the oven!',              '', '{}', '{menu_sw1}', now() - interval '3 hours')
on conflict (id) do nothing;