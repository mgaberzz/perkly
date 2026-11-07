-- In-app payments ledger, merchant settlements & bank accounts, online merchants
-- (one-time codes + tracked links with cashback). The redemption engine is split into a
-- shared core so in-store (cashier QR) and online (one-time code) redemptions follow the same rules.

-- ───────── Settings ─────────
create table public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
create policy settings_read on public.app_settings for select using (true);
create policy settings_write on public.app_settings for all using (public.is_admin()) with check (public.is_admin());
grant select on public.app_settings to anon, authenticated;
grant insert, update on public.app_settings to authenticated;
-- Until a payment gateway (Paymob / Fawry …) is connected, in-app payments run in TEST mode: no real charge.
insert into public.app_settings (key, value) values ('payments', '{"mode": "test", "provider": null}');

-- ───────── Merchants: channel, online links, bank account ─────────
alter table public.merchants
  add column channel text not null default 'in_store' check (channel in ('in_store','online','both')),
  add column website_url text,
  add column affiliate_url text;

-- Bank details live in their own table so students (who can read live merchants) never see them
create table public.merchant_bank_accounts (
  merchant_id   uuid primary key references public.merchants(id) on delete cascade,
  bank_name     text,
  account_name  text,
  iban          text,
  payout_schedule text not null default 'weekly' check (payout_schedule in ('weekly','biweekly','monthly')),
  updated_at    timestamptz not null default now()
);
alter table public.merchant_bank_accounts enable row level security;
create policy bank_read on public.merchant_bank_accounts for select using (
  public.is_merchant_member(merchant_id, array['owner','manager']) or public.is_staff(array['admin','operations','finance'])
  or public.can_see_merchant(merchant_id));
create policy bank_write on public.merchant_bank_accounts for all using (
  public.is_merchant_member(merchant_id, array['owner']) or public.is_staff(array['admin','finance']))
  with check (public.is_merchant_member(merchant_id, array['owner']) or public.is_staff(array['admin','finance']));
grant select, insert, update on public.merchant_bank_accounts to authenticated;

-- ───────── Redemptions: channel, payment, commission, settlement ─────────
create table public.settlements (
  id            uuid primary key default gen_random_uuid(),
  merchant_id   uuid not null references public.merchants(id) on delete restrict,
  period_start  date,
  period_end    date not null,
  gross_amount  numeric(12,2) not null,   -- what students paid in-app
  commission    numeric(12,2) not null,   -- Perkly's cut
  amount        numeric(12,2) not null,   -- transferred to the merchant
  lines         integer not null,
  status        text not null default 'pending' check (status in ('pending','paid')),
  reference     text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  paid_by       uuid references public.profiles(id) on delete set null,
  paid_at       timestamptz
);
create index settlements_merchant_idx on public.settlements (merchant_id, created_at desc);

alter table public.redemptions alter column branch_id drop not null;
alter table public.redemptions
  add column channel text not null default 'in_store' check (channel in ('in_store','online')),
  add column payment_method text not null default 'merchant' check (payment_method in ('merchant','in_app')),
  add column payment_status text not null default 'na' check (payment_status in ('na','paid','refunded')),
  add column payment_ref text,
  add column commission_amount numeric(10,2),
  add column merchant_net numeric(10,2),
  add column settlement_id uuid references public.settlements(id) on delete set null;
create index redemptions_settlement_idx on public.redemptions (settlement_id);
create index redemptions_unsettled_idx on public.redemptions (merchant_id) where payment_method = 'in_app' and settlement_id is null;

-- Backfill commission on existing redemptions
update public.redemptions r set commission_amount = round(coalesce(r.final_amount, 0) * m.commission_pct / 100, 2)
  from public.merchants m where m.id = r.merchant_id;

