-- Staff roles & scoped access, public IDs, brand types, per-cashier QR codes with approval,
-- branch managers, account-manager assignments, admin notification center.

-- ───────── Roles ─────────
-- student · merchant (portal via merchant_members) · admin · operations · account_manager · finance
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student','merchant','admin','operations','account_manager','finance'));

-- ───────── Public IDs (separate, human-readable series) ─────────
create sequence public.user_code_seq start 100001;
create sequence public.student_code_seq start 100001;
create sequence public.merchant_code_seq start 10001;

alter table public.profiles add column user_code text unique, add column student_code text unique;
update public.profiles p set user_code = 'USR-' || x.n
  from (select id, nextval('public.user_code_seq') n from (select id from public.profiles order by created_at) o) x where x.id = p.id;
update public.profiles p set student_code = 'STU-' || x.n
  from (select id, nextval('public.student_code_seq') n from (select id from public.profiles where role = 'student' order by created_at) o) x where x.id = p.id;
alter table public.profiles alter column user_code set default ('USR-' || nextval('public.user_code_seq'));
alter table public.profiles alter column user_code set not null;

alter table public.merchants add column merchant_code text unique;
update public.merchants m set merchant_code = 'MER-' || x.n
  from (select id, nextval('public.merchant_code_seq') n from (select id from public.merchants order by created_at, name) o) x where x.id = m.id;
alter table public.merchants alter column merchant_code set default ('MER-' || nextval('public.merchant_code_seq'));
alter table public.merchants alter column merchant_code set not null;

-- Students get a Student ID (kept even if the role later changes)
create or replace function public.assign_student_code() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'student' and new.student_code is null then
    new.student_code := 'STU-' || nextval('public.student_code_seq');
  end if;
  return new;
end $$;
create trigger assign_student_code before insert or update of role on public.profiles
  for each row execute function public.assign_student_code();
revoke execute on function public.assign_student_code() from public, anon, authenticated;

-- ───────── Brand types: local · chain · mega account ─────────
alter table public.merchants drop constraint merchants_brand_type_check;
update public.merchants set brand_type = 'mega_account' where brand_type = 'national_brand';
alter table public.merchants add constraint merchants_brand_type_check check (brand_type in ('local','chain','mega_account'));

-- ───────── Branch managers & per-cashier QR codes ─────────
alter table public.merchant_members drop constraint merchant_members_member_role_check;
alter table public.merchant_members add column branch_id uuid references public.merchant_branches(id) on delete cascade;
alter table public.merchant_members add constraint merchant_members_member_role_check
  check (member_role in ('owner','manager','branch_manager','cashier'));
alter table public.merchant_members add constraint branch_manager_needs_branch
  check (member_role <> 'branch_manager' or branch_id is not null);

alter table public.branch_qr_codes
  add column cashier_name text,
  add column status text not null default 'approved' check (status in ('pending','approved','rejected')),
  add column requested_by uuid references public.profiles(id) on delete set null,
  add column reviewed_by uuid references public.profiles(id) on delete set null,
  add column reviewed_at timestamptz,
  add column review_note text;

