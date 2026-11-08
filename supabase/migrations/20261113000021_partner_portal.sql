-- Partner portal: partners log in and see ONLY their own onboarded merchants, the transactions at those
-- merchants, what they earned and what Perkly paid them. No student details are ever shown to partners,
-- and they get no direct access to the transactions table — only through the partner_* functions below.

create table public.partner_members (
  partner_id uuid not null references public.partners(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (partner_id, user_id)
);
create index partner_members_user_idx on public.partner_members (user_id);
alter table public.partner_members enable row level security;
create policy partner_members_read on public.partner_members for select
  using (user_id = (select auth.uid()) or public.is_staff(array['admin', 'operations', 'finance']));
grant select on public.partner_members to authenticated;
revoke insert, update, delete, truncate on public.partner_members from anon, authenticated;  -- managed by the portal server

create or replace function public.is_partner_member(p_partner_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from partner_members where partner_id = p_partner_id and user_id = auth.uid())
$$;
grant execute on function public.is_partner_member(uuid) to authenticated;

-- partners can read their own partner record, earnings and payouts (extra rules; staff rules stay as they are)
create policy partners_read_member on public.partners for select using (public.is_partner_member(id));
create policy partner_earnings_read_member on public.partner_earnings for select using (public.is_partner_member(partner_id));
create policy partner_payouts_read_member on public.partner_payouts for select using (public.is_partner_member(partner_id));

-- balances: staff see all, a partner sees only their own
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
   where (public.is_staff(array['admin', 'operations', 'finance']) or public.is_partner_member(p.id))
     and (p_partner_id is null or p.id = p_partner_id)
   order by coalesce(e.earned, 0) - coalesce(pay.paid, 0) desc, p.name
$$;

-- The partner's merchants with totals (only transactions that earned the partner a cut count)
create or replace function public.partner_merchants(p_partner_id uuid)
returns table (merchant_id uuid, merchant_code text, name text, category text, status text, city text, linked_at timestamptz,
               transactions bigint, gmv numeric, commission numeric, earned numeric, last_transaction_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.id, m.merchant_code, m.name, m.category, m.status,
         (select b.city from merchant_branches b where b.merchant_id = m.id and b.city is not null order by b.created_at limit 1),
         m.created_at,
         count(e.redemption_id) filter (where r.status <> 'reversed'),
         coalesce(sum(r.original_amount) filter (where r.status <> 'reversed'), 0),
         coalesce(sum(e.commission) filter (where r.status <> 'reversed'), 0),
         coalesce(sum(e.cut) filter (where r.status <> 'reversed'), 0),
         max(r.created_at)
    from merchants m
    left join partner_earnings e on e.merchant_id = m.id and e.partner_id = p_partner_id
    left join redemptions r on r.id = e.redemption_id
   where m.partner_id = p_partner_id
     and (public.is_staff(array['admin', 'operations', 'finance']) or public.is_partner_member(p_partner_id))
   group by m.id
   order by 11 desc, m.name
$$;
revoke execute on function public.partner_merchants(uuid) from public, anon;
grant execute on function public.partner_merchants(uuid) to authenticated;

-- Transactions that earned the partner a cut — no student information
create or replace function public.partner_transactions(p_partner_id uuid, p_days integer default 90, p_merchant_id uuid default null)
returns table (tx_code text, created_at timestamptz, merchant_id uuid, merchant_name text, branch_name text, channel text,
               gmv numeric, discount numeric, paid numeric, commission numeric, cut_type text, cut_value numeric, cut numeric, status text)
language sql stable security definer set search_path = public as $$
  select r.tx_code, r.created_at, m.id, m.name, coalesce(b.name, 'Online'), r.channel,
         r.original_amount, r.discount_amount, r.final_amount, e.commission, e.cut_type, e.cut_value,
         case when r.status = 'reversed' then 0 else e.cut end,
         case when r.status = 'reversed' then 'reversed' else 'success' end
    from partner_earnings e
    join redemptions r on r.id = e.redemption_id
    join merchants m on m.id = e.merchant_id
    left join merchant_branches b on b.id = r.branch_id
   where e.partner_id = p_partner_id
     and (public.is_staff(array['admin', 'operations', 'finance']) or public.is_partner_member(p_partner_id))
     and r.created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 90), 3650)))
     and (p_merchant_id is null or e.merchant_id = p_merchant_id)
   order by r.created_at desc
   limit 2000
$$;
revoke execute on function public.partner_transactions(uuid, integer, uuid) from public, anon;
grant execute on function public.partner_transactions(uuid, integer, uuid) to authenticated;