-- ───────── Online: one-time codes, tracked links, cashback ─────────
create table public.online_codes (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  perk_id       uuid not null references public.perks(id) on delete cascade,
  merchant_id   uuid not null references public.merchants(id) on delete cascade,
  status        text not null default 'issued' check (status in ('issued','used','expired')),
  expires_at    timestamptz not null,
  redemption_id uuid references public.redemptions(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index online_codes_user_idx on public.online_codes (user_id, created_at desc);
alter table public.redemptions add column online_code_id uuid references public.online_codes(id) on delete set null;

create table public.link_clicks (
  id          uuid primary key default gen_random_uuid(),
  ref         text not null unique,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  perk_id     uuid references public.perks(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index link_clicks_user_idx on public.link_clicks (user_id, created_at desc);

create table public.online_orders (
  id              uuid primary key default gen_random_uuid(),
  merchant_id     uuid not null references public.merchants(id) on delete cascade,
  click_id        uuid not null references public.link_clicks(id) on delete restrict,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  order_ref       text not null,
  amount          numeric(12,2) not null check (amount > 0),
  cashback_amount numeric(12,2) not null,
  status          text not null default 'pending' check (status in ('pending','approved','rejected')),
  reported_by     uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  unique (merchant_id, order_ref)
);
create index online_orders_user_idx on public.online_orders (user_id, created_at desc);

alter table public.user_stats add column cashback_pending numeric(12,2) not null default 0,
                              add column cashback_balance numeric(12,2) not null default 0;

alter table public.xp_events drop constraint xp_events_reason_check;
alter table public.xp_events add constraint xp_events_reason_check
  check (reason in ('redemption','new_merchant','streak','streak_milestone','quest','referral','daily_open','admin','spin','online_order'));

alter table public.online_codes enable row level security;
alter table public.link_clicks enable row level security;
alter table public.online_orders enable row level security;
alter table public.settlements enable row level security;

create policy online_codes_read on public.online_codes for select using (
  user_id = (select auth.uid()) or public.can_see_merchant(merchant_id) or public.is_merchant_member(merchant_id));
create policy link_clicks_read on public.link_clicks for select using (
  user_id = (select auth.uid()) or public.can_see_merchant(merchant_id) or public.is_merchant_member(merchant_id));
create policy online_orders_read on public.online_orders for select using (
  user_id = (select auth.uid()) or public.can_see_merchant(merchant_id) or public.is_merchant_member(merchant_id));
create policy settlements_read on public.settlements for select using (
  public.is_staff(array['admin','finance']) or public.can_see_merchant(merchant_id)
  or public.is_merchant_member(merchant_id, array['owner','manager']));
grant select on public.online_codes, public.link_clicks, public.online_orders, public.settlements to authenticated;
revoke insert, update, delete, truncate on public.online_codes, public.link_clicks, public.online_orders, public.settlements, public.merchant_bank_accounts, public.app_settings from anon;

-- ───────── Redemption core (shared by cashier QR and online codes) ─────────
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
  if v_count >= 2 then
    return jsonb_build_object('ok', false, 'error', 'daily_merchant_limit');
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
revoke execute on function public.perform_redemption(uuid, uuid, uuid, uuid, uuid, numeric, double precision, double precision, text, text, uuid)
  from public, anon, authenticated;

-- In-store: the student scanned an APPROVED cashier QR
drop function public.redeem_perk(text, uuid, numeric, double precision, double precision);
create or replace function public.redeem_perk(
  p_code text, p_perk_id uuid, p_original_amount numeric default null,
  p_lat double precision default null, p_lng double precision default null,
  p_payment_method text default 'merchant'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_qr record;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select q.id as qr_id, b.id as branch_id, b.is_active as branch_active, b.merchant_id
    into v_qr
    from branch_qr_codes q join merchant_branches b on b.id = q.branch_id
   where q.code = upper(trim(p_code)) and q.is_active and q.status = 'approved';
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_qr'); end if;
  if not v_qr.branch_active then return jsonb_build_object('ok', false, 'error', 'merchant_inactive'); end if;
  return perform_redemption(v_uid, p_perk_id, v_qr.merchant_id, v_qr.branch_id, v_qr.qr_id,
                            p_original_amount, p_lat, p_lng, 'in_store', coalesce(p_payment_method, 'merchant'));
end $$;
revoke execute on function public.redeem_perk(text, uuid, numeric, double precision, double precision, text) from public, anon;
grant execute on function public.redeem_perk(text, uuid, numeric, double precision, double precision, text) to authenticated;

-- QR lookup also requires an approved code
create or replace function public.lookup_qr(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_qr record; v_perks jsonb; v_payments jsonb;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select q.id as qr_id, b.id as branch_id, b.name as branch_name, b.is_active as branch_active,
         m.id as merchant_id, m.name as merchant_name, m.logo_url, m.category, m.status as merchant_status
    into v_qr
    from branch_qr_codes q join merchant_branches b on b.id = q.branch_id join merchants m on m.id = b.merchant_id
   where q.code = upper(trim(p_code)) and q.is_active and q.status = 'approved';
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_qr'); end if;
  if v_qr.merchant_status <> 'live' or not v_qr.branch_active then
    return jsonb_build_object('ok', false, 'error', 'merchant_inactive');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'title', p.title, 'description', p.description, 'terms', p.terms,
           'discount_type', p.discount_type, 'discount_value', p.discount_value,
           'max_discount_amount', p.max_discount_amount, 'min_spend', p.min_spend, 'is_flash', p.is_flash, 'end_at', p.end_at
         ) order by p.is_flash desc, p.priority_score desc, p.discount_value desc), '[]'::jsonb)
    into v_perks
    from perks p
   where p.merchant_id = v_qr.merchant_id and (p.branch_id is null or p.branch_id = v_qr.branch_id)
     and p.status = 'active' and (p.start_at is null or p.start_at <= now()) and (p.end_at is null or p.end_at > now())
     and (p.valid_days is null or extract(dow from now() at time zone 'Africa/Cairo')::smallint = any(p.valid_days));
  select value into v_payments from app_settings where key = 'payments';
  return jsonb_build_object('ok', true,
    'merchant', jsonb_build_object('id', v_qr.merchant_id, 'name', v_qr.merchant_name, 'logo_url', v_qr.logo_url, 'category', v_qr.category),
    'branch', jsonb_build_object('id', v_qr.branch_id, 'name', v_qr.branch_name),
    'perks', v_perks, 'payments_mode', coalesce(v_payments->>'mode', 'off'));
end $$;

-- True only for server-to-server calls made with the service-role key (e.g. a merchant's e-shop backend).
-- (Inside security definer functions current_user is the owner, so it can't be used for this.)
create or replace function public.is_service_call() returns boolean
language sql stable set search_path = public as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role',
                  nullif(current_setting('request.jwt.claim.role', true), '')) is not distinct from 'service_role'
$$;

-- ───────── Online: one-time codes ─────────
create or replace function public.get_online_code(p_perk_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_perk perks; v_merchant merchants; v_existing online_codes; v_code text;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if exists (select 1 from profiles where id = v_uid and status <> 'active') then
    return jsonb_build_object('ok', false, 'error', 'account_restricted');
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
revoke execute on function public.get_online_code(uuid) from public, anon;
grant execute on function public.get_online_code(uuid) to authenticated;

-- The online merchant validates the code at checkout (merchant portal or API)
create or replace function public.confirm_online_code(p_code text, p_amount numeric) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_code online_codes; v_res jsonb;
begin
  select * into v_code from online_codes where code = upper(trim(p_code)) for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_code'); end if;
  if not (public.is_merchant_member(v_code.merchant_id) or public.can_manage_merchant(v_code.merchant_id)
          or public.is_service_call()) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;
  if v_code.status = 'used' then return jsonb_build_object('ok', false, 'error', 'already_used'); end if;
  if v_code.status = 'expired' or v_code.expires_at <= now() then
    update online_codes set status = 'expired' where id = v_code.id;
    return jsonb_build_object('ok', false, 'error', 'expired_code');
  end if;
  v_res := perform_redemption(v_code.user_id, v_code.perk_id, v_code.merchant_id, null, null, p_amount, null, null,
                              'online', 'merchant', v_code.id);
  if (v_res->>'ok')::boolean then
    update online_codes set status = 'used', redemption_id = (v_res->>'redemption_id')::uuid where id = v_code.id;
  end if;
  return v_res - 'quests_completed' - 'badges_unlocked';
end $$;
revoke execute on function public.confirm_online_code(text, numeric) from public, anon;
grant execute on function public.confirm_online_code(text, numeric) to authenticated, service_role;

-- ───────── Online: tracked links + cashback ─────────
create or replace function public.track_link(p_merchant_id uuid, p_perk_id uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_m merchants; v_ref text; v_url text;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select * into v_m from merchants where id = p_merchant_id;
  if not found or v_m.status <> 'live' or v_m.channel not in ('online','both') or coalesce(v_m.affiliate_url, v_m.website_url) is null then
    return jsonb_build_object('ok', false, 'error', 'not_online');
  end if;
  v_ref := 'PKR' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10));
  insert into link_clicks (ref, user_id, merchant_id, perk_id) values (v_ref, v_uid, p_merchant_id, p_perk_id);
  v_url := coalesce(v_m.affiliate_url, v_m.website_url);
  v_url := v_url || case when position('?' in v_url) > 0 then '&' else '?' end || 'perkly_ref=' || v_ref;
  return jsonb_build_object('ok', true, 'url', v_url, 'ref', v_ref);
end $$;
revoke execute on function public.track_link(uuid, uuid) from public, anon;
grant execute on function public.track_link(uuid, uuid) to authenticated;

-- The online merchant reports an order that came through a Perkly link → pending cashback for finance to approve
create or replace function public.report_online_order(p_merchant_id uuid, p_ref text, p_order_ref text, p_amount numeric) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_click link_clicks; v_rate numeric; v_cashback numeric(12,2); v_id uuid; v_m text;
begin
  if not (public.is_merchant_member(p_merchant_id) or public.can_manage_merchant(p_merchant_id)
          or public.is_service_call()) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;
  if p_amount is null or p_amount <= 0 then return jsonb_build_object('ok', false, 'error', 'invalid_amount'); end if;
  select * into v_click from link_clicks where ref = upper(trim(p_ref)) and merchant_id = p_merchant_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_ref'); end if;
  if v_click.created_at < now() - interval '30 days' then return jsonb_build_object('ok', false, 'error', 'ref_expired'); end if;
  if exists (select 1 from online_orders where merchant_id = p_merchant_id and order_ref = trim(p_order_ref)) then
    return jsonb_build_object('ok', false, 'error', 'duplicate_order');
  end if;
  -- Cashback = the perk's percentage (if the link came from a % perk), otherwise 5%
  select case when p.discount_type = 'percentage' then p.discount_value else 5 end into v_rate from perks p where p.id = v_click.perk_id;
  v_cashback := round(p_amount * coalesce(v_rate, 5) / 100, 2);
  insert into online_orders (merchant_id, click_id, user_id, order_ref, amount, cashback_amount, reported_by)
  values (p_merchant_id, v_click.id, v_click.user_id, trim(p_order_ref), p_amount, v_cashback, auth.uid()) returning id into v_id;
  update user_stats set cashback_pending = cashback_pending + v_cashback where user_id = v_click.user_id;
  select name into v_m from merchants where id = p_merchant_id;
  insert into admin_requests (kind, merchant_id, ref_id, title, details, created_by)
  values ('cashback', p_merchant_id, v_id, 'Cashback ' || v_cashback || ' EGP · ' || v_m || ' order ' || trim(p_order_ref),
          jsonb_build_object('merchant', v_m, 'order_ref', trim(p_order_ref), 'amount', p_amount, 'cashback', v_cashback), auth.uid());
  return jsonb_build_object('ok', true, 'order_id', v_id, 'cashback_amount', v_cashback);
end $$;
revoke execute on function public.report_online_order(uuid, text, text, numeric) from public, anon;
grant execute on function public.report_online_order(uuid, text, text, numeric) to authenticated, service_role;

-- Approving / rejecting a cashback request moves the money and awards XP
create or replace function public.sync_cashback_request() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_o online_orders;
begin
  if new.kind <> 'cashback' or old.status <> 'pending' or new.status = 'pending' then return new; end if;
  select * into v_o from online_orders where id = new.ref_id for update;
  if v_o.status <> 'pending' then return new; end if;
  update online_orders set status = new.status, resolved_at = now() where id = v_o.id;
  if new.status = 'approved' then
    update user_stats set cashback_pending = greatest(cashback_pending - v_o.cashback_amount, 0),
                          cashback_balance = cashback_balance + v_o.cashback_amount where user_id = v_o.user_id;
    perform award_xp(v_o.user_id, 20, 'online_order', true, jsonb_build_object('order_id', v_o.id));
  else
    update user_stats set cashback_pending = greatest(cashback_pending - v_o.cashback_amount, 0) where user_id = v_o.user_id;
  end if;
  return new;
end $$;
create trigger sync_cashback_request after update of status on public.admin_requests
  for each row execute function public.sync_cashback_request();
revoke execute on function public.sync_cashback_request() from public, anon, authenticated;

-- ───────── Finance: balances & settlements ─────────
-- Per merchant: what Perkly owes from in-app payments, and commission owed by the merchant on at-cashier sales
create or replace function public.merchant_balances(p_merchant_id uuid default null)
returns table (merchant_id uuid, merchant_code text, merchant_name text, brand_type text,
               in_app_gross numeric, in_app_commission numeric, due_to_merchant numeric,
               pending_settlements numeric, paid_out numeric, cashier_sales numeric, commission_owed numeric,
               last_paid_at timestamptz, bank_name text, iban text)
language sql stable security definer set search_path = public as $$
  select m.id, m.merchant_code, m.name, m.brand_type,
         coalesce(sum(r.final_amount) filter (where r.payment_method = 'in_app' and r.payment_status = 'paid' and r.settlement_id is null), 0),
         coalesce(sum(r.commission_amount) filter (where r.payment_method = 'in_app' and r.payment_status = 'paid' and r.settlement_id is null), 0),
         coalesce(sum(r.merchant_net) filter (where r.payment_method = 'in_app' and r.payment_status = 'paid' and r.settlement_id is null), 0),
         coalesce((select sum(s.amount) from settlements s where s.merchant_id = m.id and s.status = 'pending'), 0),
         coalesce((select sum(s.amount) from settlements s where s.merchant_id = m.id and s.status = 'paid'), 0),
         coalesce(sum(r.final_amount) filter (where r.payment_method = 'merchant'), 0),
         coalesce(sum(r.commission_amount) filter (where r.payment_method = 'merchant'), 0),
         (select max(s.paid_at) from settlements s where s.merchant_id = m.id and s.status = 'paid'),
         case when public.is_staff(array['admin','finance']) or public.is_merchant_member(m.id, array['owner','manager']) then a.bank_name end,
         case when public.is_staff(array['admin','finance']) or public.is_merchant_member(m.id, array['owner','manager']) then a.iban end
    from merchants m
    left join redemptions r on r.merchant_id = m.id and r.status <> 'reversed'
    left join merchant_bank_accounts a on a.merchant_id = m.id
   where (p_merchant_id is null or m.id = p_merchant_id)
     and (public.is_staff(array['admin','finance']) or public.can_see_merchant(m.id) or public.is_merchant_member(m.id))
   group by m.id, a.bank_name, a.iban
$$;
revoke execute on function public.merchant_balances(uuid) from public, anon;
grant execute on function public.merchant_balances(uuid) to authenticated;

-- Create settlement batches: one per merchant with unsettled in-app money (up to the given date)
create or replace function public.create_settlements(p_until date default null, p_merchant_id uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_until date := coalesce(p_until, cairo_today()); v_m record; v_id uuid; v_n integer := 0; v_total numeric := 0;
begin
  if not public.is_staff(array['admin','finance']) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;
  for v_m in
    select merchant_id, min((created_at at time zone 'Africa/Cairo')::date) as first_day, count(*) as lines,
           sum(final_amount) as gross, sum(commission_amount) as commission, sum(merchant_net) as net
      from redemptions
     where payment_method = 'in_app' and payment_status = 'paid' and settlement_id is null and status <> 'reversed'
       and (created_at at time zone 'Africa/Cairo')::date <= v_until
       and (p_merchant_id is null or merchant_id = p_merchant_id)
     group by merchant_id
  loop
    insert into settlements (merchant_id, period_start, period_end, gross_amount, commission, amount, lines, created_by)
    values (v_m.merchant_id, v_m.first_day, v_until, v_m.gross, v_m.commission, v_m.net, v_m.lines, auth.uid())
    returning id into v_id;
    update redemptions set settlement_id = v_id
     where merchant_id = v_m.merchant_id and payment_method = 'in_app' and payment_status = 'paid' and settlement_id is null
       and status <> 'reversed' and (created_at at time zone 'Africa/Cairo')::date <= v_until;
    v_n := v_n + 1; v_total := v_total + v_m.net;
  end loop;
  return jsonb_build_object('ok', true, 'settlements', v_n, 'total', v_total);
end $$;

create or replace function public.mark_settlement_paid(p_id uuid, p_reference text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff(array['admin','finance']) then return jsonb_build_object('ok', false, 'error', 'not_allowed'); end if;
  if coalesce(trim(p_reference), '') = '' then return jsonb_build_object('ok', false, 'error', 'reference_required'); end if;
  update settlements set status = 'paid', reference = trim(p_reference), paid_by = auth.uid(), paid_at = now()
   where id = p_id and status = 'pending';
  if not found then return jsonb_build_object('ok', false, 'error', 'not_pending'); end if;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.create_settlements(date, uuid), public.mark_settlement_paid(uuid, text) from public, anon;
grant execute on function public.create_settlements(date, uuid), public.mark_settlement_paid(uuid, text) to authenticated;

-- ───────── History view: online redemptions have no branch ─────────
create or replace view public.my_redemptions with (security_invoker = true) as
  select r.id, r.created_at, r.original_amount, r.discount_amount, r.final_amount, r.xp_awarded, r.status,
         r.verification_code, m.name as merchant_name, m.logo_url, coalesce(b.name, 'Online') as branch_name, p.title as perk_title,
         r.channel, r.payment_method, r.payment_status
    from redemptions r
    join merchants m on m.id = r.merchant_id
    left join merchant_branches b on b.id = r.branch_id
    join perks p on p.id = r.perk_id
   where r.user_id = auth.uid();
grant select on public.my_redemptions to authenticated;

-- Realtime: merchants see online orders appear too
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.online_orders;
  end if;
end $$;
