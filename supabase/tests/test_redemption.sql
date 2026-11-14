-- SQL tests for the redemption engine, gamification and RLS.
\set ON_ERROR_STOP 1

-- ── Users ──
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@perkly.test',    '{"full_name":"Ada Admin"}'),
  ('00000000-0000-0000-0000-00000000000b', 'owner@perkly.test',    '{"full_name":"Omar Owner"}'),
  ('00000000-0000-0000-0000-00000000000c', 'student@perkly.test',  '{"full_name":"Sara Student"}');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';
update profiles set role = 'merchant' where id = '00000000-0000-0000-0000-00000000000b';
insert into auth.users (id, email, raw_user_meta_data)
  select '00000000-0000-0000-0000-00000000000d', 'friend@perkly.test',
         jsonb_build_object('full_name', 'Fady Friend', 'referral_code', referral_code)
    from profiles where id = '00000000-0000-0000-0000-00000000000c';

do $$ begin
  assert (select count(*) from profiles) = 4, 'profiles created by trigger';
  assert (select count(*) from user_stats) = 4, 'stats created by trigger';
  assert (select referred_by from profiles where id = '00000000-0000-0000-0000-00000000000d')
         = '00000000-0000-0000-0000-00000000000c', 'referral linked';
end $$;

-- Owner of Costa Coffee; capture codes for tests
insert into merchant_members (merchant_id, user_id, member_role)
  select id, '00000000-0000-0000-0000-00000000000b', 'owner' from merchants where name = 'Costa Coffee';
select q.code as costa_code, b.lat as costa_lat, b.lng as costa_lng, m.id as costa_id
  from branch_qr_codes q join merchant_branches b on b.id = q.branch_id join merchants m on m.id = b.merchant_id
 where m.name = 'Costa Coffee' limit 1 \gset
select q.code as kfc_code, b.lat as kfc_lat, b.lng as kfc_lng
  from branch_qr_codes q join merchant_branches b on b.id = q.branch_id join merchants m on m.id = b.merchant_id
 where m.name = 'KFC' limit 1 \gset
select id as costa_perk from perks where merchant_id = :'costa_id' and discount_value = 10 \gset
select p.id as kfc_perk from perks p join merchants m on m.id = p.merchant_id where m.name = 'KFC' and p.discount_value = 10 \gset

-- ── Student session ──
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);

do $$ begin
  assert (select count(*) from branch_qr_codes) = 0, 'students cannot list QR codes';
  assert (select count(*) from merchants) = 89, 'students see live merchants';
end $$;

select lookup_qr(:'costa_code') as lookup \gset
select (:'lookup'::jsonb->>'ok')::boolean as ok, jsonb_array_length(:'lookup'::jsonb->'perks') as perk_count \gset
\if :ok
\else
  \echo 'lookup_qr failed'
  select assert_failed_see_message_above;
\endif
select lookup_qr('PK-NOPE')->>'error' = 'invalid_qr' as invalid_ok \gset
\if :invalid_ok
\else
  \echo 'invalid QR not rejected'
  select assert_failed_see_message_above;
\endif

-- First redemption: 200 EGP bill, 10% off
select redeem_perk(:'costa_code', :'costa_perk', 200, :costa_lat, :costa_lng) as r1 \gset
select (:'r1'::jsonb->>'ok')::boolean
   and (:'r1'::jsonb->>'discount_amount')::numeric = 20
   and (:'r1'::jsonb->>'final_amount')::numeric = 180
   and (:'r1'::jsonb->>'streak')::int = 1
   and (:'r1'::jsonb->>'xp_awarded')::int >= 45
   and jsonb_array_length(:'r1'::jsonb->'badges_unlocked') >= 1 as r1_ok \gset
\if :r1_ok
\else
  \echo 'first redemption assertions failed'
  select assert_failed_see_message_above;
\endif

-- Immediate repeat at same merchant -> too_soon
select redeem_perk(:'costa_code', :'costa_perk', 100, :costa_lat, :costa_lng)->>'error' = 'too_soon' as soon_ok \gset
\if :soon_ok
\else
  \echo 'too_soon not enforced'
  select assert_failed_see_message_above;
\endif

-- Wrong perk for this QR -> wrong_merchant
select redeem_perk(:'costa_code', :'kfc_perk', 100, :costa_lat, :costa_lng)->>'error' = 'wrong_merchant' as wm_ok \gset
\if :wm_ok
\else
  \echo 'wrong_merchant not enforced'
  select assert_failed_see_message_above;
\endif

-- Far away -> too_far
select redeem_perk(:'kfc_code', :'kfc_perk', 100, 0, 0)->>'error' = 'too_far' as far_ok \gset
\if :far_ok
\else
  \echo 'too_far not enforced'
  select assert_failed_see_message_above;
\endif

-- Direct insert into redemptions must fail
do $$ begin
  begin
    insert into redemptions (user_id, perk_id, merchant_id, branch_id, verification_code)
      select auth.uid(), id, merchant_id, (select id from merchant_branches limit 1), 'X' from perks limit 1;
    raise exception 'direct insert should have failed';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Self-promotion to admin is ignored
update profiles set role = 'admin', full_name = 'Sara S.' where id = auth.uid();
do $$ begin
  assert (select role from profiles where id = auth.uid()) = 'student', 'role must not change';
  assert (select full_name from profiles where id = auth.uid()) = 'Sara S.', 'name can change';
  assert (select count(*) from my_redemptions) = 1, 'history view';
  assert (select count(*) from get_leaderboard('all')) >= 1, 'leaderboard';
