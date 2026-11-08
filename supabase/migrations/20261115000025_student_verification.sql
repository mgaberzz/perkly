-- Student verification: a student sends a photo of their student ID card; operations approve or reject it.
-- When the platform setting "student_verification.required" is on, only verified students can redeem
-- (after an optional number of free redemptions). Verification lasts 12 months.

alter table public.profiles
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  add column if not exists verified_at timestamptz,
  add column if not exists verified_until date;

insert into public.app_settings (key, value) values ('student_verification', '{"required": false, "free_redemptions": 0}')
on conflict (key) do nothing;

create table if not exists public.student_verifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  campus_id      uuid references public.campuses(id) on delete set null,
  student_number text check (student_number is null or length(student_number) <= 40),
  id_card_path   text not null,
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason  text check (reject_reason is null or length(reject_reason) <= 300),
  reviewed_by    uuid references public.profiles(id) on delete set null,
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now(),
  constraint student_verifications_path_own check (id_card_path ~ ('^' || user_id::text || '/[A-Za-z0-9._-]{1,80}$'))
);
create index if not exists student_verifications_status_idx on public.student_verifications (status, created_at desc);
create index if not exists student_verifications_user_idx on public.student_verifications (user_id, created_at desc);
create unique index if not exists student_verifications_one_pending on public.student_verifications (user_id) where status = 'pending';

alter table public.student_verifications enable row level security;
create policy student_verifications_read_own on public.student_verifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy student_verifications_read_staff on public.student_verifications for select to authenticated
  using (public.is_staff(array['admin', 'operations']));
grant select on public.student_verifications to authenticated;

-- Students may not change their own verification fields
create or replace function public.guard_profile_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if not public.is_admin() and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    new.role := old.role;
    new.status := old.status;
    new.referral_code := old.referral_code;
    new.referred_by := old.referred_by;
    new.user_code := old.user_code;
    new.student_code := old.student_code;
    new.verification_status := old.verification_status;
    new.verified_at := old.verified_at;
    new.verified_until := old.verified_until;
  end if;
  return new;
end $$;

