-- Partners: people/companies that onboard merchants for Perkly and earn a cut of Perkly's commission
-- on every transaction at "their" merchants.
--   Deal (per partner):  percentage → cut = commission × %      (VAT is not part of the commission)
--                        fixed      → cut = fixed EGP per transaction, capped at that transaction's commission
--   The deal is copied onto each transaction when it happens, so changing a deal (or a merchant's partner)
--   only affects NEW transactions. Reversed transactions earn nothing.
--   Payouts: finance records what was paid; due = earned − paid (partial payments allowed).
--   Partner IDs follow the number scheme: 4xxxxx (6 digits).
-- Visibility: admin, operations and finance. Only admin/operations change partners and deals; admin/finance pay.
-- Merchants never see partner data.

create sequence public.partner_code_seq minvalue 400001 maxvalue 499999 start with 400001;

create table public.partners (
  id            uuid primary key default gen_random_uuid(),
  partner_code  text not null unique default (nextval('public.partner_code_seq')::text) check (partner_code ~ '^4[0-9]{5}$'),
  name          text not null check (length(trim(name)) between 2 and 120),
  contact_name  text, contact_phone text, contact_email text,
  cut_type      text not null default 'percentage' check (cut_type in ('percentage', 'fixed')),
  cut_value     numeric(10,2) not null default 0 check (cut_value >= 0),
  status        text not null default 'active' check (status in ('active', 'paused')),
  notes         text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint partners_pct_max check (cut_type <> 'percentage' or cut_value <= 100)
);
alter table public.partners enable row level security;
create policy partners_read on public.partners for select using (public.is_staff(array['admin', 'operations', 'finance']));
create policy partners_insert on public.partners for insert with check (public.is_staff(array['admin', 'operations']));
create policy partners_update on public.partners for update using (public.is_staff(array['admin', 'operations'])) with check (public.is_staff(array['admin', 'operations']));
grant select, insert, update on public.partners to authenticated;
revoke delete, truncate on public.partners from anon, authenticated;

create or replace function public.touch_partner() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); new.partner_code := old.partner_code; return new; end $$;
create trigger touch_partner before update on public.partners for each row execute function public.touch_partner();
revoke execute on function public.touch_partner() from public, anon, authenticated;

alter table public.merchants add column partner_id uuid references public.partners(id) on delete set null;
create index merchants_partner_idx on public.merchants (partner_id) where partner_id is not null;

-- Only admin / operations may link a merchant to a partner (a commercial term, like commission)
create or replace function public.guard_merchant_update() returns trigger
language plpgsql set search_path = public as $$
declare v_system boolean := current_user in ('postgres', 'service_role', 'supabase_admin');
begin
  new.merchant_code := old.merchant_code;
  if not v_system and not public.is_staff(array['admin','operations']) then
    new.plan := old.plan;
    new.commission_pct := old.commission_pct;
    new.vat_enabled := old.vat_enabled;
    new.partner_id := old.partner_id;
    if not public.can_manage_merchant(old.id) then
      new.status := old.status;
      new.brand_type := old.brand_type;
    end if;
  end if;
  return new;
end $$;

-- ───────── What each transaction earns its partner (staff-only table) ─────────
create table public.partner_earnings (
  redemption_id uuid primary key references public.redemptions(id) on delete cascade,
  partner_id    uuid not null references public.partners(id) on delete cascade,
  merchant_id   uuid not null references public.merchants(id) on delete cascade,
  cut_type      text not null,
  cut_value     numeric(10,2) not null,
  commission    numeric(10,2) not null default 0,
  cut           numeric(10,2) not null default 0,
  created_at    timestamptz not null default now()
);
create index partner_earnings_partner_idx on public.partner_earnings (partner_id, created_at);
alter table public.partner_earnings enable row level security;
create policy partner_earnings_read on public.partner_earnings for select using (public.is_staff(array['admin', 'operations', 'finance']));
grant select on public.partner_earnings to authenticated;
revoke insert, update, delete, truncate on public.partner_earnings from anon, authenticated;

