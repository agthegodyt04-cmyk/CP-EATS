-- CP EATS — Row Level Security policies (version-controlled copy of the applied migration).
-- Already applied to project eqslifnlscywjppcwupn. Re-run only on a fresh database.
--
-- Summary:
--   Public content (kitchens, menu_items, feed_posts, reviews, comments) = readable by anon + authenticated.
--   PII (users, orders, favorites, follows, notifications, chats, kitchen_chats, registries) = authenticated, owner-scoped.
--   Writes require authentication and, where it makes sense, row ownership. Admins (users.role = 'admin') get broad access.

create schema if not exists private;
create or replace function private.is_admin() returns boolean
language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.users u where u.id = (select auth.uid())::text and u.role = 'admin');
$$;
revoke execute on function private.is_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

alter table public.users            enable row level security;
alter table public.kitchens         enable row level security;
alter table public.menu_items       enable row level security;
alter table public.feed_posts       enable row level security;
alter table public.orders           enable row level security;
alter table public.favorites        enable row level security;
alter table public.follows          enable row level security;
alter table public.comments         enable row level security;
alter table public.reviews          enable row level security;
alter table public.notifications    enable row level security;
alter table public.chats            enable row level security;
alter table public.kitchen_chats    enable row level security;
alter table public.address_registry enable row level security;
alter table public.handle_registry  enable row level security;

-- users: any signed-in resident may read; only self/admin may write.
create policy users_select on public.users for select to authenticated using (true);
create policy users_insert on public.users for insert to authenticated with check (id = (select auth.uid())::text);
create policy users_update on public.users for update to authenticated
  using (id = (select auth.uid())::text or private.is_admin())
  with check (id = (select auth.uid())::text or private.is_admin());
create policy users_delete on public.users for delete to authenticated using (private.is_admin());

-- kitchens: public read; owner writes.
create policy kitchens_select on public.kitchens for select to anon, authenticated using (true);
create policy kitchens_insert on public.kitchens for insert to authenticated with check (id = (select auth.uid())::text);
create policy kitchens_update on public.kitchens for update to authenticated using (id = (select auth.uid())::text) with check (id = (select auth.uid())::text);
create policy kitchens_delete on public.kitchens for delete to authenticated using (id = (select auth.uid())::text or private.is_admin());

-- menu_items: public read; owner-kitchen writes.
create policy menu_items_select on public.menu_items for select to anon, authenticated using (true);
create policy menu_items_insert on public.menu_items for insert to authenticated with check ("kitchenId" = (select auth.uid())::text);
create policy menu_items_update on public.menu_items for update to authenticated using ("kitchenId" = (select auth.uid())::text) with check ("kitchenId" = (select auth.uid())::text);
create policy menu_items_delete on public.menu_items for delete to authenticated using ("kitchenId" = (select auth.uid())::text);

-- feed_posts: public read; owner creates; any signed-in user updates (likes); owner/admin deletes.
create policy feed_posts_select on public.feed_posts for select to anon, authenticated using (true);
create policy feed_posts_insert on public.feed_posts for insert to authenticated with check ("kitchenId" = (select auth.uid())::text);
create policy feed_posts_update on public.feed_posts for update to authenticated using (true) with check (true);
create policy feed_posts_delete on public.feed_posts for delete to authenticated using ("kitchenId" = (select auth.uid())::text or private.is_admin());

-- orders: only the customer or kitchen on the order (or admin).
create policy orders_select on public.orders for select to authenticated
  using ("customerId" = (select auth.uid())::text or "kitchenId" = (select auth.uid())::text or private.is_admin());
create policy orders_insert on public.orders for insert to authenticated with check ("customerId" = (select auth.uid())::text);
create policy orders_update on public.orders for update to authenticated
  using ("customerId" = (select auth.uid())::text or "kitchenId" = (select auth.uid())::text or private.is_admin())
  with check ("customerId" = (select auth.uid())::text or "kitchenId" = (select auth.uid())::text or private.is_admin());
create policy orders_delete on public.orders for delete to authenticated
  using ("customerId" = (select auth.uid())::text or "kitchenId" = (select auth.uid())::text or private.is_admin());