-- ───────── Account-manager assignments ─────────
create table public.staff_assignments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  merchant_id uuid references public.merchants(id) on delete cascade,
  campus_id   uuid references public.campuses(id) on delete cascade,
  created_at  timestamptz not null default now(),
  check (merchant_id is not null or campus_id is not null)
);
create unique index staff_assignments_unique on public.staff_assignments (user_id, coalesce(merchant_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(campus_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index staff_assignments_merchant_idx on public.staff_assignments (merchant_id);
create index staff_assignments_campus_idx on public.staff_assignments (campus_id);

-- ───────── Access helpers ─────────
create or replace function public.staff_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and status = 'active'
     and role in ('admin','operations','account_manager','finance')
$$;

create or replace function public.is_staff(p_roles text[] default array['admin','operations','account_manager','finance'])
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.staff_role() = any(p_roles), false)
$$;

-- Is the account manager responsible for this merchant (directly, or via a campus it has a branch at)?
create or replace function public.am_assigned(p_merchant_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from staff_assignments a
     where a.user_id = auth.uid()
       and (a.merchant_id = p_merchant_id
            or (a.campus_id is not null and exists (
                  select 1 from merchant_branches b where b.merchant_id = p_merchant_id and b.campus_id = a.campus_id)))
  )
$$;

-- Read access for staff: admin/operations/finance see every merchant; account managers only theirs
create or replace function public.can_see_merchant(p_merchant_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.staff_role()
    when 'admin' then true when 'operations' then true when 'finance' then true
    when 'account_manager' then public.am_assigned(p_merchant_id)
    else false end
$$;

-- Write access for staff: admin/operations everywhere; account managers on their merchants; finance never
create or replace function public.can_manage_merchant(p_merchant_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.staff_role()
    when 'admin' then true when 'operations' then true
    when 'account_manager' then public.am_assigned(p_merchant_id)
    else false end
$$;

create or replace function public.is_branch_manager(p_branch_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from merchant_members where user_id = auth.uid() and member_role = 'branch_manager' and branch_id = p_branch_id)
$$;

-- is_admin() keeps meaning "full administrator"
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.staff_role() = 'admin', false)
$$;

-- ───────── Guards: who may change sensitive fields ─────────
create or replace function public.guard_profile_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if not public.is_admin() and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    new.role := old.role;
    new.status := old.status;
    new.referral_code := old.referral_code;
    new.referred_by := old.referred_by;
    new.user_code := old.user_code;
    new.student_code := old.student_code;
  end if;
  return new;
end $$;

create or replace function public.guard_merchant_update() returns trigger
language plpgsql set search_path = public as $$
declare v_system boolean := current_user in ('postgres', 'service_role', 'supabase_admin');
begin
  new.merchant_code := old.merchant_code;
  if not v_system and not public.is_staff(array['admin','operations']) then
    new.plan := old.plan;
    new.commission_pct := old.commission_pct;
    if not public.can_manage_merchant(old.id) then
      new.status := old.status;
      new.brand_type := old.brand_type;
    end if;
  end if;
  return new;
end $$;

create or replace function public.guard_perk() returns trigger
language plpgsql set search_path = public as $$
declare
  v_high_tier boolean := new.discount_type = 'percentage' and new.discount_value > 30;
  v_privileged boolean := public.can_manage_merchant(new.merchant_id) or current_user in ('postgres', 'service_role', 'supabase_admin');
begin
  if v_high_tier and (new.end_at is null or new.max_uses_per_user is null or new.daily_cap is null) then
    raise exception 'Perks above 30%% need an end date, a per-student limit and a daily cap'
      using errcode = 'check_violation';
  end if;
  if new.branch_id is not null and not exists (
    select 1 from merchant_branches where id = new.branch_id and merchant_id = new.merchant_id
  ) then
    raise exception 'Branch does not belong to this merchant' using errcode = 'check_violation';
  end if;
  if not v_privileged then
    if new.status not in ('pending', 'active', 'paused') then
      new.status := coalesce(old.status, 'pending');
    end if;
    if v_high_tier and (
      tg_op = 'INSERT' or old.status in ('pending', 'rejected')
      or new.discount_value is distinct from old.discount_value
      or new.discount_type is distinct from old.discount_type
    ) and new.status = 'active' then
      new.status := 'pending';
    end if;
    if tg_op = 'UPDATE' and old.status = 'rejected' and new.status = 'active' then
      new.status := 'pending';
    end if;
  end if;
  return new;
end $$;

-- Cashier QR codes created by merchant staff wait for approval; only staff can approve
create or replace function public.guard_qr() returns trigger
language plpgsql set search_path = public as $$
declare
  v_merchant uuid;
  v_privileged boolean;
begin
  select merchant_id into v_merchant from merchant_branches where id = new.branch_id;
  v_privileged := public.can_manage_merchant(v_merchant) or current_user in ('postgres', 'service_role', 'supabase_admin');
  if tg_op = 'INSERT' then
    new.requested_by := coalesce(new.requested_by, auth.uid());
    if not v_privileged then
      new.status := 'pending'; new.reviewed_by := null; new.reviewed_at := null; new.review_note := null;
    elsif new.status = 'approved' and new.reviewed_at is null then
      new.reviewed_by := auth.uid(); new.reviewed_at := now();
    end if;
  else
    new.code := old.code;
    new.branch_id := old.branch_id;
    if not v_privileged then
      new.status := old.status; new.reviewed_by := old.reviewed_by;
      new.reviewed_at := old.reviewed_at; new.review_note := old.review_note;
    elsif new.status is distinct from old.status then
      new.reviewed_by := auth.uid(); new.reviewed_at := now();
    end if;
  end if;
  return new;
end $$;
create trigger guard_qr before insert or update on public.branch_qr_codes
  for each row execute function public.guard_qr();

-- ───────── Notification center: requests that need a staff decision ─────────
create table public.admin_requests (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('qr_code','perk','cashback','payout')),
  merchant_id uuid references public.merchants(id) on delete cascade,
  ref_id      uuid not null,
  title       text not null,
  details     jsonb not null default '{}',
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  note        text
);
create index admin_requests_status_idx on public.admin_requests (status, created_at desc);
create index admin_requests_merchant_idx on public.admin_requests (merchant_id);
create unique index admin_requests_open_ref on public.admin_requests (kind, ref_id) where status = 'pending';

-- Open / close requests automatically as QR codes and perks change status
create or replace function public.sync_qr_request() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_branch record;
begin
  select b.name, b.merchant_id, m.name as merchant_name into v_branch
    from merchant_branches b join merchants m on m.id = b.merchant_id where b.id = new.branch_id;
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status <> 'pending') then
    insert into admin_requests (kind, merchant_id, ref_id, title, details, created_by)
    values ('qr_code', v_branch.merchant_id, new.id,
            'New cashier QR: ' || coalesce(new.cashier_name, new.label) || ' · ' || v_branch.name,
            jsonb_build_object('branch', v_branch.name, 'merchant', v_branch.merchant_name, 'cashier', new.cashier_name, 'label', new.label),
            new.requested_by)
    on conflict do nothing;
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status <> 'pending' then
    update admin_requests set status = case new.status when 'approved' then 'approved' else 'rejected' end,
           resolved_by = coalesce(new.reviewed_by, auth.uid()), resolved_at = now(), note = new.review_note
     where kind = 'qr_code' and ref_id = new.id and status = 'pending';
  end if;
  return new;
end $$;
create trigger sync_qr_request after insert or update of status on public.branch_qr_codes
  for each row execute function public.sync_qr_request();

create or replace function public.sync_perk_request() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_merchant text;
begin
  select name into v_merchant from merchants where id = new.merchant_id;
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status <> 'pending') then
    insert into admin_requests (kind, merchant_id, ref_id, title, details, created_by)
    values ('perk', new.merchant_id, new.id, 'Perk approval: ' || new.title || ' · ' || v_merchant,
            jsonb_build_object('merchant', v_merchant, 'discount_type', new.discount_type, 'discount_value', new.discount_value,
                               'end_at', new.end_at, 'daily_cap', new.daily_cap, 'max_uses_per_user', new.max_uses_per_user),
            auth.uid())
    on conflict do nothing;
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status <> 'pending' then
    update admin_requests set status = case when new.status = 'rejected' then 'rejected' else 'approved' end,
           resolved_by = auth.uid(), resolved_at = now(), note = new.review_note
     where kind = 'perk' and ref_id = new.id and status = 'pending';
  end if;
  return new;
