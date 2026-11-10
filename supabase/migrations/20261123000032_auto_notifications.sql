-- Automatic notifications, sent once a day by pg_cron (18:00 Cairo):
--   ending_soon     a perk at a place the student saved ends in the next ~24 hours (they haven't used it)
--   almost_level    the student is close to the next XP level (once per level)
--   new_near_campus a new perk at a shop with a branch at the student's campus (only students who opted in to perk drops)
-- Limits: at most 1 automatic message per student per day and a weekly cap (default 3); never the same message twice.
-- The Perkly team turns each type on/off and changes the weekly cap in the portal (Push notifications page).

-- New notification kind
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in ('verification', 'payment', 'broadcast', 'reminder'));
create index if not exists notifications_auto_idx on public.notifications (user_id, (data->>'auto')) where kind = 'reminder';

-- Students can switch reminders off in the app
alter table public.profiles add column if not exists reminders_opt_in boolean not null default true;

insert into public.app_settings (key, value)
values ('auto_notifications', '{"ending_soon": true, "almost_level": true, "new_near_campus": true, "max_per_week": 3}')
on conflict (key) do nothing;

create or replace function public.auto_notification_candidates()
returns table (user_id uuid, rule text, auto_key text, title text, body text, url text, prio int)
language sql stable security definer set search_path = public as $$
  with cfg as (select coalesce((select value from app_settings where key = 'auto_notifications'), '{}'::jsonb) as v),
  students as (
    select p.id, p.lang = 'ar' as ar, p.campus_id, p.marketing_opt_in
      from profiles p
     where p.role = 'student' and p.status = 'active' and p.deleted_at is null and p.reminders_opt_in
  ),
  ending as (
    select distinct on (s.id) s.id as user_id, 'ending_soon'::text as rule, 'ending_soon:' || pk.id as auto_key,
           case when s.ar then 'العرض ده بيخلص بكرة ⏰' else 'Ends tomorrow ⏰' end as title,
           case when s.ar then pk.title || ' في ' || m.name || ' بيخلص بكرة. متفوّتهوش!'
                else pk.title || ' at ' || m.name || ' ends tomorrow. Don''t miss it!' end as body,
           '/perk/' || pk.id as url, 1 as prio
      from students s
      join favorites f on f.user_id = s.id
      join merchants m on m.id = f.merchant_id and m.status = 'live'
      join perks pk on pk.merchant_id = m.id and pk.status = 'active'
                   and pk.end_at between now() + interval '12 hours' and now() + interval '36 hours'
     where (select coalesce((v->>'ending_soon')::boolean, true) from cfg)
       and not exists (select 1 from redemptions r where r.user_id = s.id and r.perk_id = pk.id)
     order by s.id, pk.end_at
  ),
  level_gap as (
    select s.id as user_id, s.ar, us.total_xp, us.level,
           (array[200, 600, 1200, 2000, 3000, 4500])[us.level] as next_xp,
           (array[0, 200, 600, 1200, 2000, 3000])[us.level] as cur_xp
      from students s join user_stats us on us.user_id = s.id
     where us.level between 1 and 6
  ),
  almost as (
    select g.user_id, 'almost_level'::text, 'almost_level:' || (g.level + 1),
           case when g.ar then 'قربت توصل للمستوى الجاي 🚀' else 'Almost there 🚀' end,
           case when g.ar then 'فاضلك ' || (g.next_xp - g.total_xp) || ' XP وتبقى ' ||
                  (array['مستكشف','موفّر','من الداخل','موفّر النخبة','خبير العروض','أسطورة الجامعة'])[g.level] || '. استخدم عرض النهارده!'
                else 'You''re ' || (g.next_xp - g.total_xp) || ' XP from ' ||
                  (array['Explorer','Saver','Insider','Elite Saver','Perk Master','Campus Legend'])[g.level] || '. Use a perk today to level up!' end,
           '/profile', 2
      from level_gap g
     where (select coalesce((v->>'almost_level')::boolean, true) from cfg)
       and g.total_xp < g.next_xp
       and g.next_xp - g.total_xp <= greatest(25, (g.next_xp - g.cur_xp) * 15 / 100)
  ),
  near as (
    select distinct on (s.id) s.id as user_id, 'new_near_campus'::text, 'new_near_campus:' || pk.id,
           case when s.ar then 'عرض جديد جنب ' || coalesce(c.short_name, c.name) || ' 🎉' else 'New near ' || coalesce(c.short_name, c.name) || ' 🎉' end,
           case when s.ar then m.name || ': ' || pk.title else m.name || ': ' || pk.title end,
           '/perk/' || pk.id, 3
      from students s
      join campuses c on c.id = s.campus_id
      join merchant_branches b on b.campus_id = s.campus_id and b.is_active
      join merchants m on m.id = b.merchant_id and m.status = 'live'
      join perks pk on pk.merchant_id = m.id and pk.status = 'active' and pk.created_at > now() - interval '3 days'
                   and (pk.end_at is null or pk.end_at > now() + interval '1 day')
                   and (pk.branch_id is null or pk.branch_id = b.id)
     where s.marketing_opt_in and (select coalesce((v->>'new_near_campus')::boolean, true) from cfg)
     order by s.id, pk.priority_score desc nulls last, pk.created_at desc
  ),
  allc as (select * from ending union all select * from almost union all select * from near),
  fresh as (
    select a.* from allc a
     where not exists (select 1 from notifications n where n.user_id = a.user_id and n.kind = 'reminder' and n.data->>'auto' = a.auto_key)
       and not exists (select 1 from notifications n where n.user_id = a.user_id and n.kind = 'reminder'
                        and n.created_at > now() - interval '20 hours')
       and (select count(*) from notifications n where n.user_id = a.user_id and n.kind = 'reminder' and n.created_at > now() - interval '7 days')
           < (select coalesce((v->>'max_per_week')::int, 3) from cfg)
  )
  select distinct on (f.user_id) f.user_id, f.rule, f.auto_key, f.title, f.body, f.url, f.prio
    from fresh f order by f.user_id, f.prio
