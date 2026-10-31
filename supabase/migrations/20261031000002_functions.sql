-- Perkly business logic: helpers, signup trigger, redemption engine, gamification, analytics

-- ───────────────────────────── Helpers ─────────────────────────────
create or replace function public.cairo_today() returns date
language sql stable as $$ select (now() at time zone 'Africa/Cairo')::date $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and status = 'active')
$$;

create or replace function public.is_merchant_member(p_merchant_id uuid, p_roles text[] default array['owner','manager','cashier'])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from merchant_members
    where merchant_id = p_merchant_id and user_id = auth.uid() and member_role = any(p_roles)
  )
$$;

create or replace function public.my_merchant_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select merchant_id from merchant_members where user_id = auth.uid()
$$;

-- Level table (Notion: Gamification Strategy)
create or replace function public.level_for_xp(p_xp integer) returns integer
language sql immutable as $$
  select case
    when p_xp >= 4500 then 7 when p_xp >= 3000 then 6 when p_xp >= 2000 then 5
    when p_xp >= 1200 then 4 when p_xp >= 600  then 3 when p_xp >= 200  then 2
    else 1 end
$$;

create or replace function public.level_name(p_level integer) returns text
language sql immutable as $$
  select (array['Newbie','Explorer','Saver','Insider','Elite Saver','Perk Master','Campus Legend'])[greatest(1, least(7, p_level))]
$$;

create or replace function public.distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns integer language sql immutable as $$
  select round(6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )))::integer
$$;

-- ───────────────────────────── Signup ─────────────────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_ref text := nullif(new.raw_user_meta_data->>'referral_code', '');
  v_referrer uuid;
