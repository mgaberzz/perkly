-- Overview dashboard numbers for any date range + filters, computed in the database (scales to millions of rows).
-- Same scope rules as everywhere: account managers only count their assigned merchants; reversed transactions excluded.
create index if not exists redemptions_created_at_idx on public.redemptions (created_at);

create or replace function public.dashboard_stats(
  p_from date, p_to date, p_merchant_id uuid default null, p_category text default null, p_city text default null,
  p_campus_id uuid default null, p_payment text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_from timestamptz := (p_from::timestamp at time zone 'Africa/Cairo');
        v_to   timestamptz := ((p_to + 1)::timestamp at time zone 'Africa/Cairo');
begin
  if not public.is_staff() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_to < p_from or p_to - p_from > 3700 then raise exception 'bad range'; end if;
  return (
    with r as (
      select r.created_at, r.user_id, r.merchant_id, r.original_amount, r.commission_amount, m.name as m_name
        from redemptions r
        join merchants m on m.id = r.merchant_id
        left join merchant_branches b on b.id = r.branch_id
       where r.status <> 'reversed' and r.created_at >= v_from and r.created_at < v_to
         and public.can_see_merchant(r.merchant_id)
         and (p_merchant_id is null or r.merchant_id = p_merchant_id)
         and (p_category is null or m.category = p_category)
         and (p_city is null or (p_city = 'online' and r.branch_id is null) or (p_city <> 'online' and b.city = p_city))
         and (p_campus_id is null or b.campus_id = p_campus_id)
         and (p_payment is null or r.payment_method = p_payment)
    )
    select jsonb_build_object(
      'transactions', (select count(*) from r),
      'gmv', (select coalesce(sum(original_amount), 0) from r),
      'commission', (select coalesce(sum(commission_amount), 0) from r),
      'students', (select count(distinct user_id) from r),
      'active_merchants', (select count(distinct merchant_id) from r),
      'by_day', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'count', n) order by d)
                            from (select (created_at at time zone 'Africa/Cairo')::date d, count(*) n from r group by 1) x), '[]'::jsonb),
      'top_merchants', coalesce((select jsonb_agg(jsonb_build_object('id', merchant_id, 'name', m_name, 'count', n) order by n desc, m_name)
                                   from (select merchant_id, max(m_name) m_name, count(*) n from r group by merchant_id order by 3 desc, 2 limit 5) x), '[]'::jsonb)
    ));
end $$;
revoke execute on function public.dashboard_stats(date, date, uuid, text, text, uuid, text) from public, anon;
grant execute on function public.dashboard_stats(date, date, uuid, text, text, uuid, text) to authenticated;