$$;
revoke all on function public.auto_notification_candidates() from public, anon, authenticated;

-- Sends today's automatic notifications. p_dry_run = true only counts them (the portal's preview).
create or replace function public.run_auto_notifications(p_dry_run boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  -- pg_cron runs this without a signed-in user; from the portal only Admin / Operations may
  if auth.uid() is not null and not is_staff(array['admin', 'operations']) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;
  select jsonb_build_object('ok', true, 'dry_run', p_dry_run,
           'ending_soon', count(*) filter (where rule = 'ending_soon'),
           'almost_level', count(*) filter (where rule = 'almost_level'),
           'new_near_campus', count(*) filter (where rule = 'new_near_campus'),
           'total', count(*))
    into v from auto_notification_candidates();
  if not p_dry_run then
    insert into notifications (user_id, kind, title, body, data)
    select user_id, 'reminder', title, body, jsonb_build_object('url', url, 'auto', auto_key)
      from auto_notification_candidates();
  end if;
  return v;
end $$;
revoke all on function public.run_auto_notifications(boolean) from public, anon;
grant execute on function public.run_auto_notifications(boolean) to authenticated;

-- What went out in the last 7 days, per type (portal)
create or replace function public.auto_notification_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when is_staff(array['admin', 'operations']) then (
    select jsonb_build_object(
      'ending_soon', count(*) filter (where data->>'auto' like 'ending_soon:%'),
      'almost_level', count(*) filter (where data->>'auto' like 'almost_level:%'),
      'new_near_campus', count(*) filter (where data->>'auto' like 'new_near_campus:%'),
      'opened', count(*) filter (where read_at is not null),
      'total', count(*))
    from notifications where kind = 'reminder' and created_at > now() - interval '7 days') end
$$;
revoke all on function public.auto_notification_stats() from public, anon;
grant execute on function public.auto_notification_stats() to authenticated;

-- Admin / Operations change the settings from the portal
create or replace function public.set_auto_notifications(p_ending_soon boolean, p_almost_level boolean, p_new_near_campus boolean, p_max_per_week int)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not is_staff(array['admin', 'operations']) then return jsonb_build_object('ok', false, 'error', 'not_allowed'); end if;
  if p_max_per_week is null or p_max_per_week not between 1 and 7 then return jsonb_build_object('ok', false, 'error', 'bad_cap'); end if;
  insert into app_settings (key, value) values ('auto_notifications', jsonb_build_object(
    'ending_soon', p_ending_soon, 'almost_level', p_almost_level, 'new_near_campus', p_new_near_campus, 'max_per_week', p_max_per_week))
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.set_auto_notifications(boolean, boolean, boolean, int) from public, anon;
grant execute on function public.set_auto_notifications(boolean, boolean, boolean, int) to authenticated;

-- Daily at 16:00 UTC = 18:00 Cairo (19:00 in summer time)
do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'perkly-auto-notifications';
    perform cron.schedule('perkly-auto-notifications', '0 16 * * *', 'select public.run_auto_notifications(false)');
  end if;
end $$;
