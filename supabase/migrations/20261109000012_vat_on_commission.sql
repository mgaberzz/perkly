-- 14% VAT on Perkly's commission (Egypt). Per transaction:
--   commission_amount = paid × commission %
--   vat_amount        = commission × VAT %            (setting app_settings 'tax'.vat_pct, default 14)
--   merchant_net      = paid − commission − VAT       ← the settlement amount for the merchant
--   settle_amount     = cash that must move:
--                         paid in app     → +merchant_net        (Perkly pays the merchant)
--                         paid at cashier → −(commission + VAT)  (merchant already holds the money, pays Perkly its fee)

insert into public.app_settings (key, value) values ('tax', '{"vat_pct": 14}')
on conflict (key) do nothing;

create or replace function public.vat_pct() returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select (value->>'vat_pct')::numeric from app_settings where key = 'tax'), 14)
$$;
grant execute on function public.vat_pct() to authenticated;

alter table public.redemptions add column vat_amount numeric(10,2);
update public.redemptions set vat_amount = round(coalesce(commission_amount, 0) * public.vat_pct() / 100, 2);
update public.redemptions set merchant_net = final_amount - coalesce(commission_amount, 0) - coalesce(vat_amount, 0)
 where final_amount is not null;

-- Every new transaction: VAT + merchant net calculated the same way
create or replace function public.fill_merchant_net() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.vat_amount is null then
    new.vat_amount := round(coalesce(new.commission_amount, 0) * public.vat_pct() / 100, 2);
  end if;
  new.merchant_net := case when new.final_amount is null then null
                           else new.final_amount - coalesce(new.commission_amount, 0) - coalesce(new.vat_amount, 0) end;
  return new;
end $$;

alter table public.redemptions drop column settle_amount;
alter table public.redemptions add column settle_amount numeric(10,2) generated always as (
  case when payment_method = 'in_app'
       then coalesce(final_amount, 0) - coalesce(commission_amount, 0) - coalesce(vat_amount, 0)
       else -(coalesce(commission_amount, 0) + coalesce(vat_amount, 0)) end) stored;

-- Settlements carry the VAT total too
alter table public.settlements add column vat numeric(12,2) not null default 0;

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
           coalesce(sum(commission_amount), 0) as commission, coalesce(sum(vat_amount), 0) as vat,
           coalesce(sum(settle_amount), 0) as net
      from redemptions
     where settlement_id is null and status <> 'reversed'
       and (payment_method = 'merchant' or payment_status = 'paid')
       and (created_at at time zone 'Africa/Cairo')::date <= v_until
       and (p_merchant_id is null or merchant_id = p_merchant_id)
     group by merchant_id
  loop
    insert into settlements (merchant_id, period_start, period_end, gross_amount, commission, vat, amount, lines, created_by,
                             status, paid_amount, paid_at)
    values (v_m.merchant_id, v_m.first_day, v_until, v_m.gross, v_m.commission, v_m.vat, v_m.net, v_m.lines, auth.uid(),
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

-- Balances: add the VAT on unsettled commission
drop function public.merchant_balances(uuid);
create or replace function public.merchant_balances(p_merchant_id uuid default null)
returns table (merchant_id uuid, merchant_code text, merchant_name text, brand_type text,
               in_app_gross numeric, in_app_commission numeric, due_to_merchant numeric,
               cashier_sales numeric, commission_owed numeric, vat numeric, net_to_settle numeric,
               pending_settlements numeric, paid_out numeric, received_from_merchant numeric,
               last_paid_at timestamptz, bank_name text, iban text)
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