end $$;
create trigger sync_perk_request after insert or update of status on public.perks
  for each row execute function public.sync_perk_request();

revoke execute on function public.guard_qr(), public.sync_qr_request(), public.sync_perk_request() from public, anon, authenticated;

-- Approve / reject from the notification center
create or replace function public.resolve_request(p_id uuid, p_approve boolean, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_req admin_requests;
begin
  select * into v_req from admin_requests where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_req.status <> 'pending' then return jsonb_build_object('ok', false, 'error', 'already_resolved'); end if;
  if v_req.kind in ('qr_code','perk') and not public.can_manage_merchant(v_req.merchant_id) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;
  if v_req.kind in ('cashback','payout') and not public.is_staff(array['admin','finance']) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;

  if v_req.kind = 'qr_code' then
    update branch_qr_codes set status = case when p_approve then 'approved' else 'rejected' end,
           reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note
     where id = v_req.ref_id;
  elsif v_req.kind = 'perk' then
    update perks set status = case when p_approve then 'active' else 'rejected' end,
           review_note = case when p_approve then null else coalesce(p_note, 'Not approved') end
     where id = v_req.ref_id;
  end if;

  -- Triggers close qr/perk requests; close any other kind (and anything still open) here
  update admin_requests set status = case when p_approve then 'approved' else 'rejected' end,
         resolved_by = auth.uid(), resolved_at = now(), note = coalesce(note, p_note)
   where id = p_id and status = 'pending';
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.resolve_request(uuid, boolean, text) from public, anon;
grant execute on function public.resolve_request(uuid, boolean, text) to authenticated;

-- Backfill: perks already waiting for approval show up in the notification center
insert into public.admin_requests (kind, merchant_id, ref_id, title, details)
select 'perk', p.merchant_id, p.id, 'Perk approval: ' || p.title || ' · ' || m.name, jsonb_build_object('merchant', m.name)
  from public.perks p join public.merchants m on m.id = p.merchant_id where p.status = 'pending'
on conflict do nothing;

-- ───────── Row level security, rebuilt for all roles ─────────
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table public.staff_assignments enable row level security;
alter table public.admin_requests enable row level security;

-- Campuses
create policy campuses_read on public.campuses for select using (is_active or public.is_staff());
create policy campuses_insert on public.campuses for insert with check (public.is_staff(array['admin','operations']));
create policy campuses_update on public.campuses for update using (public.is_staff(array['admin','operations'])) with check (public.is_staff(array['admin','operations']));
create policy campuses_delete on public.campuses for delete using (public.is_admin());

-- Profiles & stats: own row; staff can read
create policy profiles_read on public.profiles for select using (id = (select auth.uid()) or public.is_staff());
create policy profiles_update on public.profiles for update using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());
create policy stats_read on public.user_stats for select using (user_id = (select auth.uid()) or public.is_staff());