create or replace function public.partner_cut_for(p_type text, p_value numeric, p_commission numeric) returns numeric
language sql immutable as $$
  select greatest(0, case p_type
    when 'percentage' then round(coalesce(p_commission, 0) * coalesce(p_value, 0) / 100, 2)
    when 'fixed' then least(coalesce(p_value, 0), coalesce(p_commission, 0))
    else 0 end)
$$;

-- New transaction at a partner's merchant → record the partner's cut with today's deal
create or replace function public.record_partner_earning() returns trigger
language plpgsql security definer set search_path = public as $$
declare p partners;
begin
  select pa.* into p from merchants m join partners pa on pa.id = m.partner_id
   where m.id = new.merchant_id and pa.status = 'active';
  if found then
    insert into partner_earnings (redemption_id, partner_id, merchant_id, cut_type, cut_value, commission, cut)
    values (new.id, p.id, new.merchant_id, p.cut_type, p.cut_value, coalesce(new.commission_amount, 0),
            public.partner_cut_for(p.cut_type, p.cut_value, new.commission_amount));
  end if;
  return new;
end $$;
create trigger record_partner_earning after insert on public.redemptions
  for each row execute function public.record_partner_earning();
revoke execute on function public.record_partner_earning() from public, anon, authenticated;

-- If a transaction's commission is corrected later, its cut follows (same deal as when it happened)
create or replace function public.sync_partner_earning() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update partner_earnings e set commission = coalesce(new.commission_amount, 0),
         cut = public.partner_cut_for(e.cut_type, e.cut_value, new.commission_amount)
   where e.redemption_id = new.id;
  return new;
end $$;
create trigger sync_partner_earning after update of commission_amount on public.redemptions
  for each row when (old.commission_amount is distinct from new.commission_amount)
  execute function public.sync_partner_earning();
revoke execute on function public.sync_partner_earning() from public, anon, authenticated;

-- ───────── Payouts to partners ─────────
create table public.partner_payouts (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references public.partners(id) on delete cascade,
  amount      numeric(12,2) not null check (amount > 0),
  reference   text not null,
  note        text,
  paid_by     uuid references public.profiles(id) on delete set null,
  paid_at     timestamptz not null default now()
);
create index partner_payouts_partner_idx on public.partner_payouts (partner_id, paid_at);
alter table public.partner_payouts enable row level security;
create policy partner_payouts_read on public.partner_payouts for select using (public.is_staff(array['admin', 'operations', 'finance']));
grant select on public.partner_payouts to authenticated;
revoke insert, update, delete, truncate on public.partner_payouts from anon, authenticated;

-- Totals per partner (all time); reversed transactions earn nothing
create or replace function public.partner_balances(p_partner_id uuid default null)
returns table (partner_id uuid, partner_code text, name text, status text, cut_type text, cut_value numeric,
               merchants bigint, transactions bigint, gmv numeric, commission numeric, earned numeric,
               paid numeric, due numeric, last_paid_at timestamptz)
language sql stable security definer set search_path = public as $$
  with e as (
    select e.partner_id, count(*) n, sum(r.original_amount) gmv, sum(e.commission) commission, sum(e.cut) earned
      from partner_earnings e join redemptions r on r.id = e.redemption_id
     where r.status <> 'reversed' group by e.partner_id
  ), pay as (select partner_id, sum(amount) paid, max(paid_at) last_paid from partner_payouts group by partner_id)
  select p.id, p.partner_code, p.name, p.status, p.cut_type, p.cut_value,
         (select count(*) from merchants m where m.partner_id = p.id),
         coalesce(e.n, 0), coalesce(e.gmv, 0), coalesce(e.commission, 0), coalesce(e.earned, 0),
         coalesce(pay.paid, 0), coalesce(e.earned, 0) - coalesce(pay.paid, 0), pay.last_paid
    from partners p left join e on e.partner_id = p.id left join pay on pay.partner_id = p.id
   where public.is_staff(array['admin', 'operations', 'finance']) and (p_partner_id is null or p.id = p_partner_id)
   order by coalesce(e.earned, 0) - coalesce(pay.paid, 0) desc, p.name
