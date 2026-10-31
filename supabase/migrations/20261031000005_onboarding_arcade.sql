-- Onboarding fields, Arcade (Spin the Wheel), perk popularity

-- ───────── Profile details & consent ─────────
alter table public.profiles
  add column birth_date date check (birth_date is null or (birth_date > date '1940-01-01' and birth_date < current_date)),
  add column marketing_opt_in boolean not null default false,
  add column terms_accepted_at timestamptz;

-- ───────── Arcade: spin tickets ─────────
alter table public.user_stats add column spin_tickets integer not null default 1 check (spin_tickets >= 0); -- 1 welcome spin

alter table public.xp_events drop constraint xp_events_reason_check;
alter table public.xp_events add constraint xp_events_reason_check
  check (reason in ('redemption','new_merchant','streak','streak_milestone','quest','referral','daily_open','admin','spin'));

create table public.spins (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  segment     smallint not null,
  reward_type text not null check (reward_type in ('xp','freeze')),
  amount      integer not null,
  created_at  timestamptz not null default now()
);
create index spins_user_idx on public.spins (user_id, created_at desc);
alter table public.spins enable row level security;
create policy spins_read on public.spins for select using (user_id = auth.uid() or public.is_admin());
grant select on public.spins to authenticated;

-- Wheel segments, in clockwise order as drawn by the app. Weights decide the odds (server-side only).
create or replace function public.wheel_segments()
returns table (idx smallint, label text, reward_type text, amount integer, weight integer)
language sql immutable as $$
  values (0::smallint, '+10 XP',  'xp', 10, 28),
         (1::smallint, '+25 XP',  'xp', 25, 20),
         (2::smallint, '+15 XP',  'xp', 15, 24),
         (3::smallint, '+100 XP', 'xp', 100, 3),
         (4::smallint, '+20 XP',  'xp', 20, 12),
         (5::smallint, 'Freeze',  'freeze', 1, 5),
         (6::smallint, '+50 XP',  'xp', 50, 6),
         (7::smallint, '+30 XP',  'xp', 30, 2)
$$;
grant execute on function public.wheel_segments() to anon, authenticated;

-- Earn a ticket: first redemption of the (Cairo) day
create or replace function public.ticket_on_redemption() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from redemptions
     where user_id = new.user_id and id <> new.id and status <> 'reversed'
       and (created_at at time zone 'Africa/Cairo')::date = (new.created_at at time zone 'Africa/Cairo')::date
  ) then
    update user_stats set spin_tickets = least(spin_tickets + 1, 20) where user_id = new.user_id;
  end if;
  return new;
end $$;
create trigger ticket_on_redemption after insert on public.redemptions
  for each row execute function public.ticket_on_redemption();

-- Earn a ticket: completing any quest
create or replace function public.ticket_on_quest() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.completed_at is not null and (tg_op = 'INSERT' or old.completed_at is null) then
    update user_stats set spin_tickets = least(spin_tickets + 1, 20) where user_id = new.user_id;
  end if;
  return new;
end $$;
create trigger ticket_on_quest after insert or update of completed_at on public.user_quests
  for each row execute function public.ticket_on_quest();

-- Spin: spends one ticket and picks a weighted segment on the server
create or replace function public.spin_wheel() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_tickets integer;
  v_total integer;
  v_roll integer;
  v_seg record;
  v_awarded integer := 0;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if exists (select 1 from profiles where id = v_uid and status <> 'active') then
    return jsonb_build_object('ok', false, 'error', 'account_restricted');
  end if;

  select spin_tickets into v_tickets from user_stats where user_id = v_uid for update;
  if coalesce(v_tickets, 0) < 1 then
    return jsonb_build_object('ok', false, 'error', 'no_tickets');
  end if;

  select sum(weight) into v_total from wheel_segments();
  v_roll := floor(random() * v_total)::int;
  for v_seg in select * from wheel_segments() order by idx loop
    v_roll := v_roll - v_seg.weight;
    exit when v_roll < 0;
  end loop;

  update user_stats set spin_tickets = spin_tickets - 1 where user_id = v_uid;
  if v_seg.reward_type = 'xp' then
    v_awarded := award_xp(v_uid, v_seg.amount, 'spin', false, jsonb_build_object('segment', v_seg.idx));
  else
    update user_stats set freeze_tokens = least(freeze_tokens + 1, 3) where user_id = v_uid;
  end if;
  insert into spins (user_id, segment, reward_type, amount) values (v_uid, v_seg.idx, v_seg.reward_type, v_seg.amount);

  return jsonb_build_object(
    'ok', true, 'segment', v_seg.idx, 'label', v_seg.label, 'reward_type', v_seg.reward_type, 'amount', v_seg.amount,
    'xp_awarded', v_awarded,
    'tickets_left', (select spin_tickets from user_stats where user_id = v_uid),
    'total_xp', (select total_xp from user_stats where user_id = v_uid)
  );
end $$;
grant execute on function public.spin_wheel() to authenticated;

-- ───────── Social proof: redemptions per perk (last 30 days), live merchants only ─────────
create or replace function public.perk_popularity()
returns table (perk_id uuid, merchant_id uuid, redemptions_30d bigint)
language sql stable security definer set search_path = public as $$
  select r.perk_id, r.merchant_id, count(*)
    from redemptions r join merchants m on m.id = r.merchant_id and m.status = 'live'
   where r.status <> 'reversed' and r.created_at >= now() - interval '30 days'
   group by r.perk_id, r.merchant_id
$$;
grant execute on function public.perk_popularity() to anon, authenticated;

-- ───────── Invite code entered after sign-up (needed for Google/Apple sign-in) ─────────
create or replace function public.apply_referral(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_ref uuid;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select id into v_ref from profiles where referral_code = upper(trim(p_code));
  if v_ref is null or v_ref = v_uid then return jsonb_build_object('ok', false, 'error', 'invalid_code'); end if;
  if exists (select 1 from profiles where id = v_uid and referred_by is not null)
     or exists (select 1 from user_stats where user_id = v_uid and total_redemptions > 0) then
    return jsonb_build_object('ok', false, 'error', 'too_late');
  end if;
  update profiles set referred_by = v_ref where id = v_uid;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.apply_referral(text) to authenticated;