-- Can this user redeem right now, as far as verification goes?
create or replace function public.student_can_redeem(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  with s as (select coalesce((value->>'required')::boolean, false) as required,
                    coalesce((value->>'free_redemptions')::int, 0) as free
               from app_settings where key = 'student_verification')
  select case
    when not coalesce((select required from s), false) then true
    when p.role <> 'student' then true
    when p.verification_status = 'verified' and (p.verified_until is null or p.verified_until >= cairo_today()) then true
    when (select count(*) from redemptions r where r.user_id = p.id and r.status <> 'reversed') < coalesce((select free from s), 0) then true
    else false end
  from profiles p where p.id = p_user
$$;
revoke all on function public.student_can_redeem(uuid) from public, anon, authenticated;

-- Everything the app needs to show the student's verification state
create or replace function public.my_verification() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_p profiles;
  v_s jsonb;
  v_used int;
  v_last student_verifications;
  v_state text;
begin
  if v_uid is null then return null; end if;
  select * into v_p from profiles where id = v_uid;
  select value into v_s from app_settings where key = 'student_verification';
  select count(*) into v_used from redemptions where user_id = v_uid and status <> 'reversed';
  select * into v_last from student_verifications where user_id = v_uid order by created_at desc limit 1;
  v_state := case when v_p.verification_status = 'verified' and v_p.verified_until < cairo_today() then 'expired'
                  else v_p.verification_status end;
  return jsonb_build_object(
    'required', coalesce((v_s->>'required')::boolean, false),
    'free_redemptions', coalesce((v_s->>'free_redemptions')::int, 0),
    'used', v_used,
    'status', v_state,
    'verified_until', v_p.verified_until,
    'reject_reason', case when v_last.status = 'rejected' then v_last.reject_reason end,
    'submitted_at', case when v_last.status = 'pending' then v_last.created_at end,
    'can_redeem', student_can_redeem(v_uid));
end $$;
revoke all on function public.my_verification() from public, anon;
grant execute on function public.my_verification() to authenticated;

-- Student sends their ID card photo (already uploaded to student-ids/<their id>/...)
create or replace function public.submit_student_verification(p_id_card_path text, p_student_number text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_p profiles;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select * into v_p from profiles where id = v_uid;
  if v_p.role <> 'student' or v_p.status <> 'active' then return jsonb_build_object('ok', false, 'error', 'account_restricted'); end if;
  if p_id_card_path is null or p_id_card_path !~ ('^' || v_uid::text || '/[A-Za-z0-9._-]{1,80}$') then
    return jsonb_build_object('ok', false, 'error', 'bad_photo');
  end if;
  if v_p.verification_status = 'pending' then return jsonb_build_object('ok', false, 'error', 'already_pending'); end if;
  if v_p.verification_status = 'verified' and v_p.verified_until > cairo_today() + 30 then
    return jsonb_build_object('ok', false, 'error', 'already_verified');
  end if;
  insert into student_verifications (user_id, campus_id, student_number, id_card_path)
  values (v_uid, v_p.campus_id, nullif(left(trim(coalesce(p_student_number, '')), 40), ''), p_id_card_path);
  update profiles set verification_status = 'pending' where id = v_uid and verification_status <> 'verified';
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.submit_student_verification(text, text) from public, anon;
grant execute on function public.submit_student_verification(text, text) to authenticated;

-- Operations approve or reject
create or replace function public.review_student_verification(p_id uuid, p_approve boolean, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_v student_verifications;
begin
  if not is_staff(array['admin', 'operations']) then return jsonb_build_object('ok', false, 'error', 'not_allowed'); end if;
  select * into v_v from student_verifications where id = p_id for update;
  if not found or v_v.status <> 'pending' then return jsonb_build_object('ok', false, 'error', 'not_pending'); end if;
  if not p_approve and coalesce(trim(p_reason), '') = '' then return jsonb_build_object('ok', false, 'error', 'reason_required'); end if;
  update student_verifications set status = case when p_approve then 'approved' else 'rejected' end,
    reject_reason = case when p_approve then null else left(trim(p_reason), 300) end,
    reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_id;
  if p_approve then
    update profiles set verification_status = 'verified', verified_at = now(), verified_until = (cairo_today() + interval '12 months')::date
    where id = v_v.user_id;
  else
    update profiles set verification_status = case when verification_status = 'verified' then 'verified' else 'rejected' end
    where id = v_v.user_id;
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.review_student_verification(uuid, boolean, text) from public, anon;
grant execute on function public.review_student_verification(uuid, boolean, text) to authenticated;

-- Admins set the rule (required on/off, free redemptions before verifying)
create or replace function public.set_verification_rules(p_required boolean, p_free integer) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then return jsonb_build_object('ok', false, 'error', 'not_allowed'); end if;
  if p_free is null or p_free < 0 or p_free > 20 then return jsonb_build_object('ok', false, 'error', 'bad_number'); end if;
  insert into app_settings (key, value) values ('student_verification', jsonb_build_object('required', p_required, 'free_redemptions', p_free))
  on conflict (key) do update set value = jsonb_build_object('required', p_required, 'free_redemptions', p_free), updated_at = now();
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.set_verification_rules(boolean, integer) from public, anon;
grant execute on function public.set_verification_rules(boolean, integer) to authenticated;

-- Deleting an account also removes verification records (the photos are removed by the app)
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

-- Private bucket for ID card photos: students upload/read/delete their own folder; operations can read all
do $$ begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('student-ids', 'student-ids', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
    execute $p$create policy student_ids_insert_own on storage.objects for insert to authenticated
      with check (bucket_id = 'student-ids' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
    execute $p$create policy student_ids_select_own on storage.objects for select to authenticated
      using (bucket_id = 'student-ids' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_staff(array['admin', 'operations'])))$p$;
    execute $p$create policy student_ids_delete_own on storage.objects for delete to authenticated
      using (bucket_id = 'student-ids' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
  end if;
end $$;

-- Redemption (in-store and online codes) now checks verification
create or replace function public.perform_redemption(
  p_user uuid, p_perk_id uuid, p_merchant_id uuid, p_branch_id uuid, p_qr_id uuid,
  p_original_amount numeric, p_lat double precision, p_lng double precision,
  p_channel text, p_payment_method text, p_online_code_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_profile profiles;
  v_stats user_stats;
  v_merchant merchants;
  v_branch merchant_branches;
  v_perk perks;
  v_today date := cairo_today();
  v_dow smallint := extract(dow from now() at time zone 'Africa/Cairo')::smallint;
  v_count integer;
  v_discount numeric(10,2);
  v_final numeric(10,2);
  v_commission numeric(10,2);
  v_net numeric(10,2);
  v_pay_status text := 'na';
  v_pay_ref text;
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
  v_payments jsonb;
begin
  -- Serialize redemptions per student (prevents double-tap / race conditions)
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));

  select * into v_profile from profiles where id = p_user;
  if not found or v_profile.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'account_restricted');
  end if;
  if not student_can_redeem(p_user) then
    return jsonb_build_object('ok', false, 'error', 'verification_required');
  end if;

  select * into v_merchant from merchants where id = p_merchant_id;
  if not found or v_merchant.status <> 'live' then
    return jsonb_build_object('ok', false, 'error', 'merchant_inactive');
  end if;
  if p_branch_id is not null then
    select * into v_branch from merchant_branches where id = p_branch_id;
  end if;

  select * into v_perk from perks where id = p_perk_id for update;
  if not found or v_perk.merchant_id <> p_merchant_id
     or (v_perk.branch_id is not null and v_perk.branch_id is distinct from p_branch_id) then
    return jsonb_build_object('ok', false, 'error', 'wrong_merchant');
  end if;
  if v_perk.status <> 'active'
     or (v_perk.start_at is not null and v_perk.start_at > now())
     or (v_perk.end_at is not null and v_perk.end_at <= now())
     or (v_perk.valid_days is not null and not (v_dow = any(v_perk.valid_days))) then
    return jsonb_build_object('ok', false, 'error', 'perk_unavailable');
  end if;

  if p_payment_method not in ('merchant','in_app') then
    return jsonb_build_object('ok', false, 'error', 'invalid_payment_method');
  end if;
  if p_original_amount is not null and p_original_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;
  if (v_perk.min_spend > 0 or p_payment_method = 'in_app') and p_original_amount is null then
    return jsonb_build_object('ok', false, 'error', 'amount_required');
  end if;
  if p_original_amount is not null and p_original_amount < v_perk.min_spend then
    return jsonb_build_object('ok', false, 'error', 'below_min_spend', 'min_spend', v_perk.min_spend);
  end if;
  if p_payment_method = 'in_app' then
    select value into v_payments from app_settings where key = 'payments';
    if coalesce(v_payments->>'mode', 'off') not in ('test','live') then
      return jsonb_build_object('ok', false, 'error', 'payments_unavailable');
    end if;
  end if;

  if exists (select 1 from redemptions
              where user_id = p_user and merchant_id = p_merchant_id and status <> 'reversed'
                and created_at > now() - interval '15 minutes') then
    return jsonb_build_object('ok', false, 'error', 'too_soon');
  end if;
  select count(*) into v_count from redemptions
   where user_id = p_user and merchant_id = p_merchant_id and status <> 'reversed'
     and (created_at at time zone 'Africa/Cairo')::date = v_today;
  if v_count >= public.max_redemptions_per_merchant_per_day() then
    return jsonb_build_object('ok', false, 'error', 'daily_merchant_limit', 'limit', public.max_redemptions_per_merchant_per_day());
  end if;
  if v_perk.max_uses_per_user is not null then
    select count(*) into v_count from redemptions where user_id = p_user and perk_id = v_perk.id and status <> 'reversed';
    if v_count >= v_perk.max_uses_per_user then
      return jsonb_build_object('ok', false, 'error', 'perk_limit_reached');
    end if;
  end if;
  if v_perk.daily_cap is not null then
    select count(*) into v_count from redemptions
     where perk_id = v_perk.id and status <> 'reversed' and (created_at at time zone 'Africa/Cairo')::date = v_today;
    if v_count >= v_perk.daily_cap then
      return jsonb_build_object('ok', false, 'error', 'perk_sold_out_today');
    end if;
  end if;

  -- Location check (in-store only)
  if p_channel = 'in_store' and v_branch.lat is not null and v_branch.lng is not null then
    if p_lat is not null and p_lng is not null then
      v_distance := distance_m(p_lat, p_lng, v_branch.lat, v_branch.lng);
      if v_distance > 1000 then
        return jsonb_build_object('ok', false, 'error', 'too_far', 'distance_m', v_distance);
      elsif v_distance > 300 then
        v_status := 'flagged'; v_flag := 'distance_' || v_distance || 'm';
      end if;
    else
      v_status := 'flagged'; v_flag := 'no_location';
    end if;
  end if;

  -- Discount, commission, settlement share (server-side only)
  if p_original_amount is not null then
    v_discount := case v_perk.discount_type
      when 'percentage' then round(p_original_amount * v_perk.discount_value / 100, 2)
      when 'amount'     then least(v_perk.discount_value, p_original_amount)
      else null end;
    if v_discount is not null and v_perk.max_discount_amount is not null then
      v_discount := least(v_discount, v_perk.max_discount_amount);
    end if;
    v_final := case when v_discount is null then p_original_amount else p_original_amount - v_discount end;
    if v_discount is null and p_payment_method = 'merchant' then v_final := null; end if;
  end if;
  v_commission := round(coalesce(v_final, 0) * v_merchant.commission_pct / 100, 2);
  if p_payment_method = 'in_app' then
    v_pay_status := 'paid';   -- test mode: no real charge. With a live gateway, the charge is confirmed before this point.
    v_pay_ref := case when v_payments->>'mode' = 'test' then 'TEST-' else 'PAY-' end || upper(encode(extensions.gen_random_bytes(5), 'hex'));
    v_net := v_final - v_commission;
  end if;

  v_first_at_merchant := not exists (
    select 1 from redemptions where user_id = p_user and merchant_id = p_merchant_id and status <> 'reversed');

  select * into v_stats from user_stats where user_id = p_user for update;
  v_old_level := v_stats.level;
  v_first_today := v_stats.last_redemption_date is distinct from v_today;
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
                           verification_code, distance_m, channel, payment_method, payment_status, payment_ref,
                           commission_amount, merchant_net, online_code_id)
  values (v_redemption_id, p_user, v_perk.id, p_merchant_id, p_branch_id, p_qr_id, p_original_amount,
          v_discount, v_final, v_status, v_flag, v_first_at_merchant, v_code, v_distance, p_channel, p_payment_method,
          v_pay_status, v_pay_ref, v_commission, v_net, p_online_code_id);

  update user_stats set
    current_streak = v_new_streak, longest_streak = greatest(longest_streak, v_new_streak),
    last_redemption_date = v_today,
    freeze_tokens = freeze_tokens - case when v_used_freeze then 1 else 0 end,
    total_saved = total_saved + coalesce(v_discount, 0),
    total_redemptions = total_redemptions + 1, updated_at = now()
  where user_id = p_user;

  v_ctx := jsonb_build_object('redemption_id', v_redemption_id, 'perk_id', v_perk.id, 'merchant_id', p_merchant_id);
  v_base := case when v_first_today then 20 else 10 end;
  if v_first_today and v_dow in (5, 6) then v_base := v_base * 2; end if;
  v_xp := v_xp + award_xp(p_user, v_base, 'redemption', true, v_ctx);
  if v_first_at_merchant then v_xp := v_xp + award_xp(p_user, 25, 'new_merchant', true, v_ctx); end if;
  if v_first_today and v_new_streak > 1 then
    v_xp := v_xp + award_xp(p_user, 5 * least(v_new_streak, 6), 'streak', true, v_ctx);
  end if;
  if v_first_today then
    v_milestone := case v_new_streak when 3 then 10 when 5 then 20 when 7 then 30 when 14 then 100 when 30 then 300 else 0 end;
    if v_milestone > 0 then
      v_xp := v_xp + award_xp(p_user, v_milestone, 'streak_milestone', false, v_ctx || jsonb_build_object('streak', v_new_streak));
    end if;
  end if;
  if v_stats.total_redemptions = 0 and v_profile.referred_by is not null then
    perform award_xp(v_profile.referred_by, 50, 'referral', false, jsonb_build_object('friend_id', p_user));
  end if;

  for v_quest in select * from quests where is_active loop
    v_period := case v_quest.quest_type when 'daily' then v_today
      when 'weekly' then date_trunc('week', v_today)::date else date_trunc('month', v_today)::date end;
    v_progress := case v_quest.metric
      when 'redemptions' then (select count(*) from redemptions where user_id = p_user and status <> 'reversed'
                                 and (created_at at time zone 'Africa/Cairo')::date >= v_period)
      when 'unique_merchants' then (select count(distinct merchant_id) from redemptions where user_id = p_user and status <> 'reversed'
                                 and (created_at at time zone 'Africa/Cairo')::date >= v_period)
      when 'new_merchants' then (select count(*) from redemptions where user_id = p_user and status <> 'reversed' and first_time_at_merchant
                                 and (created_at at time zone 'Africa/Cairo')::date >= v_period)
    end;
    insert into user_quests (user_id, quest_id, period_start, progress)
    values (p_user, v_quest.id, v_period, least(v_progress, v_quest.target))
    on conflict (user_id, quest_id, period_start)
      do update set progress = least(excluded.progress, v_quest.target) where user_quests.completed_at is null;
    if v_progress >= v_quest.target then
      update user_quests set completed_at = now()
       where user_id = p_user and quest_id = v_quest.id and period_start = v_period and completed_at is null;
      if found then
        v_xp := v_xp + award_xp(p_user, v_quest.xp_reward, 'quest', false, jsonb_build_object('quest_id', v_quest.id));
        if v_quest.quest_type = 'monthly' then
          update user_stats set freeze_tokens = least(freeze_tokens + 1, 3) where user_id = p_user;
        end if;
        v_quests := v_quests || jsonb_build_object('title', v_quest.title, 'emoji', v_quest.emoji, 'xp_reward', v_quest.xp_reward);
      end if;
    end if;
  end loop;

  select * into v_stats from user_stats where user_id = p_user;
  select count(distinct merchant_id) into v_unique_merchants from redemptions where user_id = p_user and status <> 'reversed';
  if v_stats.total_redemptions >= 1 then v_badge := award_badge(p_user, 'first_perk'); if v_badge is not null then v_badges := v_badges || v_badge; end if; end if;
  if v_new_streak >= 3 then v_badge := award_badge(p_user, 'streak_3'); if v_badge is not null then v_badges := v_badges || v_badge; end if; end if;
  if v_new_streak >= 7 then v_badge := award_badge(p_user, 'streak_7'); if v_badge is not null then v_badges := v_badges || v_badge; end if; end if;
  if v_new_streak >= 30 then v_badge := award_badge(p_user, 'streak_30'); if v_badge is not null then v_badges := v_badges || v_badge; end if; end if;
  if v_unique_merchants >= 10 then v_badge := award_badge(p_user, 'explorer_10'); if v_badge is not null then v_badges := v_badges || v_badge; end if; end if;
  if v_stats.total_saved >= 1000 then v_badge := award_badge(p_user, 'saver_1000'); if v_badge is not null then v_badges := v_badges || v_badge; end if; end if;
  if v_stats.level >= 5 then v_badge := award_badge(p_user, 'elite_saver'); if v_badge is not null then v_badges := v_badges || v_badge; end if; end if;
  if v_old_level < 3 and v_stats.level >= 3 then
    update user_stats set freeze_tokens = least(freeze_tokens + 1, 3) where user_id = p_user;
  end if;

  update redemptions set xp_awarded = v_xp where id = v_redemption_id;

  return jsonb_build_object(
    'ok', true, 'redemption_id', v_redemption_id, 'verification_code', v_code, 'created_at', now(),
    'merchant_name', v_merchant.name, 'branch_name', coalesce(v_branch.name, 'Online'),
    'perk_title', v_perk.title, 'discount_type', v_perk.discount_type, 'discount_value', v_perk.discount_value,
    'original_amount', p_original_amount, 'discount_amount', v_discount, 'final_amount', v_final,
    'channel', p_channel, 'payment_method', p_payment_method, 'payment_status', v_pay_status, 'payment_ref', v_pay_ref,
    'payment_mode', v_payments->>'mode',
    'first_time_at_merchant', v_first_at_merchant, 'xp_awarded', v_xp, 'total_xp', v_stats.total_xp,
    'level', v_stats.level, 'level_name', level_name(v_stats.level), 'leveled_up', v_stats.level > v_old_level,
    'streak', v_new_streak, 'used_freeze_token', v_used_freeze,
    'quests_completed', v_quests, 'badges_unlocked', v_badges
  );
end $$;

create or replace function public.get_online_code(p_perk_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_perk perks; v_merchant merchants; v_existing online_codes; v_code text;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if exists (select 1 from profiles where id = v_uid and status <> 'active') then
    return jsonb_build_object('ok', false, 'error', 'account_restricted');
  end if;
  if not student_can_redeem(v_uid) then
    return jsonb_build_object('ok', false, 'error', 'verification_required');
  end if;
  select * into v_perk from perks where id = p_perk_id;
  select * into v_merchant from merchants where id = v_perk.merchant_id;
  if v_perk.id is null or v_perk.status <> 'active' or (v_perk.end_at is not null and v_perk.end_at <= now()) then
    return jsonb_build_object('ok', false, 'error', 'perk_unavailable');
  end if;
  if v_merchant.status <> 'live' or v_merchant.channel not in ('online','both') then
    return jsonb_build_object('ok', false, 'error', 'not_online');
  end if;
  update online_codes set status = 'expired' where user_id = v_uid and status = 'issued' and expires_at <= now();
  select * into v_existing from online_codes
   where user_id = v_uid and perk_id = p_perk_id and status = 'issued' and expires_at > now() order by created_at desc limit 1;
  if found then
    return jsonb_build_object('ok', true, 'code', v_existing.code, 'expires_at', v_existing.expires_at,
                              'merchant_name', v_merchant.name, 'website_url', v_merchant.website_url);
  end if;
  v_code := 'PK' || upper(substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 8));
  insert into online_codes (code, user_id, perk_id, merchant_id, expires_at)
  values (v_code, v_uid, p_perk_id, v_merchant.id, now() + interval '30 minutes');
  return jsonb_build_object('ok', true, 'code', v_code, 'expires_at', now() + interval '30 minutes',
                            'merchant_name', v_merchant.name, 'website_url', v_merchant.website_url);
end $$;
