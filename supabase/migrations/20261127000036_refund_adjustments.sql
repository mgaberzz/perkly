-- Refund follow-ups.
-- 1) When a refunded transaction was already inside a settlement, an adjustment is recorded and the next settlement
--    for that merchant includes it automatically:
--      paid at the cashier → the merchant already paid (or owes) commission + VAT on it → Perkly credits it back  (+)
--      paid in the app     → Perkly already paid the merchant its share                 → the merchant returns it (−)
--    In both cases the adjustment is the opposite of the transaction's settle_amount.
-- 2) Admins change the refund window (days) from the portal.

create table public.settlement_adjustments (
  id            uuid primary key default gen_random_uuid(),
  merchant_id   uuid not null references public.merchants(id) on delete cascade,
  redemption_id uuid not null unique references public.redemptions(id) on delete cascade,
  refund_id     uuid references public.refund_requests(id) on delete set null,
  amount        numeric(12,2) not null,   -- + Perkly owes the merchant · − the merchant owes Perkly
  reason        text not null,
  settlement_id uuid references public.settlements(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index settlement_adjustments_merchant_idx on public.settlement_adjustments (merchant_id) where settlement_id is null;
create index settlement_adjustments_settlement_idx on public.settlement_adjustments (settlement_id);
create index settlement_adjustments_refund_idx on public.settlement_adjustments (refund_id);
alter table public.settlement_adjustments enable row level security;
create policy settlement_adjustments_read on public.settlement_adjustments for select to authenticated using (
  public.is_staff(array['admin', 'finance']) or public.can_see_merchant(merchant_id) or public.is_merchant_member(merchant_id, array['owner', 'manager'])
);
revoke all on public.settlement_adjustments from anon, authenticated;
grant select on public.settlement_adjustments to authenticated;

alter table public.settlements add column if not exists adjustments numeric(12,2) not null default 0;

-- Record the adjustment when a refund on an already-settled transaction is approved
create or replace function public.record_refund_adjustment() returns trigger
language plpgsql security definer set search_path = public as $$
declare v redemptions;
begin
  if new.status = 'approved' and old.status = 'pending' then
    select * into v from redemptions where id = new.redemption_id;
    if v.settlement_id is not null and coalesce(v.settle_amount, 0) <> 0 then
      insert into settlement_adjustments (merchant_id, redemption_id, refund_id, amount, reason)
      values (new.merchant_id, new.redemption_id, new.id, -v.settle_amount, 'Refund ' || new.refund_code)
      on conflict (redemption_id) do nothing;
    end if;
  end if;
  return null;
end $$;
create trigger record_refund_adjustment after update of status on public.refund_requests
  for each row execute function public.record_refund_adjustment();
revoke execute on function public.record_refund_adjustment() from public, anon, authenticated;

-- Settlements now include open adjustments (a merchant with only an adjustment still gets a settlement)
create or replace function public.create_settlements(p_until date default null, p_merchant_id uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_until date := coalesce(p_until, cairo_today()); v_m record; v_id uuid; v_n integer := 0; v_total numeric := 0; v_amount numeric;
begin
  if not public.is_staff(array['admin','finance']) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;
  for v_m in
    with r as (
      select merchant_id, min((created_at at time zone 'Africa/Cairo')::date) as first_day, count(*) as lines,
             coalesce(sum(final_amount) filter (where payment_method = 'in_app'), 0) as gross,
             coalesce(sum(commission_amount), 0) as commission, coalesce(sum(vat_amount), 0) as vat,
             coalesce(sum(settle_amount), 0) as net
        from redemptions
       where settlement_id is null and status <> 'reversed'
         and (payment_method = 'merchant' or payment_status = 'paid')
         and (created_at at time zone 'Africa/Cairo')::date <= v_until
         and (p_merchant_id is null or merchant_id = p_merchant_id)
       group by merchant_id
    ), a as (
      select merchant_id, sum(amount) as adj, min((created_at at time zone 'Africa/Cairo')::date) as first_day
        from settlement_adjustments
       where settlement_id is null and (created_at at time zone 'Africa/Cairo')::date <= v_until
         and (p_merchant_id is null or merchant_id = p_merchant_id)
       group by merchant_id
    )
    select coalesce(r.merchant_id, a.merchant_id) as merchant_id, least(r.first_day, a.first_day) as first_day,
           coalesce(r.lines, 0) as lines, coalesce(r.gross, 0) as gross, coalesce(r.commission, 0) as commission,
           coalesce(r.vat, 0) as vat, coalesce(r.net, 0) as net, coalesce(a.adj, 0) as adj
      from r full join a on a.merchant_id = r.merchant_id
  loop
    v_amount := v_m.net + v_m.adj;
    insert into settlements (merchant_id, period_start, period_end, gross_amount, commission, vat, adjustments, amount, lines, created_by,
                             status, paid_amount, paid_at)
    values (v_m.merchant_id, v_m.first_day, v_until, v_m.gross, v_m.commission, v_m.vat, v_m.adj, v_amount, v_m.lines, auth.uid(),
            case when v_amount = 0 then 'paid' else 'pending' end, 0, case when v_amount = 0 then now() end)
    returning id into v_id;
    update redemptions set settlement_id = v_id
     where merchant_id = v_m.merchant_id and settlement_id is null and status <> 'reversed'
       and (payment_method = 'merchant' or payment_status = 'paid')
       and (created_at at time zone 'Africa/Cairo')::date <= v_until;
    update settlement_adjustments set settlement_id = v_id
     where merchant_id = v_m.merchant_id and settlement_id is null and (created_at at time zone 'Africa/Cairo')::date <= v_until;
    v_n := v_n + 1; v_total := v_total + v_amount;
  end loop;
  return jsonb_build_object('ok', true, 'settlements', v_n, 'total', v_total);
end $$;

-- Balances: "net to settle" includes open adjustments
create or replace function public.merchant_balances(p_merchant_id uuid default null)
returns table(merchant_id uuid, merchant_code text, merchant_name text, brand_type text, in_app_gross numeric, in_app_commission numeric, due_to_merchant numeric, cashier_sales numeric, commission_owed numeric, vat numeric, net_to_settle numeric, pending_settlements numeric, paid_out numeric, received_from_merchant numeric, last_paid_at timestamptz, bank_name text, iban text)
language sql stable security definer set search_path = public as $$
  with u as (
    select * from redemptions where settlement_id is null and status <> 'reversed'
       and (payment_method = 'merchant' or payment_status = 'paid')
  )
  select m.id, m.merchant_code, m.name, m.brand_type,
         coalesce((select sum(final_amount) from u where u.merchant_id = m.id and payment_method = 'in_app'), 0),
         coalesce((select sum(commission_amount) from u where u.merchant_id = m.id and payment_method = 'in_app'), 0),
         coalesce((select sum(settle_amount) from u where u.merchant_id = m.id and payment_method = 'in_app'), 0),
         coalesce((select sum(final_amount) from u where u.merchant_id = m.id and payment_method = 'merchant'), 0),
         coalesce((select sum(commission_amount) from u where u.merchant_id = m.id and payment_method = 'merchant'), 0),
         coalesce((select sum(vat_amount) from u where u.merchant_id = m.id), 0),
         coalesce((select sum(settle_amount) from u where u.merchant_id = m.id), 0)
           + coalesce((select sum(a.amount) from settlement_adjustments a where a.merchant_id = m.id and a.settlement_id is null), 0),
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

-- Refund window, set by Admins
create or replace function public.set_refund_window(p_days int) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then return jsonb_build_object('ok', false, 'error', 'not_allowed'); end if;
  if p_days is null or p_days not between 1 and 60 then return jsonb_build_object('ok', false, 'error', 'bad_days'); end if;
  insert into app_settings (key, value) values ('refunds', jsonb_build_object('window_days', p_days))
  on conflict (key) do update set value = app_settings.value || jsonb_build_object('window_days', p_days), updated_at = now();
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.set_refund_window(int) from public, anon;
grant execute on function public.set_refund_window(int) to authenticated;