begin
  if v_ref is not null then
    select id into v_referrer from profiles where referral_code = upper(v_ref);
  end if;

  insert into profiles (id, full_name, phone, email, referred_by)
  values (new.id, nullif(new.raw_user_meta_data->>'full_name', ''), new.phone, new.email, v_referrer);
  insert into user_stats (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Non-admins cannot change role/status/referral fields of their own profile.
-- runs as the calling role (not security definer) so current_user reflects who is writing
create or replace function public.guard_profile_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if not public.is_admin() and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    new.role := old.role;
    new.status := old.status;
    new.referral_code := old.referral_code;
    new.referred_by := old.referred_by;
  end if;
  return new;
end $$;

create trigger guard_profile_update before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Merchant members cannot change status / plan / commission (admin-only fields).
-- runs as the calling role (not security definer) so current_user reflects who is writing
create or replace function public.guard_merchant_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if not public.is_admin() and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    new.status := old.status;
    new.plan := old.plan;
    new.commission_pct := old.commission_pct;
  end if;
  return new;
end $$;

create trigger guard_merchant_update before update on public.merchants
  for each row execute function public.guard_merchant_update();

-- Perk approval rules (Notion: Discount Tier System)
--  * percentage > 30% (Tier 4) needs end date, per-user limit and daily cap, and admin approval
--  * merchants may only set status to pending/active/paused; high-tier perks are forced to pending
-- runs as the calling role (not security definer) so current_user reflects who is writing
create or replace function public.guard_perk() returns trigger
language plpgsql set search_path = public as $$
declare
  v_high_tier boolean := new.discount_type = 'percentage' and new.discount_value > 30;
  v_privileged boolean := public.is_admin() or current_user in ('postgres', 'service_role', 'supabase_admin');
begin
  if v_high_tier and (new.end_at is null or new.max_uses_per_user is null or new.daily_cap is null) then
    raise exception 'Perks above 30%% need an end date, a per-student limit and a daily cap'
      using errcode = 'check_violation';
  end if;

  if new.branch_id is not null and not exists (
    select 1 from merchant_branches where id = new.branch_id and merchant_id = new.merchant_id
  ) then
    raise exception 'Branch does not belong to this merchant' using errcode = 'check_violation';
  end if;

  if not v_privileged then
    if new.status not in ('pending', 'active', 'paused') then
      new.status := coalesce(old.status, 'pending');
    end if;
    if v_high_tier and (
      tg_op = 'INSERT'
      or old.status in ('pending', 'rejected')
      or new.discount_value is distinct from old.discount_value
      or new.discount_type is distinct from old.discount_type
    ) and new.status = 'active' then
      new.status := 'pending';
    end if;
    if tg_op = 'UPDATE' and old.status = 'rejected' and new.status = 'active' then
      new.status := 'pending';
    end if;
  end if;
  return new;
end $$;

create trigger guard_perk before insert or update on public.perks
  for each row execute function public.guard_perk();

-- ───────────────────────────── XP helper ─────────────────────────────
-- Awards XP, respecting the 150 XP/day cap for "capped" sources. Returns XP actually awarded.
create or replace function public.award_xp(p_user uuid, p_amount integer, p_reason text, p_capped boolean, p_context jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_today_capped integer;
  v_award integer := p_amount;
begin
  if p_amount <= 0 then return 0; end if;
  if p_capped then
    select coalesce(sum(amount), 0) into v_today_capped
    from xp_events
    where user_id = p_user and capped
      and (created_at at time zone 'Africa/Cairo')::date = cairo_today();
    v_award := least(p_amount, greatest(0, 150 - v_today_capped));
  end if;
  if v_award > 0 then
    insert into xp_events (user_id, amount, reason, capped, context)
    values (p_user, v_award, p_reason, p_capped, coalesce(p_context, '{}'));
    update user_stats
       set total_xp = total_xp + v_award, level = level_for_xp(total_xp + v_award), updated_at = now()
     where user_id = p_user;
  end if;
  return v_award;
end $$;
revoke all on function public.award_xp(uuid, integer, text, boolean, jsonb) from public, anon, authenticated;

create or replace function public.award_badge(p_user uuid, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_badge badges;
begin
  select * into v_badge from badges where code = p_code;
  if not found then return null; end if;
  insert into user_badges (user_id, badge_id) values (p_user, v_badge.id) on conflict do nothing;
  if found then
    return jsonb_build_object('code', v_badge.code, 'name', v_badge.name, 'emoji', v_badge.emoji);
  end if;
  return null;
end $$;
revoke all on function public.award_badge(uuid, text) from public, anon, authenticated;

-- ───────────────────────────── Scan: look up the cashier QR ─────────────────────────────
-- Called right after the student scans the QR at the cashier table.
-- Returns merchant/branch info and the perks the student can use there.
create or replace function public.lookup_qr(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_qr record;
  v_perks jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select q.id as qr_id, b.id as branch_id, b.name as branch_name, b.is_active as branch_active,
         m.id as merchant_id, m.name as merchant_name, m.logo_url, m.category, m.status as merchant_status
    into v_qr
    from branch_qr_codes q
    join merchant_branches b on b.id = q.branch_id
    join merchants m on m.id = b.merchant_id
   where q.code = upper(trim(p_code)) and q.is_active;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_qr');
  end if;
  if v_qr.merchant_status <> 'live' or not v_qr.branch_active then
    return jsonb_build_object('ok', false, 'error', 'merchant_inactive');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'title', p.title, 'description', p.description, 'terms', p.terms,
           'discount_type', p.discount_type, 'discount_value', p.discount_value,
           'max_discount_amount', p.max_discount_amount, 'min_spend', p.min_spend, 'is_flash', p.is_flash,
           'end_at', p.end_at
         ) order by p.is_flash desc, p.priority_score desc, p.discount_value desc), '[]'::jsonb)
    into v_perks
    from perks p
   where p.merchant_id = v_qr.merchant_id
     and (p.branch_id is null or p.branch_id = v_qr.branch_id)
     and p.status = 'active'
     and (p.start_at is null or p.start_at <= now())
     and (p.end_at is null or p.end_at > now())
     and (p.valid_days is null or extract(dow from now() at time zone 'Africa/Cairo')::smallint = any(p.valid_days));

  return jsonb_build_object(
    'ok', true,
    'merchant', jsonb_build_object('id', v_qr.merchant_id, 'name', v_qr.merchant_name, 'logo_url', v_qr.logo_url, 'category', v_qr.category),
    'branch', jsonb_build_object('id', v_qr.branch_id, 'name', v_qr.branch_name),
    'perks', v_perks
  );
end $$;

-- ───────────────────────────── Redemption engine ─────────────────────────────
-- Student scanned the cashier QR, picked a perk, (optionally) typed the bill amount.
-- Validates everything server-side, records the redemption and runs gamification.
-- Errors are returned as {ok:false, error:<code>} so the app can show friendly copy.
create or replace function public.redeem_perk(
  p_code text,
  p_perk_id uuid,
  p_original_amount numeric default null,
  p_lat double precision default null,
  p_lng double precision default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_profile profiles;
  v_stats user_stats;
  v_qr record;
  v_perk perks;
  v_today date := cairo_today();
  v_dow smallint := extract(dow from now() at time zone 'Africa/Cairo')::smallint;
  v_count integer;
  v_discount numeric(10,2);
  v_final numeric(10,2);
  v_first_at_merchant boolean;
  v_first_today boolean;
  v_new_streak integer;
  v_used_freeze boolean := false;
  v_distance integer;
  v_status text := 'success';
  v_flag text;
  v_redemption_id uuid := gen_random_uuid();
  v_code text := upper(substr(encode(extensions.gen_random_bytes(3), 'hex'), 1, 4));
  v_xp integer := 0;
  v_base integer;
  v_old_level integer;
  v_milestone integer;
  v_quests jsonb := '[]'::jsonb;
  v_badges jsonb := '[]'::jsonb;
  v_badge jsonb;
  v_quest record;
  v_period date;
  v_progress integer;
  v_unique_merchants integer;
  v_ctx jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  -- Serialize redemptions per student (prevents double-tap / race conditions)
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  select * into v_profile from profiles where id = v_uid;
  if not found or v_profile.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'account_restricted');
  end if;

  select q.id as qr_id, b.id as branch_id, b.name as branch_name, b.is_active as branch_active, b.lat, b.lng,
         m.id as merchant_id, m.name as merchant_name, m.status as merchant_status
    into v_qr
    from branch_qr_codes q
    join merchant_branches b on b.id = q.branch_id
    join merchants m on m.id = b.merchant_id
   where q.code = upper(trim(p_code)) and q.is_active;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_qr');
  end if;
  if v_qr.merchant_status <> 'live' or not v_qr.branch_active then
    return jsonb_build_object('ok', false, 'error', 'merchant_inactive');
  end if;

  -- Lock the perk row so the daily cap can't be exceeded concurrently
  select * into v_perk from perks where id = p_perk_id for update;
  if not found or v_perk.merchant_id <> v_qr.merchant_id
     or (v_perk.branch_id is not null and v_perk.branch_id <> v_qr.branch_id) then
    return jsonb_build_object('ok', false, 'error', 'wrong_merchant');
  end if;
  if v_perk.status <> 'active'
     or (v_perk.start_at is not null and v_perk.start_at > now())
     or (v_perk.end_at is not null and v_perk.end_at <= now())
     or (v_perk.valid_days is not null and not (v_dow = any(v_perk.valid_days))) then
    return jsonb_build_object('ok', false, 'error', 'perk_unavailable');
  end if;

  if p_original_amount is not null and p_original_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;
  if v_perk.min_spend > 0 and p_original_amount is null then
    return jsonb_build_object('ok', false, 'error', 'amount_required');
  end if;
  if p_original_amount is not null and p_original_amount < v_perk.min_spend then
    return jsonb_build_object('ok', false, 'error', 'below_min_spend', 'min_spend', v_perk.min_spend);
  end if;

  -- Anti-fraud: no repeat at same merchant within 15 minutes
  if exists (select 1 from redemptions
              where user_id = v_uid and merchant_id = v_qr.merchant_id and status <> 'reversed'
                and created_at > now() - interval '15 minutes') then
    return jsonb_build_object('ok', false, 'error', 'too_soon');
  end if;

  -- Anti-fraud: max 2 redemptions per merchant per day
  select count(*) into v_count from redemptions
   where user_id = v_uid and merchant_id = v_qr.merchant_id and status <> 'reversed'
     and (created_at at time zone 'Africa/Cairo')::date = v_today;
  if v_count >= 2 then
    return jsonb_build_object('ok', false, 'error', 'daily_merchant_limit');
  end if;

  if v_perk.max_uses_per_user is not null then
    select count(*) into v_count from redemptions
     where user_id = v_uid and perk_id = v_perk.id and status <> 'reversed';
    if v_count >= v_perk.max_uses_per_user then
      return jsonb_build_object('ok', false, 'error', 'perk_limit_reached');
    end if;
  end if;

  if v_perk.daily_cap is not null then
    select count(*) into v_count from redemptions
     where perk_id = v_perk.id and status <> 'reversed'
       and (created_at at time zone 'Africa/Cairo')::date = v_today;
    if v_count >= v_perk.daily_cap then
      return jsonb_build_object('ok', false, 'error', 'perk_sold_out_today');
    end if;
  end if;

  -- Location check: reject if clearly far away; flag for review if location unavailable
  if v_qr.lat is not null and v_qr.lng is not null then
    if p_lat is not null and p_lng is not null then
      v_distance := distance_m(p_lat, p_lng, v_qr.lat, v_qr.lng);
      if v_distance > 1000 then
        return jsonb_build_object('ok', false, 'error', 'too_far', 'distance_m', v_distance);
      elsif v_distance > 300 then
        v_status := 'flagged'; v_flag := 'distance_' || v_distance || 'm';
      end if;
    else
      v_status := 'flagged'; v_flag := 'no_location';
    end if;
  end if;

  -- Discount calculation (server-side only)
  if p_original_amount is not null then
    v_discount := case v_perk.discount_type
      when 'percentage' then round(p_original_amount * v_perk.discount_value / 100, 2)
      when 'amount'     then least(v_perk.discount_value, p_original_amount)
      else null end;
    if v_discount is not null and v_perk.max_discount_amount is not null then
      v_discount := least(v_discount, v_perk.max_discount_amount);
    end if;
    v_final := case when v_discount is null then null else p_original_amount - v_discount end;
  end if;

  v_first_at_merchant := not exists (
    select 1 from redemptions where user_id = v_uid and merchant_id = v_qr.merchant_id and status <> 'reversed');

  select * into v_stats from user_stats where user_id = v_uid for update;
  v_old_level := v_stats.level;
  v_first_today := v_stats.last_redemption_date is distinct from v_today;

  -- Streak update
  if v_stats.last_redemption_date = v_today then
    v_new_streak := v_stats.current_streak;
  elsif v_stats.last_redemption_date = v_today - 1 then
    v_new_streak := v_stats.current_streak + 1;
  elsif v_stats.last_redemption_date = v_today - 2 and v_stats.freeze_tokens > 0 and v_stats.current_streak > 0 then
    v_new_streak := v_stats.current_streak + 1; v_used_freeze := true;
  else
    v_new_streak := 1;
  end if;

  insert into redemptions (id, user_id, perk_id, merchant_id, branch_id, qr_code_id, original_amount,
                           discount_amount, final_amount, status, flag_reason, first_time_at_merchant,
                           verification_code, distance_m)
  values (v_redemption_id, v_uid, v_perk.id, v_qr.merchant_id, v_qr.branch_id, v_qr.qr_id, p_original_amount,
          v_discount, v_final, v_status, v_flag, v_first_at_merchant, v_code, v_distance);

  update user_stats set
    current_streak = v_new_streak,
    longest_streak = greatest(longest_streak, v_new_streak),
    last_redemption_date = v_today,
    freeze_tokens = freeze_tokens - case when v_used_freeze then 1 else 0 end,
    total_saved = total_saved + coalesce(v_discount, 0),
    total_redemptions = total_redemptions + 1,
    updated_at = now()
  where user_id = v_uid;

  v_ctx := jsonb_build_object('redemption_id', v_redemption_id, 'perk_id', v_perk.id, 'merchant_id', v_qr.merchant_id);

  -- XP: +20 first redemption of the day (2x on Egyptian weekend Fri/Sat), +10 after that
  v_base := case when v_first_today then 20 else 10 end;
  if v_first_today and v_dow in (5, 6) then v_base := v_base * 2; end if;
  v_xp := v_xp + award_xp(v_uid, v_base, 'redemption', true, v_ctx);
  if v_first_at_merchant then
    v_xp := v_xp + award_xp(v_uid, 25, 'new_merchant', true, v_ctx);
  end if;
  if v_first_today and v_new_streak > 1 then
    v_xp := v_xp + award_xp(v_uid, 5 * least(v_new_streak, 6), 'streak', true, v_ctx);
  end if;

  -- Streak milestones (not capped)
  if v_first_today then
    v_milestone := case v_new_streak when 3 then 10 when 5 then 20 when 7 then 30 when 14 then 100 when 30 then 300 else 0 end;
    if v_milestone > 0 then
      v_xp := v_xp + award_xp(v_uid, v_milestone, 'streak_milestone', false, v_ctx || jsonb_build_object('streak', v_new_streak));
    end if;
  end if;

  -- Referral: referrer earns +50 XP when the referred friend redeems for the first time
  if v_stats.total_redemptions = 0 and v_profile.referred_by is not null then
    perform award_xp(v_profile.referred_by, 50, 'referral', false, jsonb_build_object('friend_id', v_uid));
  end if;

  -- Quests
  for v_quest in select * from quests where is_active loop
    v_period := case v_quest.quest_type
      when 'daily' then v_today
      when 'weekly' then date_trunc('week', v_today)::date
      else date_trunc('month', v_today)::date end;

    v_progress := case v_quest.metric
      when 'redemptions' then (
        select count(*) from redemptions where user_id = v_uid and status <> 'reversed'
           and (created_at at time zone 'Africa/Cairo')::date >= v_period)
      when 'unique_merchants' then (
        select count(distinct merchant_id) from redemptions where user_id = v_uid and status <> 'reversed'
           and (created_at at time zone 'Africa/Cairo')::date >= v_period)
      when 'new_merchants' then (
        select count(*) from redemptions where user_id = v_uid and status <> 'reversed' and first_time_at_merchant
           and (created_at at time zone 'Africa/Cairo')::date >= v_period)
    end;

    insert into user_quests (user_id, quest_id, period_start, progress)
    values (v_uid, v_quest.id, v_period, least(v_progress, v_quest.target))
    on conflict (user_id, quest_id, period_start)
      do update set progress = least(excluded.progress, v_quest.target)
      where user_quests.completed_at is null;

    if v_progress >= v_quest.target then
      update user_quests set completed_at = now()
       where user_id = v_uid and quest_id = v_quest.id and period_start = v_period and completed_at is null;
      if found then
        v_xp := v_xp + award_xp(v_uid, v_quest.xp_reward, 'quest', false, jsonb_build_object('quest_id', v_quest.id));
        if v_quest.quest_type = 'monthly' then
          update user_stats set freeze_tokens = least(freeze_tokens + 1, 3) where user_id = v_uid;
        end if;
        v_quests := v_quests || jsonb_build_object('title', v_quest.title, 'emoji', v_quest.emoji, 'xp_reward', v_quest.xp_reward);
      end if;
    end if;
  end loop;

  -- Badges
  select * into v_stats from user_stats where user_id = v_uid;
  select count(distinct merchant_id) into v_unique_merchants from redemptions where user_id = v_uid and status <> 'reversed';

  if v_stats.total_redemptions >= 1 then
    v_badge := award_badge(v_uid, 'first_perk'); if v_badge is not null then v_badges := v_badges || v_badge; end if;
  end if;
  if v_new_streak >= 3 then
    v_badge := award_badge(v_uid, 'streak_3'); if v_badge is not null then v_badges := v_badges || v_badge; end if;
  end if;
  if v_new_streak >= 7 then
    v_badge := award_badge(v_uid, 'streak_7'); if v_badge is not null then v_badges := v_badges || v_badge; end if;
  end if;
  if v_new_streak >= 30 then
    v_badge := award_badge(v_uid, 'streak_30'); if v_badge is not null then v_badges := v_badges || v_badge; end if;
  end if;
  if v_unique_merchants >= 10 then
    v_badge := award_badge(v_uid, 'explorer_10'); if v_badge is not null then v_badges := v_badges || v_badge; end if;
  end if;
  if v_stats.total_saved >= 1000 then
    v_badge := award_badge(v_uid, 'saver_1000'); if v_badge is not null then v_badges := v_badges || v_badge; end if;
  end if;
  if v_stats.level >= 5 then
    v_badge := award_badge(v_uid, 'elite_saver'); if v_badge is not null then v_badges := v_badges || v_badge; end if;
  end if;
  -- Level 3 grants a streak freeze token (once)
  if v_old_level < 3 and v_stats.level >= 3 then
    update user_stats set freeze_tokens = least(freeze_tokens + 1, 3) where user_id = v_uid;
  end if;

  update redemptions set xp_awarded = v_xp where id = v_redemption_id;

  return jsonb_build_object(
    'ok', true,
    'redemption_id', v_redemption_id,
    'verification_code', v_code,
    'created_at', now(),
    'merchant_name', v_qr.merchant_name,
    'branch_name', v_qr.branch_name,
    'perk_title', v_perk.title,
    'discount_type', v_perk.discount_type,
    'discount_value', v_perk.discount_value,
    'original_amount', p_original_amount,
    'discount_amount', v_discount,
    'final_amount', v_final,
    'first_time_at_merchant', v_first_at_merchant,
    'xp_awarded', v_xp,
    'total_xp', v_stats.total_xp,
    'level', v_stats.level,
    'level_name', level_name(v_stats.level),
    'leveled_up', v_stats.level > v_old_level,
    'streak', v_new_streak,
    'used_freeze_token', v_used_freeze,
    'quests_completed', v_quests,
    'badges_unlocked', v_badges
  );
end $$;

-- Daily app open: +5 XP once per Cairo day
create or replace function public.daily_checkin() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_awarded integer := 0;
begin
  if v_uid is null then return jsonb_build_object('ok', false); end if;
  update user_stats set last_checkin_date = cairo_today()
   where user_id = v_uid and last_checkin_date is distinct from cairo_today();
  if found then
    v_awarded := award_xp(v_uid, 5, 'daily_open', true, '{}');
  end if;
  return jsonb_build_object('ok', true, 'xp_awarded', v_awarded);
end $$;

-- Weekly leaderboard (resets every Monday, Cairo time). Scope: 'campus' or 'all'.
create or replace function public.get_leaderboard(p_scope text default 'campus', p_limit integer default 50)
returns table (rank bigint, user_id uuid, display_name text, campus_name text, xp bigint, is_me boolean)
language sql stable security definer set search_path = public as $$
  with me as (select campus_id from profiles where id = auth.uid()),
  week_xp as (
    select e.user_id, sum(e.amount)::bigint as xp
      from xp_events e
     where (e.created_at at time zone 'Africa/Cairo')::date >= date_trunc('week', cairo_today())::date
     group by e.user_id
  )
  select rank() over (order by w.xp desc) as rank,
         p.id,
         coalesce(split_part(p.full_name, ' ', 1), 'Student') ||
           coalesce(' ' || left(nullif(split_part(p.full_name, ' ', 2), ''), 1) || '.', ''),
         c.short_name,
         w.xp,
         p.id = auth.uid()
    from week_xp w
    join profiles p on p.id = w.user_id and p.status = 'active' and p.role = 'student'
    left join campuses c on c.id = p.campus_id
   where p_scope <> 'campus' or p.campus_id = (select campus_id from me)
   order by w.xp desc
   limit least(p_limit, 100)
$$;

-- ───────────────────────────── Analytics ─────────────────────────────
create or replace function public.merchant_stats(p_merchant_id uuid, p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_from timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365)));
        v_result jsonb;
