-- Daily series for the Insights charts: one row per day and dimension key (same grouping as insights()).
create or replace function public.insights_series(p_dimension text, p_days integer default 30)
returns table (day date, key text, transactions bigint, gmv numeric, paid numeric, commission numeric, vat numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_from timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 3650)));
begin
  if not public.is_staff() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_dimension not in ('sector','location','campus','age','merchant') then raise exception 'unknown dimension'; end if;
  return query
  select (r.created_at at time zone 'Africa/Cairo')::date,
         case p_dimension
           when 'sector' then m.category
           when 'location' then coalesce(nullif(b.city, ''), case when r.branch_id is null then 'online' else 'unknown' end)
           when 'campus' then coalesce(b.campus_id::text, 'none')
           when 'age' then public.age_bucket(p.birth_date)
           else r.merchant_id::text end,
         count(*), coalesce(sum(r.original_amount), 0), coalesce(sum(r.final_amount), 0),
         coalesce(sum(r.commission_amount), 0), coalesce(sum(r.vat_amount), 0)
    from redemptions r
    join merchants m on m.id = r.merchant_id
    left join merchant_branches b on b.id = r.branch_id
    left join profiles p on p.id = r.user_id
   where r.status <> 'reversed' and r.created_at >= v_from and public.can_see_merchant(r.merchant_id)
   group by 1, 2
   order by 1;
end $$;
revoke execute on function public.insights_series(text, integer) from public, anon;
grant execute on function public.insights_series(text, integer) to authenticated;
