-- Merchant portal controls:
--   * dashboard numbers for any date range (month to date by default)
--   * merchants can no longer pause / activate perks (Perkly Operations does)
--   * merchants can no longer edit branch details (Operations does); owners can still close / reopen a branch
--   * bank details: the owner adds them once, Operations approves; payout cycle is set by Perkly
--   * receipt VAT line: shown / hidden and its rate, set in the portal Settings

-- ───────── Dashboard: date range ─────────
drop function if exists public.merchant_stats(uuid, integer, uuid, uuid);
create or replace function public.merchant_stats(p_merchant_id uuid, p_days integer default 30,
                                                 p_branch_id uuid default null, p_qr_id uuid default null,
                                                 p_from date default null, p_to date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_from timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365)));
        v_to timestamptz := 'infinity';
        v_result jsonb;
begin
  if not (public.can_see_merchant(p_merchant_id) or public.is_merchant_member(p_merchant_id)
          or (p_branch_id is not null and public.is_branch_manager(p_branch_id)
              and exists (select 1 from merchant_branches where id = p_branch_id and merchant_id = p_merchant_id))) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_from is not null then
    v_from := p_from::timestamp at time zone 'Africa/Cairo';
    v_to := (coalesce(p_to, p_from) + 1)::timestamp at time zone 'Africa/Cairo';
  end if;

  with r as (
    select * from redemptions
     where merchant_id = p_merchant_id and status <> 'reversed' and created_at >= v_from and created_at < v_to
       and (p_branch_id is null or branch_id = p_branch_id)
       and (p_qr_id is null or qr_code_id = p_qr_id)
  ), cust as (
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
revoke execute on function public.merchant_stats(uuid, integer, uuid, uuid, date, date) from public, anon;
grant execute on function public.merchant_stats(uuid, integer, uuid, uuid, date, date) to authenticated;

-- ───────── Perks: only Perkly pauses / activates ─────────
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
    -- merchants can't pause or activate a perk themselves
    if tg_op = 'UPDATE' and old.status in ('active', 'paused') and new.status in ('active', 'paused') then
      new.status := old.status;
    end if;
    if tg_op = 'INSERT' and new.status = 'paused' then new.status := 'active'; end if;
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

-- ───────── Branches: details are changed by Perkly ─────────
create or replace function public.guard_branch() returns trigger
language plpgsql set search_path = public as $$
begin
  if public.can_manage_merchant(old.merchant_id) or current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;
  -- merchant owners / managers: only open / close
  new.merchant_id := old.merchant_id; new.name := old.name; new.address := old.address; new.city := old.city;
  new.campus_id := old.campus_id; new.lat := old.lat; new.lng := old.lng;
  return new;
end $$;
drop trigger if exists guard_branch on public.merchant_branches;
create trigger guard_branch before update on public.merchant_branches
  for each row execute function public.guard_branch();
revoke execute on function public.guard_branch() from public, anon, authenticated;

-- ───────── Bank details: added once, approved by Operations ─────────
alter table public.merchant_bank_accounts
  add column if not exists status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  add column if not exists review_note text,
  add column if not exists submitted_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;
-- (existing rows stay approved; new ones from merchants start as pending, see the trigger)
create index if not exists bank_submitted_by_idx on public.merchant_bank_accounts (submitted_by);
create index if not exists bank_reviewed_by_idx on public.merchant_bank_accounts (reviewed_by);

drop policy if exists bank_write on public.merchant_bank_accounts;
create policy bank_write on public.merchant_bank_accounts for all using (
  public.is_merchant_member(merchant_id, array['owner']) or public.is_staff(array['admin','operations','finance']))
  with check (public.is_merchant_member(merchant_id, array['owner']) or public.is_staff(array['admin','operations','finance']));

create or replace function public.guard_bank_account() returns trigger
language plpgsql set search_path = public as $$
declare v_staff boolean := public.is_staff(array['admin','operations','finance']) or current_user in ('postgres', 'service_role', 'supabase_admin');
begin
  if v_staff then
    if tg_op = 'UPDATE' and new.status is distinct from old.status then
      if not (public.is_staff(array['admin','operations']) or current_user in ('postgres', 'service_role', 'supabase_admin')) then
        raise exception 'Only Operations can approve bank details' using errcode = '42501';
      end if;
      new.reviewed_by := auth.uid(); new.reviewed_at := now();
    end if;
    return new;
  end if;
  -- the merchant owner
  if tg_op = 'UPDATE' and old.status <> 'rejected' then
    raise exception 'bank_locked' using errcode = 'check_violation';
  end if;
  new.status := 'pending'; new.review_note := null; new.reviewed_by := null; new.reviewed_at := null;
  new.submitted_by := auth.uid(); new.updated_at := now();
  new.payout_schedule := case when tg_op = 'UPDATE' then old.payout_schedule else 'weekly' end;
  return new;
end $$;
drop trigger if exists guard_bank_account on public.merchant_bank_accounts;
create trigger guard_bank_account before insert or update on public.merchant_bank_accounts
  for each row execute function public.guard_bank_account();

-- Bank approvals show up in the notification center
alter table public.admin_requests drop constraint if exists admin_requests_kind_check;
alter table public.admin_requests add constraint admin_requests_kind_check
  check (kind in ('qr_code','perk','cashback','payout','bank_account'));

create or replace function public.sync_bank_request() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_merchant text;
begin
  select name into v_merchant from merchants where id = new.merchant_id;
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status <> 'pending') then
    insert into admin_requests (kind, merchant_id, ref_id, title, details, created_by)
    values ('bank_account', new.merchant_id, new.merchant_id, 'Bank details: ' || v_merchant,
            jsonb_build_object('merchant', v_merchant, 'bank', new.bank_name, 'account_name', new.account_name,
                               'iban_last4', right(coalesce(new.iban, ''), 4)),
            new.submitted_by)
    on conflict do nothing;
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status <> 'pending' then
    update admin_requests set status = case new.status when 'approved' then 'approved' else 'rejected' end,
           resolved_by = coalesce(new.reviewed_by, auth.uid()), resolved_at = now(), note = new.review_note
     where kind = 'bank_account' and ref_id = new.merchant_id and status = 'pending';
  end if;
  return new;