$$;
revoke execute on function public.partner_balances(uuid) from public, anon;
grant execute on function public.partner_balances(uuid) to authenticated;

-- Record a payment to a partner (full or partial) — admin / finance only
create or replace function public.record_partner_payout(p_partner_id uuid, p_amount numeric, p_reference text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_due numeric;
begin
  if not public.is_staff(array['admin', 'finance']) then return jsonb_build_object('ok', false, 'error', 'not_allowed'); end if;
  if coalesce(trim(p_reference), '') = '' then return jsonb_build_object('ok', false, 'error', 'reference_required'); end if;
  perform 1 from partners where id = p_partner_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select due into v_due from public.partner_balances(p_partner_id);
  if p_amount is null then p_amount := v_due; end if;
  if p_amount <= 0 then return jsonb_build_object('ok', false, 'error', 'invalid_amount'); end if;
  if p_amount > v_due then return jsonb_build_object('ok', false, 'error', 'more_than_due', 'due', v_due); end if;
  insert into partner_payouts (partner_id, amount, reference, note, paid_by) values (p_partner_id, p_amount, trim(p_reference), nullif(trim(p_note), ''), auth.uid());
  return jsonb_build_object('ok', true, 'paid', p_amount, 'due', v_due - p_amount);
end $$;
revoke execute on function public.record_partner_payout(uuid, numeric, text, text) from public, anon;
grant execute on function public.record_partner_payout(uuid, numeric, text, text) to authenticated;

-- Money summary now shows partner cuts and Perkly's revenue after them (partner numbers only for admin/ops/finance)
create or replace function public.finance_summary(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_from timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 3650)));
        v_partners boolean := public.is_staff(array['admin', 'operations', 'finance']);
begin
  if not public.is_staff() then raise exception 'not allowed' using errcode = '42501'; end if;
  return (
    with r as (select * from redemptions where status <> 'reversed' and created_at >= v_from and public.can_see_merchant(merchant_id)),
         b as (select * from public.merchant_balances()),
         pc as (select coalesce(sum(e.cut), 0) cut from partner_earnings e join r on r.id = e.redemption_id)
    select jsonb_build_object(
      'transactions', (select count(*) from r),
      'gmv', (select coalesce(sum(original_amount), 0) from r),
      'discount', (select coalesce(sum(discount_amount), 0) from r),
      'paid', (select coalesce(sum(final_amount), 0) from r),
      'net_revenue', (select coalesce(sum(commission_amount), 0) from r),
      'vat', (select coalesce(sum(vat_amount), 0) from r),
      'merchant_net', (select coalesce(sum(merchant_net), 0) from r),
      'in_app_volume', (select coalesce(sum(final_amount), 0) from r where payment_method = 'in_app'),
      'partner_cuts', case when v_partners then (select cut from pc) else 0 end,
      'net_after_partners', (select coalesce(sum(commission_amount), 0) from r) - case when v_partners then (select cut from pc) else 0 end,
      'partners_due', case when v_partners then (select coalesce(sum(greatest(due, 0)), 0) from public.partner_balances()) else 0 end,
      'paid_to_merchants', (select coalesce(sum(paid_out), 0) from b),
      'to_be_paid_to_merchants', (select coalesce(sum(greatest(net_to_settle, 0)) + sum(greatest(pending_settlements, 0)), 0) from b),
      'owed_by_merchants', (select coalesce(-sum(least(net_to_settle, 0)) - sum(least(pending_settlements, 0)), 0) from b),
      'received_from_merchants', (select coalesce(sum(received_from_merchant), 0) from b)
    ));
end $$;

-- Partner IDs join the number scheme
create or replace function public.id_kind(p_code text) returns text
language sql immutable as $$
  select case
    when p_code ~ '^1[0-9]{7}$' then 'user'
    when p_code ~ '^2[0-9]{7}$' then 'student'
    when p_code ~ '^3[0-9]{5}$' then 'merchant'
    when p_code ~ '^4[0-9]{5}$' then 'partner'
    when p_code ~ '^9[0-9]{9}$' then 'transaction'
  end
$$;