-- Merchants
create policy merchants_read on public.merchants for select using (
  status = 'live' or public.can_see_merchant(id) or public.has_redeemed_at(id)
  or public.is_merchant_member(id, array['owner','manager','branch_manager','cashier']));
create policy merchants_insert on public.merchants for insert with check (public.is_staff(array['admin','operations']));
create policy merchants_update on public.merchants for update
  using (public.can_manage_merchant(id) or public.is_merchant_member(id, array['owner','manager']))
  with check (public.can_manage_merchant(id) or public.is_merchant_member(id, array['owner','manager']));
create policy merchants_delete on public.merchants for delete using (public.is_admin());

-- Merchant team
create policy members_read on public.merchant_members for select using (
  user_id = (select auth.uid()) or public.can_see_merchant(merchant_id) or public.is_merchant_member(merchant_id, array['owner','manager']));
create policy members_insert on public.merchant_members for insert with check (public.can_manage_merchant(merchant_id));
create policy members_update on public.merchant_members for update using (public.can_manage_merchant(merchant_id)) with check (public.can_manage_merchant(merchant_id));
create policy members_delete on public.merchant_members for delete using (public.can_manage_merchant(merchant_id));

-- Branches
create policy branches_read on public.merchant_branches for select using (
  public.can_see_merchant(merchant_id) or public.is_merchant_member(merchant_id) or public.is_branch_manager(id)
  or public.has_redeemed_at(merchant_id)
  or (is_active and exists (select 1 from merchants m where m.id = merchant_id and m.status = 'live')));
