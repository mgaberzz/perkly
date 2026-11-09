-- Insights for any date range (MTD, YTD, custom) with the same filters as the Overview,
-- plus push notifications to several campuses at once.

-- ───────── Filtered transactions (shared by the insights functions) ─────────
create or replace function public.insights_base(
  p_from date, p_to date, p_merchant_id uuid default null, p_category text default null, p_city text default null,
  p_campus_id uuid default null, p_payment text default null)
returns table (id uuid, created_at timestamptz, user_id uuid, merchant_id uuid, branch_id uuid,
               original_amount numeric, discount_amount numeric, final_amount numeric, commission_amount numeric,
               vat_amount numeric, merchant_net numeric, first_time_at_merchant boolean,
               category text, m_name text, city text, b_campus uuid, birth_date date)
language plpgsql stable security definer set search_path = public as $$
declare v_from timestamptz := (p_from::timestamp at time zone 'Africa/Cairo');
        v_to   timestamptz := ((p_to + 1)::timestamp at time zone 'Africa/Cairo');
begin
  if not public.is_staff() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_to < p_from or p_to - p_from > 3700 then raise exception 'bad range'; end if;
  return query
  select r.id, r.created_at, r.user_id, r.merchant_id, r.branch_id,
         r.original_amount, r.discount_amount, r.final_amount, r.commission_amount, r.vat_amount, r.merchant_net, r.first_time_at_merchant,
         m.category, m.name, b.city, b.campus_id, p.birth_date
    from redemptions r
    join merchants m on m.id = r.merchant_id
    left join merchant_branches b on b.id = r.branch_id
    left join profiles p on p.id = r.user_id
   where r.status <> 'reversed' and r.created_at >= v_from and r.created_at < v_to
     and public.can_see_merchant(r.merchant_id)
     and (p_merchant_id is null or r.merchant_id = p_merchant_id)
     and (p_category is null or m.category = p_category)
     and (p_city is null or (p_city = 'online' and r.branch_id is null) or (p_city <> 'online' and b.city = p_city))
     and (p_campus_id is null or b.campus_id = p_campus_id)
     and (p_payment is null or r.payment_method = p_payment);
end $$;
revoke all on function public.insights_base(date, date, uuid, text, text, uuid, text) from public, anon;
grant execute on function public.insights_base(date, date, uuid, text, text, uuid, text) to authenticated;

create or replace function public.insights_key(p_dimension text, p_category text, p_city text, p_branch uuid, p_campus uuid, p_birth date, p_merchant uuid)
returns text language sql immutable as $$
  select case p_dimension
    when 'sector' then p_category
    when 'location' then coalesce(nullif(p_city, ''), case when p_branch is null then 'online' else 'unknown' end)
    when 'campus' then coalesce(p_campus::text, 'none')
    when 'age' then public.age_bucket(p_birth)
    else p_merchant::text end
$$;

