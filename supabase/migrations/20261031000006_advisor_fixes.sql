-- Fixes from the Supabase security & performance advisors

-- ───────── Security ─────────
-- History view runs with the caller's permissions (RLS applies)…
alter view public.my_redemptions set (security_invoker = true);

-- …so students may still read places/perks they have redeemed at, even if later paused.
create or replace function public.has_redeemed_at(p_merchant_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from redemptions where merchant_id = p_merchant_id and user_id = auth.uid())
$$;
revoke execute on function public.has_redeemed_at(uuid) from public, anon;
grant execute on function public.has_redeemed_at(uuid) to authenticated;

-- Pin search_path on helper functions
alter function public.cairo_today() set search_path = public;
alter function public.level_for_xp(integer) set search_path = public;
alter function public.level_name(integer) set search_path = public;
alter function public.distance_m(double precision, double precision, double precision, double precision) set search_path = public;
alter function public.wheel_segments() set search_path = public;

-- Trigger-only function must not be callable through the API
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ───────── Performance: RLS ─────────
-- (select auth.uid()) is evaluated once per query instead of once per row, and
-- admin/manager write policies no longer overlap the SELECT policies.

drop policy profiles_self_read on public.profiles;
drop policy profiles_self_update on public.profiles;
create policy profiles_self_read on public.profiles for select using (id = (select auth.uid()) or public.is_admin());
create policy profiles_self_update on public.profiles for update using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

drop policy stats_self_read on public.user_stats;
create policy stats_self_read on public.user_stats for select using (user_id = (select auth.uid()) or public.is_admin());

drop policy merchants_read on public.merchants;
create policy merchants_read on public.merchants for select
  using (status = 'live' or public.is_admin() or public.is_merchant_member(id) or public.has_redeemed_at(id));

drop policy members_read on public.merchant_members;
drop policy members_admin on public.merchant_members;
create policy members_read on public.merchant_members for select
  using (user_id = (select auth.uid()) or public.is_admin() or public.is_merchant_member(merchant_id, array['owner','manager']));
create policy members_admin_insert on public.merchant_members for insert with check (public.is_admin());
create policy members_admin_update on public.merchant_members for update using (public.is_admin()) with check (public.is_admin());
create policy members_admin_delete on public.merchant_members for delete using (public.is_admin());

drop policy campuses_admin on public.campuses;
create policy campuses_admin_insert on public.campuses for insert with check (public.is_admin());
create policy campuses_admin_update on public.campuses for update using (public.is_admin()) with check (public.is_admin());
create policy campuses_admin_delete on public.campuses for delete using (public.is_admin());

drop policy branches_read on public.merchant_branches;
drop policy branches_write on public.merchant_branches;
create policy branches_read on public.merchant_branches for select using (
  public.is_admin() or public.is_merchant_member(merchant_id) or public.has_redeemed_at(merchant_id)
  or (is_active and exists (select 1 from merchants m where m.id = merchant_id and m.status = 'live'))
);
create policy branches_insert on public.merchant_branches for insert
  with check (public.is_admin() or public.is_merchant_member(merchant_id, array['owner','manager']));
create policy branches_update on public.merchant_branches for update
  using (public.is_admin() or public.is_merchant_member(merchant_id, array['owner','manager']))
  with check (public.is_admin() or public.is_merchant_member(merchant_id, array['owner','manager']));
create policy branches_delete on public.merchant_branches for delete
  using (public.is_admin() or public.is_merchant_member(merchant_id, array['owner','manager']));

drop policy qr_write on public.branch_qr_codes;
create policy qr_insert on public.branch_qr_codes for insert with check (
  public.is_admin() or exists (select 1 from merchant_branches b where b.id = branch_id and public.is_merchant_member(b.merchant_id, array['owner','manager'])));
create policy qr_update on public.branch_qr_codes for update using (
  public.is_admin() or exists (select 1 from merchant_branches b where b.id = branch_id and public.is_merchant_member(b.merchant_id, array['owner','manager'])))
  with check (
  public.is_admin() or exists (select 1 from merchant_branches b where b.id = branch_id and public.is_merchant_member(b.merchant_id, array['owner','manager'])));
create policy qr_delete on public.branch_qr_codes for delete using (
  public.is_admin() or exists (select 1 from merchant_branches b where b.id = branch_id and public.is_merchant_member(b.merchant_id, array['owner','manager'])));

drop policy perks_read on public.perks;
drop policy perks_write on public.perks;
create policy perks_read on public.perks for select using (
  public.is_admin() or public.is_merchant_member(merchant_id) or public.has_redeemed_at(merchant_id)
  or (status = 'active' and (end_at is null or end_at > now())
      and exists (select 1 from merchants m where m.id = merchant_id and m.status = 'live'))
);
create policy perks_insert on public.perks for insert
  with check (public.is_admin() or public.is_merchant_member(merchant_id, array['owner','manager']));
create policy perks_update on public.perks for update
  using (public.is_admin() or public.is_merchant_member(merchant_id, array['owner','manager']))
  with check (public.is_admin() or public.is_merchant_member(merchant_id, array['owner','manager']));
create policy perks_delete on public.perks for delete
  using (public.is_admin() or public.is_merchant_member(merchant_id, array['owner','manager']));

drop policy redemptions_read on public.redemptions;
create policy redemptions_read on public.redemptions for select
  using (user_id = (select auth.uid()) or public.is_admin() or public.is_merchant_member(merchant_id));

drop policy xp_read on public.xp_events;
create policy xp_read on public.xp_events for select using (user_id = (select auth.uid()) or public.is_admin());

drop policy quests_admin on public.quests;
create policy quests_admin_insert on public.quests for insert with check (public.is_admin());
create policy quests_admin_update on public.quests for update using (public.is_admin()) with check (public.is_admin());
create policy quests_admin_delete on public.quests for delete using (public.is_admin());

drop policy user_quests_read on public.user_quests;
create policy user_quests_read on public.user_quests for select using (user_id = (select auth.uid()) or public.is_admin());

drop policy badges_admin on public.badges;
create policy badges_admin_insert on public.badges for insert with check (public.is_admin());
create policy badges_admin_update on public.badges for update using (public.is_admin()) with check (public.is_admin());
create policy badges_admin_delete on public.badges for delete using (public.is_admin());

drop policy user_badges_read on public.user_badges;
create policy user_badges_read on public.user_badges for select using (user_id = (select auth.uid()) or public.is_admin());

drop policy favorites_own on public.favorites;
create policy favorites_own on public.favorites for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy spins_read on public.spins;
create policy spins_read on public.spins for select using (user_id = (select auth.uid()) or public.is_admin());

-- ───────── Performance: indexes on foreign keys ─────────
create index if not exists favorites_merchant_idx on public.favorites (merchant_id);
create index if not exists branches_campus_idx on public.merchant_branches (campus_id);
create index if not exists members_user_idx on public.merchant_members (user_id);
create index if not exists perks_branch_idx on public.perks (branch_id);
create index if not exists profiles_campus_idx on public.profiles (campus_id);
create index if not exists profiles_referred_by_idx on public.profiles (referred_by);
create index if not exists redemptions_branch_idx on public.redemptions (branch_id);
create index if not exists redemptions_qr_idx on public.redemptions (qr_code_id);
create index if not exists user_badges_badge_idx on public.user_badges (badge_id);
create index if not exists user_quests_quest_idx on public.user_quests (quest_id);