create policy branches_insert on public.merchant_branches for insert
  with check (public.can_manage_merchant(merchant_id) or public.is_merchant_member(merchant_id, array['owner','manager']));
create policy branches_update on public.merchant_branches for update
  using (public.can_manage_merchant(merchant_id) or public.is_merchant_member(merchant_id, array['owner','manager']))
  with check (public.can_manage_merchant(merchant_id) or public.is_merchant_member(merchant_id, array['owner','manager']));
create policy branches_delete on public.merchant_branches for delete
  using (public.can_manage_merchant(merchant_id) or public.is_merchant_member(merchant_id, array['owner']));

-- Cashier QR codes (never readable by students)
create policy qr_read on public.branch_qr_codes for select using (exists (
  select 1 from merchant_branches b where b.id = branch_id
     and (public.can_see_merchant(b.merchant_id) or public.is_merchant_member(b.merchant_id) or public.is_branch_manager(b.id))));
create policy qr_insert on public.branch_qr_codes for insert with check (exists (
  select 1 from merchant_branches b where b.id = branch_id
     and (public.can_manage_merchant(b.merchant_id) or public.is_merchant_member(b.merchant_id, array['owner','manager'])
          or public.is_branch_manager(b.id))));
create policy qr_update on public.branch_qr_codes for update using (exists (
  select 1 from merchant_branches b where b.id = branch_id
     and (public.can_manage_merchant(b.merchant_id) or public.is_merchant_member(b.merchant_id, array['owner','manager'])
          or public.is_branch_manager(b.id))))
  with check (exists (
  select 1 from merchant_branches b where b.id = branch_id
     and (public.can_manage_merchant(b.merchant_id) or public.is_merchant_member(b.merchant_id, array['owner','manager'])
          or public.is_branch_manager(b.id))));
create policy qr_delete on public.branch_qr_codes for delete using (exists (
  select 1 from merchant_branches b where b.id = branch_id
     and (public.can_manage_merchant(b.merchant_id) or public.is_merchant_member(b.merchant_id, array['owner']))));

-- Perks (campaigns)
create policy perks_read on public.perks for select using (
  public.can_see_merchant(merchant_id) or public.is_merchant_member(merchant_id) or public.has_redeemed_at(merchant_id)
  or (status = 'active' and (end_at is null or end_at > now())
      and exists (select 1 from merchants m where m.id = merchant_id and m.status = 'live')));
create policy perks_insert on public.perks for insert
  with check (public.can_manage_merchant(merchant_id) or public.is_merchant_member(merchant_id, array['owner','manager']));
create policy perks_update on public.perks for update
  using (public.can_manage_merchant(merchant_id) or public.is_merchant_member(merchant_id, array['owner','manager']))
  with check (public.can_manage_merchant(merchant_id) or public.is_merchant_member(merchant_id, array['owner','manager']));
create policy perks_delete on public.perks for delete
  using (public.can_manage_merchant(merchant_id) or public.is_merchant_member(merchant_id, array['owner','manager']));

-- Redemptions (inserted only by the redemption engine)
create policy redemptions_read on public.redemptions for select using (
  user_id = (select auth.uid()) or public.can_see_merchant(merchant_id) or public.is_merchant_member(merchant_id)
  or (branch_id is not null and public.is_branch_manager(branch_id)));
create policy redemptions_update on public.redemptions for update
  using (public.is_staff(array['admin','operations'])) with check (public.is_staff(array['admin','operations']));