-- reviews: public read; author insert; author/kitchen/admin modify.
create policy reviews_select on public.reviews for select to anon, authenticated using (true);
create policy reviews_insert on public.reviews for insert to authenticated with check ("customerId" = (select auth.uid())::text);
create policy reviews_update on public.reviews for update to authenticated
  using ("customerId" = (select auth.uid())::text or "kitchenId" = (select auth.uid())::text or private.is_admin())
  with check ("customerId" = (select auth.uid())::text or "kitchenId" = (select auth.uid())::text or private.is_admin());
create policy reviews_delete on public.reviews for delete to authenticated
  using ("customerId" = (select auth.uid())::text or "kitchenId" = (select auth.uid())::text or private.is_admin());

-- comments: public read; author insert; author/admin modify.
create policy comments_select on public.comments for select to anon, authenticated using (true);
create policy comments_insert on public.comments for insert to authenticated with check ("userId" = (select auth.uid())::text);
create policy comments_update on public.comments for update to authenticated using ("userId" = (select auth.uid())::text or private.is_admin());
create policy comments_delete on public.comments for delete to authenticated using ("userId" = (select auth.uid())::text or private.is_admin());

-- favorites: strictly the owner.
create policy favorites_select on public.favorites for select to authenticated using ("userId" = (select auth.uid())::text);
create policy favorites_insert on public.favorites for insert to authenticated with check ("userId" = (select auth.uid())::text);
create policy favorites_update on public.favorites for update to authenticated using ("userId" = (select auth.uid())::text) with check ("userId" = (select auth.uid())::text);
create policy favorites_delete on public.favorites for delete to authenticated using ("userId" = (select auth.uid())::text);

-- follows: signed-in read (feed boosts); owner writes.
create policy follows_select on public.follows for select to authenticated using (true);
create policy follows_insert on public.follows for insert to authenticated with check ("followerId" = (select auth.uid())::text);
create policy follows_delete on public.follows for delete to authenticated using ("followerId" = (select auth.uid())::text);

-- notifications: owner read/delete; signed-in may create (alert for another user).
create policy notifications_select on public.notifications for select to authenticated using ("userId" = (select auth.uid())::text);
create policy notifications_insert on public.notifications for insert to authenticated with check (true);
create policy notifications_update on public.notifications for update to authenticated using ("userId" = (select auth.uid())::text);
create policy notifications_delete on public.notifications for delete to authenticated using ("userId" = (select auth.uid())::text or private.is_admin());

-- chats (per-order): signed-in read; sender writes.
create policy chats_select on public.chats for select to authenticated using (true);
create policy chats_insert on public.chats for insert to authenticated with check ("senderId" = (select auth.uid())::text);
create policy chats_update on public.chats for update to authenticated using ("senderId" = (select auth.uid())::text);
create policy chats_delete on public.chats for delete to authenticated using ("senderId" = (select auth.uid())::text or private.is_admin());

-- kitchen_chats (DMs): only participants can read/write.
create policy kitchen_chats_select on public.kitchen_chats for select to authenticated using ((select auth.uid())::text = any(participants));
create policy kitchen_chats_insert on public.kitchen_chats for insert to authenticated with check ("senderId" = (select auth.uid())::text and (select auth.uid())::text = any(participants));
create policy kitchen_chats_update on public.kitchen_chats for update to authenticated using ("senderId" = (select auth.uid())::text);
create policy kitchen_chats_delete on public.kitchen_chats for delete to authenticated using ("senderId" = (select auth.uid())::text or private.is_admin());

-- registries: signed-in read; owner writes.
create policy address_registry_select on public.address_registry for select to authenticated using (true);
create policy address_registry_insert on public.address_registry for insert to authenticated with check (uid = (select auth.uid())::text);
create policy handle_registry_select on public.handle_registry for select to authenticated using (true);
create policy handle_registry_insert on public.handle_registry for insert to authenticated with check (uid = (select auth.uid())::text);

NOTIFY pgrst, 'reload schema';