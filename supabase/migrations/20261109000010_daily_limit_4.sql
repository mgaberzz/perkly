-- Daily transaction rule: a student can redeem up to 4 times per merchant per day (was 2).
-- The number is a setting (app_settings 'redemption_rules'), so admins can change it without a code release.

insert into public.app_settings (key, value)
values ('redemption_rules', '{"max_per_merchant_per_day": 4, "cooldown_minutes": 15}')
on conflict (key) do update set value = public.app_settings.value || '{"max_per_merchant_per_day": 4}', updated_at = now();

create or replace function public.max_redemptions_per_merchant_per_day() returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select (value->>'max_per_merchant_per_day')::int from app_settings where key = 'redemption_rules'), 4)
$$;
grant execute on function public.max_redemptions_per_merchant_per_day() to authenticated;

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