-- Gamification
create policy xp_read on public.xp_events for select using (user_id = (select auth.uid()) or public.is_staff());
create policy quests_read on public.quests for select using (is_active or public.is_staff());
create policy quests_insert on public.quests for insert with check (public.is_staff(array['admin','operations']));
create policy quests_update on public.quests for update using (public.is_staff(array['admin','operations'])) with check (public.is_staff(array['admin','operations']));
create policy quests_delete on public.quests for delete using (public.is_staff(array['admin','operations']));
create policy user_quests_read on public.user_quests for select using (user_id = (select auth.uid()) or public.is_staff());
create policy badges_read on public.badges for select using (true);
create policy badges_insert on public.badges for insert with check (public.is_staff(array['admin','operations']));
create policy badges_update on public.badges for update using (public.is_staff(array['admin','operations'])) with check (public.is_staff(array['admin','operations']));
create policy badges_delete on public.badges for delete using (public.is_staff(array['admin','operations']));
create policy user_badges_read on public.user_badges for select using (user_id = (select auth.uid()) or public.is_staff());
create policy favorites_own on public.favorites for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy spins_read on public.spins for select using (user_id = (select auth.uid()) or public.is_staff());

-- Assignments (admin manages; staff see their own)
create policy assignments_read on public.staff_assignments for select using (user_id = (select auth.uid()) or public.is_staff(array['admin','operations']));
create policy assignments_insert on public.staff_assignments for insert with check (public.is_admin());
create policy assignments_delete on public.staff_assignments for delete using (public.is_admin());

-- Notification center (decisions go through resolve_request)
create policy requests_read on public.admin_requests for select using (
  (public.is_staff(array['admin','operations','account_manager']) and (merchant_id is null or public.can_see_merchant(merchant_id)))
  or (public.is_staff(array['finance']) and kind in ('cashback','payout'))
  or created_by = (select auth.uid()));

grant select on public.staff_assignments, public.admin_requests to authenticated;
grant insert, delete on public.staff_assignments to authenticated;
revoke insert, update, delete, truncate on public.staff_assignments, public.admin_requests from anon;

revoke execute on function public.staff_role(), public.am_assigned(uuid) from public, anon;
grant execute on function public.staff_role(), public.am_assigned(uuid) to authenticated;
grant execute on function public.is_staff(text[]), public.can_see_merchant(uuid), public.can_manage_merchant(uuid), public.is_branch_manager(uuid)
  to anon, authenticated;

-- ───────── Staff overview (scoped for account managers) ─────────
create or replace function public.admin_overview(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_from timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365)));
begin
  if not public.is_staff() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return (
    with m as (select * from merchants where public.can_see_merchant(id)),
         r as (select r.* from redemptions r join m on m.id = r.merchant_id where r.created_at >= v_from and r.status <> 'reversed')
    select jsonb_build_object(
      'students', (select count(*) from profiles where role = 'student'),
      'new_students', (select count(*) from profiles where role = 'student' and created_at >= v_from),
      'active_students', (select count(distinct user_id) from r),
      'live_merchants', (select count(*) from m where status = 'live'),
      'pending_merchants', (select count(*) from m where status = 'pending'),
      'pending_perks', (select count(*) from perks p join m on m.id = p.merchant_id where p.status = 'pending'),
      'pending_requests', (select count(*) from admin_requests q where q.status = 'pending' and (q.merchant_id is null or public.can_see_merchant(q.merchant_id))),
      'redemptions', (select count(*) from r),
      'flagged_redemptions', (select count(*) from redemptions x join m on m.id = x.merchant_id where x.status = 'flagged'),
      'discount_given', (select coalesce(sum(discount_amount), 0) from r),
      'est_commission', (select coalesce(sum(r.final_amount * m.commission_pct / 100), 0) from r join m on m.id = r.merchant_id),
      'by_day', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'count', c) order by d), '[]')
                   from (select (created_at at time zone 'Africa/Cairo')::date d, count(*) c from r group by 1) x),
      'top_merchants', (select coalesce(jsonb_agg(jsonb_build_object('name', m.name, 'count', x.c) order by x.c desc), '[]')
                   from (select merchant_id, count(*) c from r group by 1 order by 2 desc limit 10) x join m on m.id = x.merchant_id),
      'by_campus', (select coalesce(jsonb_agg(jsonb_build_object('campus', coalesce(c.short_name, c.name), 'students', x.c) order by x.c desc), '[]')
                   from (select campus_id, count(*) c from profiles where role = 'student' and campus_id is not null group by 1) x
                   join campuses c on c.id = x.campus_id)
    ));