begin
  if not (public.is_admin() or public.is_merchant_member(p_merchant_id)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  with r as (
    select * from redemptions where merchant_id = p_merchant_id and status <> 'reversed' and created_at >= v_from
  )
  select jsonb_build_object(
    'redemptions', (select count(*) from r),
    'unique_students', (select count(distinct user_id) from r),
    'new_students', (select count(*) from r where first_time_at_merchant),
    'returning_redemptions', (select count(*) from r where not first_time_at_merchant),
    'discount_given', (select coalesce(sum(discount_amount), 0) from r),
    'revenue_after_discount', (select coalesce(sum(final_amount), 0) from r),
    'avg_ticket', (select coalesce(round(avg(original_amount), 2), 0) from r),
    'flagged', (select count(*) from r where status = 'flagged'),
    'by_day', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'count', c) order by d), '[]')
                 from (select (created_at at time zone 'Africa/Cairo')::date d, count(*) c from r group by 1) x),
    'by_hour', (select coalesce(jsonb_agg(jsonb_build_object('hour', h, 'count', c) order by h), '[]')
                 from (select extract(hour from created_at at time zone 'Africa/Cairo')::int h, count(*) c from r group by 1) x),
    'by_branch', (select coalesce(jsonb_agg(jsonb_build_object('branch', b.name, 'count', x.c) order by x.c desc), '[]')
                 from (select branch_id, count(*) c from r group by 1) x join merchant_branches b on b.id = x.branch_id),
    'by_perk', (select coalesce(jsonb_agg(jsonb_build_object('perk', p.title, 'count', x.c, 'discount', x.d) order by x.c desc), '[]')
                 from (select perk_id, count(*) c, coalesce(sum(discount_amount),0) d from r group by 1) x join perks p on p.id = x.perk_id)
  ) into v_result;
  return v_result;