end $$;
drop trigger if exists sync_bank_request on public.merchant_bank_accounts;
create trigger sync_bank_request after insert or update of status on public.merchant_bank_accounts
  for each row execute function public.sync_bank_request();
revoke execute on function public.guard_bank_account(), public.sync_bank_request() from public, anon, authenticated;

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
  if v_req.kind = 'bank_account' and not public.is_staff(array['admin','operations']) then
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
  elsif v_req.kind = 'bank_account' then
    update merchant_bank_accounts set status = case when p_approve then 'approved' else 'rejected' end,
           review_note = case when p_approve then null else coalesce(p_note, 'Not approved') end
     where merchant_id = v_req.ref_id;
  end if;

  update admin_requests set status = case when p_approve then 'approved' else 'rejected' end,
         resolved_by = auth.uid(), resolved_at = now(), note = coalesce(note, p_note)
   where id = p_id and status = 'pending';
  return jsonb_build_object('ok', true);
end $$;

-- ───────── Receipt VAT line ─────────
insert into public.app_settings (key, value) values ('receipt', '{"show_vat": true, "vat_pct": 14}')
on conflict (key) do nothing;

drop policy if exists requests_read on public.admin_requests;
create policy requests_read on public.admin_requests for select using (
  public.is_admin()
  or (public.is_staff(array['operations','account_manager']) and kind in ('qr_code','perk')
      and (merchant_id is null or public.can_see_merchant(merchant_id)))
  or (public.is_staff(array['operations']) and kind = 'bank_account')
  or (public.is_staff(array['finance']) and kind in ('cashback','payout'))
  or created_by = (select auth.uid()));
