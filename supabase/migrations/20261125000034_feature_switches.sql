-- Feature switches: Admins turn app features on/off (for everyone or only some campuses) from the portal.
-- The app hides what is off; the database also blocks the features that move money or rewards.
-- Shape: app_settings 'features' = { "<key>": { "on": bool, "campuses": [uuid, …] } , "language": { …, "default": "en" | "ar" } }
--   campuses empty = everyone; non-empty = only students at those campuses get the feature.

insert into public.app_settings (key, value) values ('features', jsonb_build_object(
  'arcade', '{"on": true, "campuses": []}'::jsonb, 'quests', '{"on": true, "campuses": []}'::jsonb,
  'leaderboard', '{"on": true, "campuses": []}'::jsonb, 'badges', '{"on": true, "campuses": []}'::jsonb,
  'streaks', '{"on": true, "campuses": []}'::jsonb, 'invite', '{"on": true, "campuses": []}'::jsonb,
  'pay_in_app', '{"on": true, "campuses": []}'::jsonb, 'shop_online', '{"on": true, "campuses": []}'::jsonb,
  'flash_perks', '{"on": true, "campuses": []}'::jsonb, 'collections', '{"on": true, "campuses": []}'::jsonb,
  'avatar_builder', '{"on": true, "campuses": []}'::jsonb, 'verification', '{"on": true, "campuses": []}'::jsonb,
  'language', '{"on": true, "campuses": [], "default": "en"}'::jsonb))
on conflict (key) do nothing;

-- Is the feature on for this student? Unknown keys count as on.
create or replace function public.feature_enabled(p_key text, p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  with f as (select value -> p_key as v from app_settings where key = 'features')
  select case
    when (select v from f) is null then true
    when not coalesce(((select v from f) ->> 'on')::boolean, true) then false
    when jsonb_array_length(coalesce((select v from f) -> 'campuses', '[]'::jsonb)) = 0 then true
    else exists (select 1 from profiles p where p.id = p_user and p.campus_id is not null
                   and (select v from f) -> 'campuses' ? p.campus_id::text)
  end
$$;
revoke all on function public.feature_enabled(text, uuid) from public, anon;
grant execute on function public.feature_enabled(text, uuid) to authenticated;

-- ───────── Server-side enforcement ─────────
create or replace function public.guard_feature_spin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not feature_enabled('arcade', new.user_id) then raise exception 'feature_off: arcade'; end if;
  return new;
end $$;
drop trigger if exists guard_feature_spin on public.spins;
create trigger guard_feature_spin before insert on public.spins for each row execute function public.guard_feature_spin();

create or replace function public.guard_feature_redemption() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.payment_method = 'in_app' and not feature_enabled('pay_in_app', new.user_id) then
    raise exception 'feature_off: pay_in_app';
  end if;
  return new;
end $$;
drop trigger if exists guard_feature_redemption on public.redemptions;
create trigger guard_feature_redemption before insert on public.redemptions for each row execute function public.guard_feature_redemption();

create or replace function public.guard_feature_online_code() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not feature_enabled('shop_online', new.user_id) then raise exception 'feature_off: shop_online'; end if;
  return new;
end $$;
drop trigger if exists guard_feature_online_code on public.online_codes;
create trigger guard_feature_online_code before insert on public.online_codes for each row execute function public.guard_feature_online_code();

revoke execute on function public.guard_feature_spin() from public, anon, authenticated;
revoke execute on function public.guard_feature_redemption() from public, anon, authenticated;
revoke execute on function public.guard_feature_online_code() from public, anon, authenticated;

-- Verification switched off → nobody is asked to verify before redeeming
create or replace function public.student_can_redeem(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  with s as (select coalesce((value->>'required')::boolean, false) as required,
                    coalesce((value->>'free_redemptions')::int, 0) as free
               from app_settings where key = 'student_verification')
  select case
    when not coalesce((select required from s), false) then true
    when not public.feature_enabled('verification', p_user) then true
    when p.role <> 'student' then true
    when p.verification_status = 'verified' and (p.verified_until is null or p.verified_until >= cairo_today()) then true
    when (select count(*) from redemptions r where r.user_id = p.id and r.status <> 'reversed') < coalesce((select free from s), 0) then true
    else false end
  from profiles p where p.id = p_user
$$;
revoke all on function public.student_can_redeem(uuid) from public, anon, authenticated;

-- Retries of a cashier payment get a clear answer instead of an error when Pay in app is off
create or replace function public.redeem_perk_safe(
  p_request_id uuid, p_code text, p_perk_id uuid, p_original_amount numeric default null,
  p_lat double precision default null, p_lng double precision default null, p_payment_method text default 'merchant'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_prev jsonb; v_res jsonb;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if p_request_id is null then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  select result into v_prev from redemption_requests where user_id = v_uid and request_id = p_request_id;
  if found then return v_prev || jsonb_build_object('replayed', true); end if;
  if p_payment_method = 'in_app' and not public.feature_enabled('pay_in_app', v_uid) then
    return jsonb_build_object('ok', false, 'error', 'pay_in_app_off');
  end if;
  v_res := public.redeem_perk(p_code, p_perk_id, p_original_amount, p_lat, p_lng, p_payment_method);
  if coalesce((v_res->>'ok')::boolean, false) then
    insert into redemption_requests (user_id, request_id, result) values (v_uid, p_request_id, v_res);
  end if;
  return v_res;
end $$;
