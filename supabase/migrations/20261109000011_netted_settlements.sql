-- Netted settlements with partial payments.
-- Every transaction now carries:
--   merchant_net   = what the merchant keeps after Perkly commission (paid amount − commission)
--   settle_amount  = what must change hands for this transaction:
--                      paid in app  → +net      (Perkly pays the merchant)
--                      paid at cashier → −commission (the merchant owes Perkly its commission)
-- A settlement batch nets all unsettled transactions of a merchant. Finance records payments (full or partial);
-- each transaction's status follows its batch: Not settled yet → Partially settled → Settled.

-- ───────── Per-transaction amounts ─────────
create or replace function public.fill_merchant_net() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.merchant_net is null and new.final_amount is not null then
    new.merchant_net := new.final_amount - coalesce(new.commission_amount, 0);
  end if;
  return new;
end $$;
create trigger fill_merchant_net before insert on public.redemptions
  for each row execute function public.fill_merchant_net();
revoke execute on function public.fill_merchant_net() from public, anon, authenticated;

update public.redemptions set merchant_net = final_amount - coalesce(commission_amount, 0)
 where merchant_net is null and final_amount is not null;

alter table public.redemptions add column settle_amount numeric(10,2) generated always as (
  case when payment_method = 'in_app' then coalesce(final_amount, 0) - coalesce(commission_amount, 0)
       else -coalesce(commission_amount, 0) end) stored;

-- ───────── Settlements: partial payments ─────────
alter table public.settlements drop constraint settlements_status_check;
alter table public.settlements add constraint settlements_status_check check (status in ('pending','partially_paid','paid'));
alter table public.settlements add column paid_amount numeric(12,2) not null default 0;
update public.settlements set paid_amount = abs(amount) where status = 'paid';
comment on column public.settlements.amount is 'Net amount: positive = Perkly pays the merchant, negative = merchant pays Perkly';

create table public.settlement_payments (
  id            uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements(id) on delete cascade,
  amount        numeric(12,2) not null check (amount > 0),
  reference     text not null,
  paid_by       uuid references public.profiles(id) on delete set null,
  paid_at       timestamptz not null default now()
);
create index settlement_payments_settlement_idx on public.settlement_payments (settlement_id);
alter table public.settlement_payments enable row level security;
create policy settlement_payments_read on public.settlement_payments for select using (exists (
  select 1 from public.settlements s where s.id = settlement_id
     and (public.is_staff(array['admin','finance']) or public.can_see_merchant(s.merchant_id)
          or public.is_merchant_member(s.merchant_id, array['owner','manager']))));
grant select on public.settlement_payments to authenticated;
revoke insert, update, delete, truncate on public.settlement_payments from anon, authenticated;
insert into public.settlement_payments (settlement_id, amount, reference, paid_by, paid_at)
select id, abs(amount), coalesce(reference, 'migrated'), paid_by, coalesce(paid_at, now()) from public.settlements where status = 'paid' and amount <> 0;

-- Human-readable status for a transaction
create or replace function public.settlement_status_label(p_settlement_status text) returns text
language sql immutable as $$
  select case coalesce(p_settlement_status, 'none')
    when 'paid' then 'Settled' when 'partially_paid' then 'Partially settled' else 'Not settled yet' end
$$;
grant execute on function public.settlement_status_label(text) to authenticated;