end $$;

-- ───────── Merchant insights: merchant → branch → cashier layers ─────────
drop function public.merchant_stats(uuid, integer);
create or replace function public.merchant_stats(p_merchant_id uuid, p_days integer default 30,
                                                 p_branch_id uuid default null, p_qr_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_from timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365)));
        v_result jsonb;
begin
  if not (public.can_see_merchant(p_merchant_id) or public.is_merchant_member(p_merchant_id)
          or (p_branch_id is not null and public.is_branch_manager(p_branch_id)
              and exists (select 1 from merchant_branches where id = p_branch_id and merchant_id = p_merchant_id))) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  with r as (
    select * from redemptions
     where merchant_id = p_merchant_id and status <> 'reversed' and created_at >= v_from
       and (p_branch_id is null or branch_id = p_branch_id)
       and (p_qr_id is null or qr_code_id = p_qr_id)
  ), cust as (
    -- a customer is "new" in the period if their first-ever visit to this merchant falls inside it
    select user_id, bool_or(first_time_at_merchant) as is_new from r group by user_id
  )
  select jsonb_build_object(
    'redemptions', (select count(*) from r),
    'unique_students', (select count(*) from cust),
    'new_students', (select count(*) from cust where is_new),
    'recurring_students', (select count(*) from cust where not is_new),
    'new_customer_pct', (select case when count(*) = 0 then 0 else round(100.0 * count(*) filter (where is_new) / count(*)) end from cust),
    'recurring_customer_pct', (select case when count(*) = 0 then 0 else round(100.0 * count(*) filter (where not is_new) / count(*)) end from cust),
    'returning_redemptions', (select count(*) from r where not first_time_at_merchant),
    'discount_given', (select coalesce(sum(discount_amount), 0) from r),
    'revenue_after_discount', (select coalesce(sum(final_amount), 0) from r),
    'avg_ticket', (select coalesce(round(avg(original_amount), 2), 0) from r),
    'flagged', (select count(*) from r where status = 'flagged'),
    'by_day', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'count', c) order by d), '[]')
                 from (select (created_at at time zone 'Africa/Cairo')::date d, count(*) c from r group by 1) x),
    'by_hour', (select coalesce(jsonb_agg(jsonb_build_object('hour', h, 'count', c) order by h), '[]')
                 from (select extract(hour from created_at at time zone 'Africa/Cairo')::int h, count(*) c from r group by 1) x),
    'by_branch', (select coalesce(jsonb_agg(jsonb_build_object('branch_id', b.id, 'branch', b.name, 'count', x.c, 'revenue', x.rev) order by x.c desc), '[]')
                 from (select branch_id, count(*) c, coalesce(sum(final_amount), 0) rev from r where branch_id is not null group by 1) x
                 join merchant_branches b on b.id = x.branch_id),
    'by_cashier', (select coalesce(jsonb_agg(jsonb_build_object('qr_id', q.id, 'cashier', coalesce(q.cashier_name, q.label), 'branch', b.name,
                                                                'count', x.c, 'discount', x.d) order by x.c desc), '[]')
                 from (select qr_code_id, count(*) c, coalesce(sum(discount_amount), 0) d from r where qr_code_id is not null group by 1) x
                 join branch_qr_codes q on q.id = x.qr_code_id join merchant_branches b on b.id = q.branch_id),
    'by_perk', (select coalesce(jsonb_agg(jsonb_build_object('perk', p.title, 'count', x.c, 'discount', x.d) order by x.c desc), '[]')
                 from (select perk_id, count(*) c, coalesce(sum(discount_amount),0) d from r group by 1) x join perks p on p.id = x.perk_id)
  ) into v_result;
  return v_result;
end $$;
revoke execute on function public.merchant_stats(uuid, integer, uuid, uuid) from public, anon;
grant execute on function public.merchant_stats(uuid, integer, uuid, uuid) to authenticated;
