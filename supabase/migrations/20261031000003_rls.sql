-- Row Level Security: students, merchant members and admins

alter table public.campuses          enable row level security;
alter table public.profiles          enable row level security;
alter table public.user_stats        enable row level security;
alter table public.merchants         enable row level security;
alter table public.merchant_members  enable row level security;
alter table public.merchant_branches enable row level security;
alter table public.branch_qr_codes   enable row level security;
alter table public.perks             enable row level security;
alter table public.redemptions       enable row level security;
alter table public.xp_events         enable row level security;
alter table public.quests            enable row level security;
alter table public.user_quests       enable row level security;
alter table public.badges            enable row level security;
alter table public.user_badges       enable row level security;
alter table public.favorites         enable row level security;

-- Campuses: public read, admin write
create policy campuses_read on public.campuses for select using (is_active or public.is_admin());
create policy campuses_admin on public.campuses for all using (public.is_admin()) with check (public.is_admin());

-- Profiles: own row; admins everything
create policy profiles_self_read on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy stats_self_read on public.user_stats for select using (user_id = auth.uid() or public.is_admin());

-- Merchants
create policy merchants_read on public.merchants for select
  using (status = 'live' or public.is_admin() or public.is_merchant_member(id));
create policy merchants_admin_insert on public.merchants for insert with check (public.is_admin());
create policy merchants_admin_delete on public.merchants for delete using (public.is_admin());
create policy merchants_update on public.merchants for update
  using (public.is_admin() or public.is_merchant_member(id, array['owner','manager']))
  with check (public.is_admin() or public.is_merchant_member(id, array['owner','manager']));

create policy members_read on public.merchant_members for select
  using (user_id = auth.uid() or public.is_admin() or public.is_merchant_member(merchant_id, array['owner','manager']));
create policy members_admin on public.merchant_members for all using (public.is_admin()) with check (public.is_admin());

-- Branches
create policy branches_read on public.merchant_branches for select using (
  public.is_admin() or public.is_merchant_member(merchant_id)
  or (is_active and exists (select 1 from merchants m where m.id = merchant_id and m.status = 'live'))
);
create policy branches_write on public.merchant_branches for all
  using (public.is_admin() or public.is_merchant_member(merchant_id, array['owner','manager']))
  with check (public.is_admin() or public.is_merchant_member(merchant_id, array['owner','manager']));

-- QR codes: never readable by students (they resolve codes via lookup_qr / redeem_perk)
create policy qr_read on public.branch_qr_codes for select using (
  public.is_admin() or exists (select 1 from merchant_branches b where b.id = branch_id and public.is_merchant_member(b.merchant_id))
);
create policy qr_write on public.branch_qr_codes for all using (
  public.is_admin() or exists (select 1 from merchant_branches b where b.id = branch_id and public.is_merchant_member(b.merchant_id, array['owner','manager']))
) with check (
  public.is_admin() or exists (select 1 from merchant_branches b where b.id = branch_id and public.is_merchant_member(b.merchant_id, array['owner','manager']))
);

-- Perks
create policy perks_read on public.perks for select using (
  public.is_admin() or public.is_merchant_member(merchant_id)
  or (status = 'active' and (end_at is null or end_at > now())
      and exists (select 1 from merchants m where m.id = merchant_id and m.status = 'live'))
);
create policy perks_write on public.perks for all
  using (public.is_admin() or public.is_merchant_member(merchant_id, array['owner','manager']))
  with check (public.is_admin() or public.is_merchant_member(merchant_id, array['owner','manager']));

-- Redemptions: inserted only through redeem_perk(); admins can flag/reverse
create policy redemptions_read on public.redemptions for select
  using (user_id = auth.uid() or public.is_admin() or public.is_merchant_member(merchant_id));
create policy redemptions_admin_update on public.redemptions for update using (public.is_admin()) with check (public.is_admin());

-- Gamification
create policy xp_read on public.xp_events for select using (user_id = auth.uid() or public.is_admin());
create policy quests_read on public.quests for select using (is_active or public.is_admin());
create policy quests_admin on public.quests for all using (public.is_admin()) with check (public.is_admin());
create policy user_quests_read on public.user_quests for select using (user_id = auth.uid() or public.is_admin());
create policy badges_read on public.badges for select using (true);
create policy badges_admin on public.badges for all using (public.is_admin()) with check (public.is_admin());
create policy user_badges_read on public.user_badges for select using (user_id = auth.uid() or public.is_admin());

-- Favorites
create policy favorites_own on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Grants (Supabase roles)
grant usage on schema public to anon, authenticated;
-- Supabase grants anon write privileges by default; signed-out visitors only ever read.
revoke insert, update, delete, truncate on all tables in schema public from anon;
grant select on public.campuses, public.merchants, public.merchant_branches, public.perks, public.quests, public.badges to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.redemptions, public.xp_events, public.user_stats, public.user_quests, public.user_badges from authenticated;
grant update on public.redemptions to authenticated; -- still limited to admins by RLS
grant select on public.my_redemptions to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.lookup_qr(text) to authenticated;
grant execute on function public.redeem_perk(text, uuid, numeric, double precision, double precision) to authenticated;
grant execute on function public.daily_checkin() to authenticated;
grant execute on function public.get_leaderboard(text, integer) to authenticated;
grant execute on function public.merchant_stats(uuid, integer) to authenticated;
grant execute on function public.admin_overview(integer) to authenticated;
grant execute on function public.merchant_week_redemptions(uuid) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_merchant_member(uuid, text[]) to anon, authenticated;
grant execute on function public.my_merchant_ids() to authenticated;
grant execute on function public.level_name(integer) to anon, authenticated;
grant execute on function public.level_for_xp(integer) to anon, authenticated;
grant execute on function public.cairo_today() to anon, authenticated;

-- Realtime: merchant portal live feed of redemptions
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.redemptions;
  end if;
end $$;