-- ───────── Create batches: all unsettled transactions, netted per merchant ─────────
create or replace function public.create_settlements(p_until date default null, p_merchant_id uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_until date := coalesce(p_until, cairo_today()); v_m record; v_id uuid; v_n integer := 0; v_total numeric := 0;
begin
  if not public.is_staff(array['admin','finance']) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;
  for v_m in
    select merchant_id, min((created_at at time zone 'Africa/Cairo')::date) as first_day, count(*) as lines,
           coalesce(sum(final_amount) filter (where payment_method = 'in_app'), 0) as gross,
           coalesce(sum(commission_amount), 0) as commission, coalesce(sum(settle_amount), 0) as net
      from redemptions
     where settlement_id is null and status <> 'reversed'
       and (payment_method = 'merchant' or payment_status = 'paid')
       and (created_at at time zone 'Africa/Cairo')::date <= v_until
       and (p_merchant_id is null or merchant_id = p_merchant_id)
     group by merchant_id
  loop
    insert into settlements (merchant_id, period_start, period_end, gross_amount, commission, amount, lines, created_by,
                             status, paid_amount, paid_at)
    values (v_m.merchant_id, v_m.first_day, v_until, v_m.gross, v_m.commission, v_m.net, v_m.lines, auth.uid(),
            case when v_m.net = 0 then 'paid' else 'pending' end, 0, case when v_m.net = 0 then now() end)
    returning id into v_id;
    update redemptions set settlement_id = v_id
     where merchant_id = v_m.merchant_id and settlement_id is null and status <> 'reversed'
       and (payment_method = 'merchant' or payment_status = 'paid')
       and (created_at at time zone 'Africa/Cairo')::date <= v_until;
    v_n := v_n + 1; v_total := v_total + v_m.net;
  end loop;
  return jsonb_build_object('ok', true, 'settlements', v_n, 'total', v_total);
end $$;

-- ───────── Record a payment (full or partial) — only finance/admin ─────────
create or replace function public.record_settlement_payment(p_id uuid, p_amount numeric, p_reference text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_s settlements; v_remaining numeric; v_pay numeric;
begin
  if not public.is_staff(array['admin','finance']) then return jsonb_build_object('ok', false, 'error', 'not_allowed'); end if;
  if coalesce(trim(p_reference), '') = '' then return jsonb_build_object('ok', false, 'error', 'reference_required'); end if;
  select * into v_s from settlements where id = p_id for update;
  if not found or v_s.status = 'paid' then return jsonb_build_object('ok', false, 'error', 'not_pending'); end if;
  v_remaining := abs(v_s.amount) - v_s.paid_amount;
  v_pay := coalesce(p_amount, v_remaining);
  if v_pay <= 0 then return jsonb_build_object('ok', false, 'error', 'invalid_amount'); end if;
  if v_pay > v_remaining then return jsonb_build_object('ok', false, 'error', 'more_than_remaining', 'remaining', v_remaining); end if;
  insert into settlement_payments (settlement_id, amount, reference, paid_by) values (p_id, v_pay, trim(p_reference), auth.uid());
  update settlements set paid_amount = paid_amount + v_pay,
         status = case when paid_amount + v_pay >= abs(amount) then 'paid' else 'partially_paid' end,
         reference = trim(p_reference), paid_by = auth.uid(), paid_at = now()
   where id = p_id;
  return jsonb_build_object('ok', true, 'paid', v_pay, 'remaining', v_remaining - v_pay,
                            'status', case when v_pay >= v_remaining then 'paid' else 'partially_paid' end);
end $$;
revoke execute on function public.record_settlement_payment(uuid, numeric, text) from public, anon;
grant execute on function public.record_settlement_payment(uuid, numeric, text) to authenticated;

-- Pay the whole remaining amount (kept for the existing "Mark paid" button)
create or replace function public.mark_settlement_paid(p_id uuid, p_reference text) returns jsonb
language sql security definer set search_path = public as $$
  select public.record_settlement_payment(p_id, null, p_reference)
$$;

-- ───────── Balances: netted ─────────
drop function public.merchant_balances(uuid);
create or replace function public.merchant_balances(p_merchant_id uuid default null)
returns table (merchant_id uuid, merchant_code text, merchant_name text, brand_type text,
               in_app_gross numeric, in_app_commission numeric, due_to_merchant numeric,
               cashier_sales numeric, commission_owed numeric, net_to_settle numeric,
               pending_settlements numeric, paid_out numeric, received_from_merchant numeric,
               last_paid_at timestamptz, bank_name text, iban text)
language sql stable security definer set search_path = public as $$
  with u as (  -- unsettled transactions
    select * from redemptions where settlement_id is null and status <> 'reversed'
       and (payment_method = 'merchant' or payment_status = 'paid')
  )
  select m.id, m.merchant_code, m.name, m.brand_type,
         coalesce((select sum(final_amount) from u where u.merchant_id = m.id and payment_method = 'in_app'), 0),
         coalesce((select sum(commission_amount) from u where u.merchant_id = m.id and payment_method = 'in_app'), 0),
         coalesce((select sum(settle_amount) from u where u.merchant_id = m.id and payment_method = 'in_app'), 0),
         coalesce((select sum(final_amount) from u where u.merchant_id = m.id and payment_method = 'merchant'), 0),
         coalesce((select sum(commission_amount) from u where u.merchant_id = m.id and payment_method = 'merchant'), 0),
         coalesce((select sum(settle_amount) from u where u.merchant_id = m.id), 0),
         coalesce((select sum(sign(s.amount) * (abs(s.amount) - s.paid_amount)) from settlements s where s.merchant_id = m.id and s.status <> 'paid'), 0),
         coalesce((select sum(s.paid_amount) from settlements s where s.merchant_id = m.id and s.amount > 0), 0),
         coalesce((select sum(s.paid_amount) from settlements s where s.merchant_id = m.id and s.amount < 0), 0),
         (select max(s.paid_at) from settlements s where s.merchant_id = m.id and s.paid_amount > 0),
         case when public.is_staff(array['admin','finance']) or public.is_merchant_member(m.id, array['owner','manager']) then a.bank_name end,
         case when public.is_staff(array['admin','finance']) or public.is_merchant_member(m.id, array['owner','manager']) then a.iban end
    from merchants m
    left join merchant_bank_accounts a on a.merchant_id = m.id
   where (p_merchant_id is null or m.id = p_merchant_id)
     and (public.is_staff(array['admin','finance']) or public.can_see_merchant(m.id) or public.is_merchant_member(m.id))
$$;
revoke execute on function public.merchant_balances(uuid) from public, anon;
grant execute on function public.merchant_balances(uuid) to authenticated;