end $$;

create or replace function public.admin_overview(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_from timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365)));
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'students', (select count(*) from profiles where role = 'student'),
    'new_students', (select count(*) from profiles where role = 'student' and created_at >= v_from),
    'active_students', (select count(distinct user_id) from redemptions where created_at >= v_from and status <> 'reversed'),
    'live_merchants', (select count(*) from merchants where status = 'live'),
    'pending_merchants', (select count(*) from merchants where status = 'pending'),
    'pending_perks', (select count(*) from perks where status = 'pending'),
    'redemptions', (select count(*) from redemptions where created_at >= v_from and status <> 'reversed'),
    'flagged_redemptions', (select count(*) from redemptions where status = 'flagged'),
    'discount_given', (select coalesce(sum(discount_amount), 0) from redemptions where created_at >= v_from and status <> 'reversed'),
    'est_commission', (select coalesce(sum(r.final_amount * m.commission_pct / 100), 0)
                         from redemptions r join merchants m on m.id = r.merchant_id
                        where r.created_at >= v_from and r.status <> 'reversed'),
    'by_day', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'count', c) order by d), '[]')
                 from (select (created_at at time zone 'Africa/Cairo')::date d, count(*) c
                         from redemptions where created_at >= v_from and status <> 'reversed' group by 1) x),
    'top_merchants', (select coalesce(jsonb_agg(jsonb_build_object('name', m.name, 'count', x.c) order by x.c desc), '[]')
                 from (select merchant_id, count(*) c from redemptions where created_at >= v_from and status <> 'reversed'
                        group by 1 order by 2 desc limit 10) x join merchants m on m.id = x.merchant_id),
    'by_campus', (select coalesce(jsonb_agg(jsonb_build_object('campus', coalesce(c.short_name, c.name), 'students', x.c) order by x.c desc), '[]')
                 from (select campus_id, count(*) c from profiles where role = 'student' and campus_id is not null group by 1) x
                 join campuses c on c.id = x.campus_id)
  );
end $$;

-- Social proof for merchant profile page: redemptions this week
create or replace function public.merchant_week_redemptions(p_merchant_id uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from redemptions
   where merchant_id = p_merchant_id and status <> 'reversed' and created_at >= now() - interval '7 days'
$$;

-- Students' own redemption history including merchant/perk names
-- owner-privileged view, filtered to the caller; keeps history visible even if a merchant is later paused
create or replace view public.my_redemptions as
  select r.id, r.created_at, r.original_amount, r.discount_amount, r.final_amount, r.xp_awarded, r.status,
         r.verification_code, m.name as merchant_name, m.logo_url, b.name as branch_name, p.title as perk_title
    from redemptions r
    join merchants m on m.id = r.merchant_id
    join merchant_branches b on b.id = r.branch_id
    join perks p on p.id = r.perk_id
   where r.user_id = auth.uid();
