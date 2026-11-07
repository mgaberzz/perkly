-- Least privilege: every Perkly team role sees only its own slice of data.
--   admin / operations → everything
--   finance            → money + transactions; students only as they appear in transactions
--   account_manager    → only assigned merchants (and merchants on assigned campuses), and their customers

-- Merchant ids the signed-in team member may see (all for admin/operations/finance, assigned ones for account managers)
create or replace function public.staff_merchant_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from merchants where public.can_see_merchant(id)
$$;
revoke execute on function public.staff_merchant_ids() from public, anon;
grant execute on function public.staff_merchant_ids() to authenticated;

-- Campuses an account manager covers: assigned campuses + campuses where their merchants have branches
create or replace function public.staff_campus_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from campuses where public.is_staff(array['admin','operations','finance'])
  union
  select a.campus_id from staff_assignments a where a.user_id = auth.uid() and a.campus_id is not null
  union
  select b.campus_id from merchant_branches b where b.campus_id is not null and public.am_assigned(b.merchant_id)
    and public.is_staff(array['account_manager'])
$$;
revoke execute on function public.staff_campus_ids() from public, anon;
grant execute on function public.staff_campus_ids() to authenticated;

-- Is this student a customer of a merchant the team member can see?
create or replace function public.is_customer_of_visible_merchant(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from redemptions r where r.user_id = p_user and public.can_see_merchant(r.merchant_id))
$$;
revoke execute on function public.is_customer_of_visible_merchant(uuid) from public, anon;
grant execute on function public.is_customer_of_visible_merchant(uuid) to authenticated;

-- Profiles: own row; admin/operations everyone; finance & account managers only customers of their merchants
drop policy profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (
  id = (select auth.uid()) or public.is_staff(array['admin','operations'])
  or (public.is_staff(array['finance','account_manager']) and public.is_customer_of_visible_merchant(id)));

-- Gamification internals: admin/operations only
drop policy stats_read on public.user_stats;
create policy stats_read on public.user_stats for select using (user_id = (select auth.uid()) or public.is_staff(array['admin','operations']));
drop policy xp_read on public.xp_events;
create policy xp_read on public.xp_events for select using (user_id = (select auth.uid()) or public.is_staff(array['admin','operations']));
drop policy user_quests_read on public.user_quests;
create policy user_quests_read on public.user_quests for select using (user_id = (select auth.uid()) or public.is_staff(array['admin','operations']));
drop policy user_badges_read on public.user_badges;
create policy user_badges_read on public.user_badges for select using (user_id = (select auth.uid()) or public.is_staff(array['admin','operations']));
drop policy spins_read on public.spins;
create policy spins_read on public.spins for select using (user_id = (select auth.uid()) or public.is_staff(array['admin','operations']));

-- Overview: student numbers are platform-wide only for admin/operations; others see customers of their merchants
create or replace function public.admin_overview(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_from timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365)));
  v_all boolean := public.is_staff(array['admin','operations']);
begin
  if not public.is_staff() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return (
    with m as (select * from merchants where public.can_see_merchant(id)),
         r as (select r.* from redemptions r join m on m.id = r.merchant_id where r.created_at >= v_from and r.status <> 'reversed'),
         s as (select p.* from profiles p where p.role = 'student'
                 and (v_all or exists (select 1 from redemptions x join m on m.id = x.merchant_id where x.user_id = p.id)))
    select jsonb_build_object(
      'scope', case when v_all then 'all' else 'mine' end,
      'students', (select count(*) from s),
      'new_students', (select count(*) from s where created_at >= v_from),
      'active_students', (select count(distinct user_id) from r),
      'merchants', (select count(*) from m),
      'live_merchants', (select count(*) from m where status = 'live'),
      'pending_merchants', (select count(*) from m where status = 'pending'),
      'pending_perks', (select count(*) from perks p join m on m.id = p.merchant_id where p.status = 'pending'),
      'pending_requests', (select count(*) from admin_requests q where q.status = 'pending'
                             and (q.merchant_id is null or public.can_see_merchant(q.merchant_id))
                             and (q.kind in ('cashback','payout') or not public.is_staff(array['finance']))
                             and (q.kind not in ('cashback','payout') or public.is_staff(array['admin','finance']))),
      'redemptions', (select count(*) from r),
      'flagged_redemptions', (select count(*) from redemptions x join m on m.id = x.merchant_id where x.status = 'flagged'),
      'discount_given', (select coalesce(sum(discount_amount), 0) from r),
      'sales', (select coalesce(sum(final_amount), 0) from r),
      'est_commission', (select coalesce(sum(r.final_amount * m.commission_pct / 100), 0) from r join m on m.id = r.merchant_id),
      'by_day', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'count', c) order by d), '[]')
                   from (select (created_at at time zone 'Africa/Cairo')::date d, count(*) c from r group by 1) x),
      'top_merchants', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'count', x.c) order by x.c desc), '[]')
                   from (select merchant_id, count(*) c from r group by 1 order by 2 desc limit 10) x join m on m.id = x.merchant_id),
      'by_campus', (select coalesce(jsonb_agg(jsonb_build_object('campus', coalesce(c.short_name, c.name), 'students', x.c) order by x.c desc), '[]')
                   from (select campus_id, count(*) c from s where campus_id is not null group by 1) x
                   join campuses c on c.id = x.campus_id)
    ));
end $$;

-- Notification center: each role sees only the requests it can decide
drop policy requests_read on public.admin_requests;
create policy requests_read on public.admin_requests for select using (
  public.is_admin()
  or (public.is_staff(array['operations','account_manager']) and kind in ('qr_code','perk')
      and (merchant_id is null or public.can_see_merchant(merchant_id)))
  or (public.is_staff(array['finance']) and kind in ('cashback','payout'))
  or created_by = (select auth.uid()));