-- Totals for the range, and the same numbers for the period just before it (for "vs previous period")
create or replace function public.insights_range_summary(
  p_from date, p_to date, p_merchant_id uuid default null, p_category text default null, p_city text default null,
  p_campus_id uuid default null, p_payment text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_len int := p_to - p_from + 1;
begin
  return (
    with cur as (select * from public.insights_base(p_from, p_to, p_merchant_id, p_category, p_city, p_campus_id, p_payment)),
         prev as (select * from public.insights_base(p_from - v_len, p_from - 1, p_merchant_id, p_category, p_city, p_campus_id, p_payment)),
         firsts as (select user_id, min(created_at) first_at from redemptions where status <> 'reversed' group by user_id)
    select jsonb_build_object(
      'transactions', (select count(*) from cur),
      'gmv', (select coalesce(sum(original_amount), 0) from cur),
      'discount', (select coalesce(sum(discount_amount), 0) from cur),
      'paid', (select coalesce(sum(final_amount), 0) from cur),
      'net_revenue', (select coalesce(sum(commission_amount), 0) from cur),
      'vat', (select coalesce(sum(vat_amount), 0) from cur),
      'students', (select count(distinct user_id) from cur),
      'new_students', (select count(distinct c.user_id) from cur c join firsts f on f.user_id = c.user_id
                        where f.first_at >= (p_from::timestamp at time zone 'Africa/Cairo')),
      'active_merchants', (select count(distinct merchant_id) from cur),
      'avg_ticket', (select coalesce(round(avg(original_amount), 2), 0) from cur),
      'partner_cuts', (select coalesce(sum(e.cut), 0) from cur c join partner_earnings e on e.redemption_id = c.id),
      'prev', jsonb_build_object(
        'transactions', (select count(*) from prev),
        'gmv', (select coalesce(sum(original_amount), 0) from prev),
        'net_revenue', (select coalesce(sum(commission_amount), 0) from prev),
        'students', (select count(distinct user_id) from prev),
        'active_merchants', (select count(distinct merchant_id) from prev),
        'avg_ticket', (select coalesce(round(avg(original_amount), 2), 0) from prev))
    ));
end $$;
revoke all on function public.insights_range_summary(date, date, uuid, text, text, uuid, text) from public, anon;
grant execute on function public.insights_range_summary(date, date, uuid, text, text, uuid, text) to authenticated;

create or replace function public.insights_range(
  p_dimension text, p_from date, p_to date, p_merchant_id uuid default null, p_category text default null, p_city text default null,
  p_campus_id uuid default null, p_payment text default null)
returns table (key text, label text, transactions bigint, students bigint, gmv numeric, discount numeric, paid numeric,
               commission numeric, vat numeric, merchant_net numeric, avg_ticket numeric, margin_pct numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_dimension not in ('sector','location','campus','age','merchant') then raise exception 'unknown dimension'; end if;
  return query
  with k as (
    select public.insights_key(p_dimension, r.category, r.city, r.branch_id, r.b_campus, r.birth_date, r.merchant_id) as k, r.*
      from public.insights_base(p_from, p_to, p_merchant_id, p_category, p_city, p_campus_id, p_payment) r
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
revoke all on function public.insights_range(text, date, date, uuid, text, text, uuid, text) from public, anon;
grant execute on function public.insights_range(text, date, date, uuid, text, text, uuid, text) to authenticated;

create or replace function public.insights_range_series(
  p_dimension text, p_from date, p_to date, p_merchant_id uuid default null, p_category text default null, p_city text default null,
  p_campus_id uuid default null, p_payment text default null)
returns table (day date, key text, transactions bigint, gmv numeric, paid numeric, commission numeric, vat numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_dimension not in ('sector','location','campus','age','merchant') then raise exception 'unknown dimension'; end if;
  return query
  select (r.created_at at time zone 'Africa/Cairo')::date,
         public.insights_key(p_dimension, r.category, r.city, r.branch_id, r.b_campus, r.birth_date, r.merchant_id),
         count(*), coalesce(sum(r.original_amount), 0), coalesce(sum(r.final_amount), 0),
         coalesce(sum(r.commission_amount), 0), coalesce(sum(r.vat_amount), 0)
    from public.insights_base(p_from, p_to, p_merchant_id, p_category, p_city, p_campus_id, p_payment) r
   group by 1, 2
   order by 1;
end $$;
revoke all on function public.insights_range_series(text, date, date, uuid, text, text, uuid, text) from public, anon;
grant execute on function public.insights_range_series(text, date, date, uuid, text, text, uuid, text) to authenticated;

-- ───────── Push notifications to several campuses ─────────
alter table public.broadcasts add column if not exists campus_ids uuid[];

create or replace function public.broadcast_audience_campuses(p_campus_ids uuid[] default null) returns integer
language sql stable security definer set search_path = public as $$
  select case when public.is_staff(array['admin', 'operations']) then
    (select count(*)::int from profiles p
      where p.role = 'student' and p.status = 'active' and p.deleted_at is null and p.marketing_opt_in
        and (coalesce(cardinality(p_campus_ids), 0) = 0 or p.campus_id = any(p_campus_ids)))
  end
$$;
revoke all on function public.broadcast_audience_campuses(uuid[]) from public, anon;
grant execute on function public.broadcast_audience_campuses(uuid[]) to authenticated;

create or replace function public.send_broadcast_campuses(
  p_title text, p_body text, p_title_ar text default null, p_body_ar text default null,
  p_campus_ids uuid[] default null, p_perk_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_n integer; v_url text; v_all boolean := coalesce(cardinality(p_campus_ids), 0) = 0;
begin
  if not is_staff(array['admin', 'operations']) then return jsonb_build_object('ok', false, 'error', 'not_allowed'); end if;
  p_title := trim(coalesce(p_title, '')); p_body := trim(coalesce(p_body, ''));
  p_title_ar := nullif(trim(coalesce(p_title_ar, '')), ''); p_body_ar := nullif(trim(coalesce(p_body_ar, '')), '');
  if p_title = '' or p_body = '' then return jsonb_build_object('ok', false, 'error', 'missing_text'); end if;
  if length(p_title) > 80 or length(p_body) > 240 or length(coalesce(p_title_ar, '')) > 80 or length(coalesce(p_body_ar, '')) > 240 then
    return jsonb_build_object('ok', false, 'error', 'too_long');
  end if;
  if exists (select 1 from broadcasts where created_at > now() - interval '2 minutes') then
    return jsonb_build_object('ok', false, 'error', 'too_soon');
  end if;
  v_url := case when p_perk_id is not null then '/perk/' || p_perk_id::text else '/notifications' end;

  insert into broadcasts (title, body, title_ar, body_ar, campus_id, campus_ids, perk_id, sent_by)
  values (p_title, p_body, p_title_ar, p_body_ar,
          case when cardinality(p_campus_ids) = 1 then p_campus_ids[1] end,
          case when v_all then null else p_campus_ids end, p_perk_id, auth.uid())
  returning id into v_id;

  insert into notifications (user_id, kind, title, body, data, broadcast_id)
  select p.id, 'broadcast',
         case when p.lang = 'ar' and p_title_ar is not null then p_title_ar else p_title end,
         case when p.lang = 'ar' and p_body_ar is not null then p_body_ar else p_body end,
         jsonb_build_object('url', v_url), v_id
    from profiles p
   where p.role = 'student' and p.status = 'active' and p.deleted_at is null and p.marketing_opt_in
     and (v_all or p.campus_id = any(p_campus_ids));
  get diagnostics v_n = row_count;
  update broadcasts set recipients = v_n where id = v_id;
  return jsonb_build_object('ok', true, 'recipients', v_n);
end $$;
revoke all on function public.send_broadcast_campuses(text, text, text, text, uuid[], uuid) from public, anon;
grant execute on function public.send_broadcast_campuses(text, text, text, text, uuid[], uuid) to authenticated;
