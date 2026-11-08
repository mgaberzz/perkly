-- Push notifications + in-app inbox.
-- Every notification is a row in public.notifications (the student's inbox). Inserting rows sends them as
-- push messages through Expo's push service (https://exp.host) using pg_net, to every device the student
-- registered. Transactional messages (verification result, payment received) always go out; broadcasts from
-- the Perkly team only go to students who opted in to perk drops.

do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
end $$;

-- The language the student uses the app in, so messages arrive in Arabic or English
alter table public.profiles add column if not exists lang text not null default 'en' check (lang in ('en', 'ar'));

create table if not exists public.push_tokens (
  token        text primary key check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$'),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  platform     text check (platform in ('ios', 'android', 'web')),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security; -- no direct access; use the functions below

create table if not exists public.broadcasts (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (length(title) between 1 and 80),
  body       text not null check (length(body) between 1 and 240),
  title_ar   text check (title_ar is null or length(title_ar) <= 80),
  body_ar    text check (body_ar is null or length(body_ar) <= 240),
  campus_id  uuid references public.campuses(id) on delete set null,
  perk_id    uuid references public.perks(id) on delete set null,
  recipients integer not null default 0,
  sent_by    uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.broadcasts enable row level security;
create policy broadcasts_read_staff on public.broadcasts for select to authenticated
  using (public.is_staff(array['admin', 'operations']));
grant select on public.broadcasts to authenticated;

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  kind         text not null check (kind in ('verification', 'payment', 'broadcast')),
  title        text not null,
  body         text not null,
  data         jsonb not null default '{}'::jsonb,   -- e.g. {"url": "/perk/<id>"} opened when tapped
  broadcast_id uuid references public.broadcasts(id) on delete set null,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy notifications_read_own on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.notifications to authenticated;

-- ───────── Devices ─────────
create or replace function public.register_push_token(p_token text, p_platform text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$' then return jsonb_build_object('ok', false, 'error', 'bad_token'); end if;
  -- a phone belongs to whoever is signed in on it now
  insert into push_tokens (token, user_id, platform) values (p_token, auth.uid(), nullif(p_platform, ''))
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, last_seen_at = now();
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

create or replace function public.unregister_push_token(p_token text) returns void
language sql security definer set search_path = public as $$
  delete from push_tokens where token = p_token and user_id = auth.uid();
$$;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.unregister_push_token(text) to authenticated;

create or replace function public.mark_notifications_read(p_ids uuid[] default null) returns void
language sql security definer set search_path = public as $$
  update notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids));
$$;
revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- ───────── Sending ─────────
-- Sends the given notifications to all of their owners' devices, 100 messages per request (Expo's limit).
create or replace function public.push_dispatch(p_ids uuid[]) returns integer
language plpgsql security definer set search_path = public as $$
declare v_chunk jsonb; v_sent integer := 0;
begin
  if to_regprocedure('net.http_post(text, jsonb, jsonb, jsonb, integer)') is null then return 0; end if;
  for v_chunk in
    select jsonb_agg(m) from (
      select m, (row_number() over () - 1) / 100 as grp from (
        select jsonb_build_object(
                 'to', t.token, 'title', n.title, 'body', n.body, 'sound', 'default', 'priority', 'high',
                 'channelId', 'default',
                 'data', n.data || jsonb_build_object('notification_id', n.id)) as m
          from notifications n
          join push_tokens t on t.user_id = n.user_id
          join profiles p on p.id = n.user_id and p.status = 'active'
         where n.id = any(p_ids)
      ) x
    ) y group by grp
  loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := v_chunk,
      params := '{}'::jsonb,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
      timeout_milliseconds := 10000);
    v_sent := v_sent + jsonb_array_length(v_chunk);
  end loop;
  return v_sent;
end $$;
revoke all on function public.push_dispatch(uuid[]) from public, anon, authenticated;

create or replace function public.notifications_push() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform push_dispatch(array(select id from new_rows));
  return null;
end $$;
create trigger notifications_push after insert on public.notifications
  referencing new table as new_rows for each statement execute function public.notifications_push();

-- ───────── Automatic messages ─────────
create or replace function public.notify_verification_result() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_ar boolean := (select lang = 'ar' from profiles where id = new.user_id);
begin
  if old.status = 'pending' and new.status = 'approved' then
    insert into notifications (user_id, kind, title, body, data) values (new.user_id, 'verification',
      case when v_ar then 'تم توثيقك! 🎓' else 'You''re verified! 🎓' end,
      case when v_ar then 'تمت الموافقة على كارنيه الطالب. استمتع بعروضك لمدة 12 شهرًا.' else 'Your student ID was approved. Enjoy your perks for the next 12 months.' end,
      '{"url": "/student-verification"}');
  elsif old.status = 'pending' and new.status = 'rejected' then
    insert into notifications (user_id, kind, title, body, data) values (new.user_id, 'verification',
      case when v_ar then 'لم تتم الموافقة على الكارنيه' else 'Your student ID wasn''t approved' end,
      case when v_ar then 'اضغط لمعرفة السبب وإرسال صورة جديدة.' else coalesce(new.reject_reason || ' ', '') || 'Tap to send a new photo.' end,
      '{"url": "/student-verification"}');
  end if;
  return null;