end $$;

-- Admin-only function must fail for students
do $$ begin
  begin perform admin_overview(); raise exception 'should fail';
  exception when insufficient_privilege then null; end;
end $$;

-- Streak continues from yesterday (simulate)
reset role;
update user_stats set last_redemption_date = cairo_today() - 1, current_streak = 2
 where user_id = '00000000-0000-0000-0000-00000000000c';
set role authenticated;
select redeem_perk(:'kfc_code', :'kfc_perk', null, :kfc_lat, :kfc_lng) as r2 \gset
select (:'r2'::jsonb->>'streak')::int = 3 and (:'r2'::jsonb->>'discount_amount') is null as r2_ok \gset
\if :r2_ok
\else
  \echo 'streak continuation failed' :r2
  select assert_failed_see_message_above;
\endif

-- ── Friend's first redemption gives referrer +50 ──
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
select redeem_perk(:'costa_code', :'costa_perk', 50, :costa_lat, :costa_lng)->>'ok' = 'true' as fr_ok \gset
\if :fr_ok
\else
  \echo 'friend redemption failed'
  select assert_failed_see_message_above;
\endif
reset role;
do $$ begin
  assert exists (select 1 from xp_events where user_id = '00000000-0000-0000-0000-00000000000c' and reason = 'referral' and amount = 50), 'referral XP';
end $$;

-- ── Merchant owner session ──
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$
declare v_mid uuid; v_perk uuid;
begin
  select id into v_mid from merchants where name = 'Costa Coffee';
  assert (select count(*) from redemptions) = 2, 'owner sees only own merchant redemptions';
  assert (select count(*) from branch_qr_codes) >= 1, 'owner sees own QR codes';
  assert (merchant_stats(v_mid)->>'redemptions')::int = 2, 'merchant stats';

  begin perform merchant_stats((select id from merchants where name = 'KFC')); raise exception 'should fail';
  exception when insufficient_privilege then null; end;

  update merchants set status = 'churned', description = 'Updated' where id = v_mid;
  assert (select status from merchants where id = v_mid) = 'live', 'owner cannot change status';

  begin
    insert into perks (merchant_id, title, discount_value) values (v_mid, 'Hero 40%', 40);
    raise exception 'high tier without limits should fail';
  exception when check_violation then null; end;

  insert into perks (merchant_id, title, discount_value, end_at, max_uses_per_user, daily_cap, status)
  values (v_mid, 'Hero 40%', 40, now() + interval '7 days', 1, 20, 'active') returning id into v_perk;
  assert (select status from perks where id = v_perk) = 'pending', 'high tier perk needs approval';

  insert into perks (merchant_id, title, discount_value) values (v_mid, 'Study snack 15%', 15) returning id into v_perk;
  assert (select status from perks where id = v_perk) = 'pending', 'every new perk waits for approval';

  begin
    insert into perks (merchant_id, title, discount_value) values ((select id from merchants where name = 'KFC'), 'Hack', 50);
    raise exception 'should not write other merchant perks';
  exception when insufficient_privilege or check_violation then null; end;
end $$;

-- ── Admin session ──
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin
  assert (admin_overview()->>'redemptions')::int = 3, 'admin overview';
  assert (admin_overview()->>'pending_perks')::int = 2, 'pending perks (every new merchant perk waits)';
  update perks set status = 'active' where status = 'pending';
  assert (select count(*) from perks where status = 'pending') = 0, 'admin approves';
  update redemptions set status = 'flagged', flag_reason = 'manual review' where true;
end $$;
reset role;

-- ── Arcade: tickets & spins ──
do $$ begin
  -- student c: 1 welcome + 1 first redemption today + 1 per completed quest
  assert (select spin_tickets from user_stats where user_id = '00000000-0000-0000-0000-00000000000c') >= 3, 'tickets earned';
end $$;
select set_config('test.d_code', referral_code, false) from profiles where id = '00000000-0000-0000-0000-00000000000d';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
do $$
declare r jsonb; v_before int; v_xp_before int; n int := 0;
begin
  select spin_tickets, total_xp into v_before, v_xp_before from user_stats where user_id = auth.uid();
  r := spin_wheel();
  assert (r->>'ok')::boolean, 'spin ok: ' || r::text;
  assert (r->>'tickets_left')::int = v_before - 1, 'ticket spent';
  assert (r->>'segment')::int between 0 and 7, 'segment index';
  assert (select count(*) from spins where user_id = auth.uid()) = 1, 'spin recorded';
  loop
    r := spin_wheel(); n := n + 1;
    exit when not (r->>'ok')::boolean or n > 50;
  end loop;
  assert r->>'error' = 'no_tickets', 'runs out of tickets';
  assert (select total_xp from user_stats where user_id = auth.uid()) > v_xp_before, 'spins award xp';
  assert (select count(*) from perk_popularity()) >= 1, 'perk popularity';
  update profiles set birth_date = '2005-04-01', marketing_opt_in = true, terms_accepted_at = now() where id = auth.uid();
  assert (select marketing_opt_in from profiles where id = auth.uid()), 'consent saved';
  assert apply_referral('NOPE')->>'error' = 'invalid_code', 'bad invite code';
  assert apply_referral((select referral_code from profiles where id = auth.uid()))->>'error' = 'invalid_code', 'no self referral';
  assert apply_referral(current_setting('test.d_code'))->>'error' = 'too_late', 'too late after redeeming';
end $$;
reset role;
