-- Profitability insights + platform money summary for the Perkly team portal.
-- Scope follows the viewer: admin/operations/finance see all merchants, account managers only theirs.

-- Age bucket from a birth date (Cairo today)
create or replace function public.age_bucket(p_birth date) returns text
language sql stable as $$
  select case
    when p_birth is null then 'unknown'
    when date_part('year', age(cairo_today(), p_birth)) < 18 then 'u18'
    when date_part('year', age(cairo_today(), p_birth)) <= 20 then '18-20'
    when date_part('year', age(cairo_today(), p_birth)) <= 23 then '21-23'
    when date_part('year', age(cairo_today(), p_birth)) <= 26 then '24-26'
    else '27+' end
$$;
grant execute on function public.age_bucket(date) to authenticated;

-- Profitability by dimension: sector | location | campus | age | merchant
create or replace function public.insights(p_dimension text, p_days integer default 30)
returns table (key text, label text, transactions bigint, students bigint, gmv numeric, discount numeric, paid numeric,
               commission numeric, vat numeric, merchant_net numeric, avg_ticket numeric, margin_pct numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_from timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 3650)));
begin
  if not public.is_staff() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_dimension not in ('sector','location','campus','age','merchant') then raise exception 'unknown dimension'; end if;
  return query
  with r as (
    select r.*, m.name as m_name, m.category, b.city, b.campus_id as b_campus, p.birth_date
      from redemptions r
      join merchants m on m.id = r.merchant_id
      left join merchant_branches b on b.id = r.branch_id
      left join profiles p on p.id = r.user_id
     where r.status <> 'reversed' and r.created_at >= v_from and public.can_see_merchant(r.merchant_id)
  ), k as (
    select case p_dimension
             when 'sector' then r.category
             when 'location' then coalesce(nullif(r.city, ''), case when r.branch_id is null then 'online' else 'unknown' end)
             when 'campus' then coalesce(r.b_campus::text, 'none')
             when 'age' then public.age_bucket(r.birth_date)
             else r.merchant_id::text end as k, r.*
      from r
  )
  select k.k,
         case p_dimension
           when 'campus' then coalesce((select coalesce(c.short_name, c.name) from campuses c where c.id::text = k.k), 'No campus')
           when 'merchant' then max(k.m_name)
           when 'location' then case k.k when 'online' then 'Online' when 'unknown' then 'Unknown' else k.k end
           when 'age' then case k.k when 'u18' then 'Under 18' when 'unknown' then 'Unknown' else k.k end
           else k.k end,
         count(*), count(distinct k.user_id),
         coalesce(sum(k.original_amount), 0), coalesce(sum(k.discount_amount), 0), coalesce(sum(k.final_amount), 0),
         coalesce(sum(k.commission_amount), 0), coalesce(sum(k.vat_amount), 0), coalesce(sum(k.merchant_net), 0),
         coalesce(round(avg(k.original_amount), 2), 0),
         case when coalesce(sum(k.final_amount), 0) = 0 then 0 else round(100 * sum(k.commission_amount) / sum(k.final_amount), 1) end
    from k
   group by k.k
   order by 8 desc, 3 desc;
end $$;
revoke execute on function public.insights(text, integer) from public, anon;
grant execute on function public.insights(text, integer) to authenticated;

-- Platform money summary (period numbers + all-time dues)
create or replace function public.finance_summary(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_from timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 3650)));
begin
  if not public.is_staff() then raise exception 'not allowed' using errcode = '42501'; end if;
  return (
    with r as (select * from redemptions where status <> 'reversed' and created_at >= v_from and public.can_see_merchant(merchant_id)),
         b as (select * from public.merchant_balances())
    select jsonb_build_object(
      'transactions', (select count(*) from r),
      'gmv', (select coalesce(sum(original_amount), 0) from r),
      'discount', (select coalesce(sum(discount_amount), 0) from r),
      'paid', (select coalesce(sum(final_amount), 0) from r),
      'net_revenue', (select coalesce(sum(commission_amount), 0) from r),
      'vat', (select coalesce(sum(vat_amount), 0) from r),
      'merchant_net', (select coalesce(sum(merchant_net), 0) from r),
      'in_app_volume', (select coalesce(sum(final_amount), 0) from r where payment_method = 'in_app'),
      -- dues (all time, current state)
      'paid_to_merchants', (select coalesce(sum(paid_out), 0) from b),
      'to_be_paid_to_merchants', (select coalesce(sum(greatest(net_to_settle, 0)) + sum(greatest(pending_settlements, 0)), 0) from b),
      'owed_by_merchants', (select coalesce(-sum(least(net_to_settle, 0)) - sum(least(pending_settlements, 0)), 0) from b),
      'received_from_merchants', (select coalesce(sum(received_from_merchant), 0) from b)
    ));
end $$;
revoke execute on function public.finance_summary(integer) from public, anon;
grant execute on function public.finance_summary(integer) to authenticated;