end $$;
create trigger notify_verification_result after update of status on public.student_verifications
  for each row execute function public.notify_verification_result();

create or replace function public.notify_payment() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_ar boolean := (select lang = 'ar' from profiles where id = new.user_id);
        v_name text := (select name from merchants where id = new.merchant_id);
begin
  if new.payment_method = 'in_app' and new.payment_status = 'paid' then
    insert into notifications (user_id, kind, title, body, data) values (new.user_id, 'payment',
      case when v_ar then 'تم الدفع ✅' else 'Payment received ✅' end,
      case when v_ar then 'دفعت ' || to_char(new.final_amount, 'FM999G999D00') || ' ج.م في ' || v_name || '. رقم المعاملة ' || coalesce(new.tx_code, '')
           else 'You paid EGP ' || to_char(new.final_amount, 'FM999G999D00') || ' at ' || v_name || '. Transaction ' || coalesce(new.tx_code, '') end,
      '{"url": "/history"}');
  end if;
  return null;
end $$;
create trigger notify_payment after insert on public.redemptions
  for each row execute function public.notify_payment();

-- ───────── Broadcasts from the Perkly team ─────────
create or replace function public.broadcast_audience(p_campus_id uuid default null) returns integer
language sql stable security definer set search_path = public as $$
  select case when public.is_staff(array['admin', 'operations']) then
    (select count(*)::int from profiles p
      where p.role = 'student' and p.status = 'active' and p.deleted_at is null and p.marketing_opt_in
        and (p_campus_id is null or p.campus_id = p_campus_id))
  end
$$;
revoke all on function public.broadcast_audience(uuid) from public, anon;
grant execute on function public.broadcast_audience(uuid) to authenticated;

create or replace function public.send_broadcast(
  p_title text, p_body text, p_title_ar text default null, p_body_ar text default null,
  p_campus_id uuid default null, p_perk_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_n integer; v_url text;
begin
  if not is_staff(array['admin', 'operations']) then return jsonb_build_object('ok', false, 'error', 'not_allowed'); end if;
  p_title := trim(coalesce(p_title, '')); p_body := trim(coalesce(p_body, ''));
  p_title_ar := nullif(trim(coalesce(p_title_ar, '')), ''); p_body_ar := nullif(trim(coalesce(p_body_ar, '')), '');
  if p_title = '' or p_body = '' then return jsonb_build_object('ok', false, 'error', 'missing_text'); end if;
  if length(p_title) > 80 or length(p_body) > 240 or length(coalesce(p_title_ar, '')) > 80 or length(coalesce(p_body_ar, '')) > 240 then
    return jsonb_build_object('ok', false, 'error', 'too_long');
  end if;
  -- guard against double-clicks / accidental repeats
  if exists (select 1 from broadcasts where created_at > now() - interval '2 minutes') then
    return jsonb_build_object('ok', false, 'error', 'too_soon');
  end if;
  v_url := case when p_perk_id is not null then '/perk/' || p_perk_id::text else '/notifications' end;

  insert into broadcasts (title, body, title_ar, body_ar, campus_id, perk_id, sent_by)
  values (p_title, p_body, p_title_ar, p_body_ar, p_campus_id, p_perk_id, auth.uid()) returning id into v_id;

  insert into notifications (user_id, kind, title, body, data, broadcast_id)
  select p.id, 'broadcast',
         case when p.lang = 'ar' and p_title_ar is not null then p_title_ar else p_title end,
         case when p.lang = 'ar' and p_body_ar is not null then p_body_ar else p_body end,
         jsonb_build_object('url', v_url), v_id
    from profiles p
   where p.role = 'student' and p.status = 'active' and p.deleted_at is null and p.marketing_opt_in
     and (p_campus_id is null or p.campus_id = p_campus_id);
  get diagnostics v_n = row_count;
  update broadcasts set recipients = v_n where id = v_id;
  return jsonb_build_object('ok', true, 'recipients', v_n);
end $$;
revoke all on function public.send_broadcast(text, text, text, text, uuid, uuid) from public, anon;
grant execute on function public.send_broadcast(text, text, text, text, uuid, uuid) to authenticated;

-- Deleting an account also removes devices and the inbox
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  select role into v_role from profiles where id = v_uid;
  if v_role is distinct from 'student' then
    raise exception 'Team, merchant and partner accounts are closed by the Perkly team. Contact support.';
  end if;

  update profiles set
    full_name = null, phone = null, email = null, birth_date = null,
    avatar_url = null, avatar_path = null, avatar_config = null, avatar_kind = null,
    interests = '{}', marketing_opt_in = false,
    status = 'banned', deleted_at = now()
  where id = v_uid;

  delete from favorites where user_id = v_uid;
  delete from student_verifications where user_id = v_uid;
  delete from push_tokens where user_id = v_uid;
  delete from notifications where user_id = v_uid;

  update auth.users set
    email = null, phone = null, raw_user_meta_data = '{}'::jsonb,
    banned_until = now() + interval '100 years'
  where id = v_uid;
  delete from auth.identities where user_id = v_uid;
  delete from auth.sessions where user_id = v_uid;
  delete from auth.webauthn_credentials where user_id = v_uid;
  delete from auth.mfa_factors where user_id = v_uid;
  delete from auth.one_time_tokens where user_id = v_uid;
end $$;
