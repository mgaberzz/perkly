-- Roles & privileges, unique IDs, cashier QR approvals, notification center,
-- in-app payments, settlements and online merchants. Runs after test_redemption.sql.
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'ops@perkly.test',      '{"full_name":"Olga Ops"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'am@perkly.test',       '{"full_name":"Amr AM"}'),
  ('00000000-0000-0000-0000-0000000000e3', 'finance@perkly.test',  '{"full_name":"Fatma Finance"}'),
  ('00000000-0000-0000-0000-0000000000e4', 'bm@perkly.test',       '{"full_name":"Bassem Branch"}'),
  ('00000000-0000-0000-0000-0000000000e5', 'buyer@perkly.test',    '{"full_name":"Bella Buyer"}');
update profiles set role = 'operations'      where id = '00000000-0000-0000-0000-0000000000e1';
update profiles set role = 'account_manager' where id = '00000000-0000-0000-0000-0000000000e2';
update profiles set role = 'finance'         where id = '00000000-0000-0000-0000-0000000000e3';
update profiles set role = 'merchant'        where id = '00000000-0000-0000-0000-0000000000e4';

-- ── Unique IDs ──
do $$ begin
  assert (select bool_and(user_code ~ '^1[0-9]{7}$') from profiles), 'user codes';
  assert (select count(distinct user_code) = count(*) from profiles), 'user codes unique';
  assert (select bool_and(student_code ~ '^2[0-9]{7}$') from profiles where role = 'student'), 'student codes';
  assert (select bool_and(merchant_code ~ '^3[0-9]{5}$') from merchants), 'merchant codes';
  assert (select count(distinct merchant_code) = count(*) from merchants), 'merchant codes unique';
  assert not exists (select 1 from merchants where brand_type not in ('local','chain','mega_account')), 'brand types';
end $$;

select m.id as costa_id, b.id as costa_branch, b.lat as costa_lat, b.lng as costa_lng
  from merchants m join merchant_branches b on b.merchant_id = m.id where m.name = 'Costa Coffee' order by b.name limit 1 \gset
select id as kfc_id from merchants where name = 'KFC' \gset
select id as costa_perk from perks where merchant_id = :'costa_id' and discount_value = 10 \gset
insert into merchant_members (merchant_id, user_id, member_role, branch_id)
values (:'costa_id', '00000000-0000-0000-0000-0000000000e4', 'branch_manager', :'costa_branch');
insert into staff_assignments (user_id, merchant_id) values ('00000000-0000-0000-0000-0000000000e2', :'costa_id');
select set_config('test.costa_id', :'costa_id', false), set_config('test.kfc_id', :'kfc_id', false),
       set_config('test.costa_branch', :'costa_branch', false), set_config('test.costa_perk', :'costa_perk', false);

-- earlier tests' redemptions happened "yesterday" (keeps cooldown/daily limits out of the way)
update redemptions set created_at = created_at - interval '1 day';

set role authenticated;

-- ── Branch manager: requests a cashier QR → pending, can't approve it ──
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e4', false);
do $$
declare v_qr uuid := gen_random_uuid();
begin
  insert into branch_qr_codes (id, branch_id, label, cashier_name, status)
  values (v_qr, current_setting('test.costa_branch')::uuid, 'Till 2', 'Mona', 'approved');
  assert (select status from branch_qr_codes where id = v_qr) = 'pending', 'merchant QR starts pending';
  update branch_qr_codes set status = 'approved' where id = v_qr;
  assert (select status from branch_qr_codes where id = v_qr) = 'pending', 'merchant cannot self-approve';
  assert (select count(*) from merchant_branches b join branch_qr_codes q on q.branch_id = b.id
           where b.merchant_id = current_setting('test.costa_id')::uuid and q.id = v_qr) = 1, 'bm sees own branch QR';
  assert (resolve_request((select id from admin_requests where ref_id = v_qr), true))->>'error' = 'not_allowed', 'bm cannot resolve';
  perform set_config('test.new_qr', v_qr::text, false);
  assert (merchant_stats(current_setting('test.costa_id')::uuid, 30, current_setting('test.costa_branch')::uuid)->>'redemptions') is not null, 'bm branch stats';
  begin
    perform merchant_stats(current_setting('test.costa_id')::uuid, 30);
    raise exception 'bm should not see merchant-wide stats';
  exception when insufficient_privilege then null; end;
  begin
    insert into branch_qr_codes (branch_id, label)
      select id, 'Hack' from merchant_branches where merchant_id = current_setting('test.kfc_id')::uuid limit 1;
    raise exception 'bm wrote another merchant QR';
  exception when insufficient_privilege then null; end;
end $$;

-- Pending QR can't be used by students
select code as pending_code from branch_qr_codes where id = current_setting('test.new_qr')::uuid \gset
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e5', false);
select lookup_qr(:'pending_code')->>'error' = 'invalid_qr' as pending_blocked \gset
\if :pending_blocked
\else
  \echo 'pending QR should be rejected'
  select assert_failed_see_message_above;
\endif

-- ── Account manager: sees only assigned merchants; approves the QR ──
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', false);
do $$
declare v_req uuid;
begin
  assert (select count(*) from branch_qr_codes q join merchant_branches b on b.id = q.branch_id
           where b.merchant_id = current_setting('test.kfc_id')::uuid) = 0, 'am cannot see unassigned QR';
  assert (select count(*) from merchant_members where merchant_id = current_setting('test.kfc_id')::uuid) = 0, 'am cannot see unassigned team';
  assert public.can_manage_merchant(current_setting('test.costa_id')::uuid), 'am manages assigned';
  assert not public.can_manage_merchant(current_setting('test.kfc_id')::uuid), 'am does not manage others';
  select id into v_req from admin_requests where ref_id = current_setting('test.new_qr')::uuid and status = 'pending';
  assert v_req is not null, 'request in notification center';
  assert (resolve_request(v_req, true, 'ok'))->>'ok' = 'true', 'am approves';
  assert (select status from branch_qr_codes where id = current_setting('test.new_qr')::uuid) = 'approved', 'QR approved';
  assert (select status from admin_requests where id = v_req) = 'approved', 'request closed';
  assert (resolve_request(v_req, true))->>'error' = 'already_resolved', 'no double resolve';
  update merchants set commission_pct = 1 where id = current_setting('test.costa_id')::uuid;
  assert (select commission_pct from merchants where id = current_setting('test.costa_id')::uuid) <> 1, 'am cannot change commission';
  begin
    perform merchant_stats(current_setting('test.kfc_id')::uuid, 30);
    raise exception 'am should not see KFC stats';
  exception when insufficient_privilege then null; end;
end $$;

-- ── Finance: reads everything, changes nothing ──
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e3', false);
do $$ begin
  assert (select count(*) from merchants) >= 89, 'finance reads merchants';
  update merchants set status = 'paused' where id = current_setting('test.kfc_id')::uuid;
  assert (select status from merchants where id = current_setting('test.kfc_id')::uuid) = 'live', 'finance cannot change merchants';
  assert not public.can_manage_merchant(current_setting('test.kfc_id')::uuid), 'finance manages nothing';
  begin
    update app_settings set value = '{"mode":"live"}' where key = 'payments';
    if found then raise exception 'finance changed settings'; end if;
  end;
end $$;

-- ── Operations: manages merchants + commission ──
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
do $$ begin
  update merchants set commission_pct = 10 where id = current_setting('test.costa_id')::uuid;
  assert (select commission_pct from merchants where id = current_setting('test.costa_id')::uuid) = 10, 'ops sets commission';
  assert (admin_overview()->>'pending_requests') is not null, 'ops overview';
  update merchants set channel = 'both', website_url = 'https://shop.costa.test', brand_type = 'mega_account'
   where id = current_setting('test.costa_id')::uuid;
end $$;

-- ── Student pays in-app (test mode) ──
select code as live_code from branch_qr_codes where id = current_setting('test.new_qr')::uuid \gset
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e5', false);
select redeem_perk(:'live_code', :'costa_perk', 300, :costa_lat, :costa_lng, 'in_app') as pay \gset
select set_config('test.pay', :'pay', false);
do $$
declare r jsonb := current_setting('test.pay')::jsonb;
begin
  assert (r->>'ok')::boolean, 'in-app pay ok: ' || r::text;
  assert r->>'payment_status' = 'paid' and r->>'payment_ref' like 'TEST-%', 'test payment';
  assert (r->>'final_amount')::numeric = 270, 'paid 270';
  assert (select commission_amount from redemptions where id = (r->>'redemption_id')::uuid) = 27, 'commission 10%';
  assert (select vat_amount from redemptions where id = (r->>'redemption_id')::uuid) = 3.78, 'VAT 14% of 27 commission';
  assert (select merchant_net from redemptions where id = (r->>'redemption_id')::uuid) = 239.22, 'merchant net = 270 - 27 - 3.78';
  assert (select qr_code_id from redemptions where id = (r->>'redemption_id')::uuid) = current_setting('test.new_qr')::uuid, 'cashier tracked';
  assert redeem_perk('x', current_setting('test.costa_perk')::uuid, null, null, null, 'in_app')->>'error' = 'invalid_qr', 'bad qr';
end $$;

-- Owner sees balance & cashier insights; cannot create settlements
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$
declare s jsonb;
begin
  assert (select due_to_merchant from merchant_balances(current_setting('test.costa_id')::uuid)) = 239.22, 'due to merchant';
  s := merchant_stats(current_setting('test.costa_id')::uuid, 30);
  assert jsonb_array_length(s->'by_cashier') >= 1, 'by cashier';
  assert (s->>'new_customer_pct')::int + (s->>'recurring_customer_pct')::int = 100, 'new vs recurring';
  assert create_settlements()->>'error' = 'not_allowed', 'owner cannot settle';
  insert into merchant_bank_accounts (merchant_id, bank_name, account_name, iban)
  values (current_setting('test.costa_id')::uuid, 'CIB', 'Costa Egypt', 'EG380019000500000000263180002');
end $$;

-- Student can't read bank accounts
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e5', false);
do $$ begin
  assert (select count(*) from merchant_bank_accounts) = 0, 'students cannot see bank details';
  assert (select count(*) from merchant_balances()) = 0, 'students see no balances';
end $$;

-- Finance settles and marks paid
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e3', false);
do $$
declare r jsonb; v_id uuid; v_net numeric;
begin
  assert (select iban from merchant_balances(current_setting('test.costa_id')::uuid)) like 'EG38%', 'finance sees iban';
  v_net := (select net_to_settle from merchant_balances(current_setting('test.costa_id')::uuid));
  assert v_net = (select sum(settle_amount) from redemptions where merchant_id = current_setting('test.costa_id')::uuid and status <> 'reversed'), 'net = in-app net − cashier commission';
  assert (select count(*) from redemptions where merchant_net is null and final_amount is not null) = 0, 'every priced transaction has a net';
  r := create_settlements(null, current_setting('test.costa_id')::uuid);
  assert (r->>'ok')::boolean and (r->>'settlements')::int = 1 and (r->>'total')::numeric = v_net, 'settlement created: ' || r::text;
  assert (select net_to_settle from merchant_balances(current_setting('test.costa_id')::uuid)) = 0, 'nothing left unsettled';
  assert (select pending_settlements from merchant_balances(current_setting('test.costa_id')::uuid)) = v_net, 'pending payout';
  select id into v_id from settlements where merchant_id = current_setting('test.costa_id')::uuid;
  assert (select bool_and(settlement_status_label(s.status) = 'Not settled yet') from redemptions r2 join settlements s on s.id = r2.settlement_id where s.id = v_id), 'not settled until finance pays';
  assert mark_settlement_paid(v_id, '')->>'error' = 'reference_required', 'needs reference';
  -- partial payment: 100 now
  assert (record_settlement_payment(v_id, 100, 'TRX-1')->>'status') = 'partially_paid', 'partial';
  assert (select bool_and(settlement_status_label(s.status) = 'Partially settled') from redemptions r2 join settlements s on s.id = r2.settlement_id where s.id = v_id), 'partially settled';
  assert record_settlement_payment(v_id, 100000, 'TRX-X')->>'error' = 'more_than_remaining', 'cannot overpay';
  assert (mark_settlement_paid(v_id, 'TRX-2')->>'ok')::boolean, 'rest paid';
  assert (select status from settlements where id = v_id) = 'paid', 'settled';
  assert (select count(*) from settlement_payments where settlement_id = v_id) = 2, 'two payments recorded';
  assert (select paid_out from merchant_balances(current_setting('test.costa_id')::uuid)) = abs(v_net), 'paid out';
end $$;

-- ── Online: one-time code ──
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
select get_online_code(:'costa_perk') as oc \gset
select :'oc'::jsonb->>'code' as online_code \gset
do $$ begin
  assert get_online_code((select id from perks where merchant_id = current_setting('test.kfc_id')::uuid limit 1))->>'error' = 'not_online', 'in-store only merchant';
end $$;
select get_online_code(:'costa_perk')->>'code' = :'online_code' as same_code \gset
\if :same_code
\else
  \echo 'should reuse the open code'
  select assert_failed_see_message_above;
\endif
-- The student can't confirm their own code
select confirm_online_code(:'online_code', 200)->>'error' = 'not_allowed' as self_blocked \gset
\if :self_blocked
\else
  \echo 'student confirmed own code'
  select assert_failed_see_message_above;
\endif
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select confirm_online_code(:'online_code', 200) as conf \gset
select set_config('test.conf', :'conf', false), set_config('test.online_code', :'online_code', false);
do $$
declare r jsonb := current_setting('test.conf')::jsonb;
begin
  assert (r->>'ok')::boolean, 'online confirm: ' || r::text;
  assert r->>'channel' = 'online' and r->>'branch_name' = 'Online', 'online channel';
  assert (r->>'final_amount')::numeric = 180, 'online discount';
  assert confirm_online_code(current_setting('test.online_code'), 200)->>'error' = 'already_used', 'one-time';
end $$;

-- ── Online: tracked link → order → cashback approved by finance ──
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e5', false);
select track_link(:'costa_id', :'costa_perk') as link \gset
select :'link'::jsonb->>'ref' as ref \gset
do $$ begin
  assert (select count(*) from my_redemptions where channel = 'in_store') = 1, 'history view';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select report_online_order(:'costa_id', :'ref', 'ORD-1', 500) as ord \gset
select set_config('test.ord', :'ord', false), set_config('test.ref', :'ref', false);
do $$
declare r jsonb := current_setting('test.ord')::jsonb;
begin
  assert (r->>'ok')::boolean and (r->>'cashback_amount')::numeric = 50, 'order reported: ' || r::text;
  assert report_online_order(current_setting('test.costa_id')::uuid, current_setting('test.ref'), 'ORD-1', 500)->>'error' = 'duplicate_order', 'dup';
  assert report_online_order(current_setting('test.kfc_id')::uuid, current_setting('test.ref'), 'ORD-2', 500)->>'error' = 'not_allowed', 'other merchant';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', false);
do $$ begin
  assert coalesce(resolve_request((select id from admin_requests where kind = 'cashback'), true)->>'error', '') in ('not_allowed', 'not_found'), 'am cannot approve cashback';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e3', false);
do $$ begin
  assert (select count(*) from admin_requests where kind = 'cashback' and status = 'pending') = 1, 'finance sees cashback request';
  assert (select count(*) from admin_requests where kind = 'qr_code') = 0, 'finance does not see QR requests';
  assert (resolve_request((select id from admin_requests where kind = 'cashback'), true)->>'ok')::boolean, 'finance approves';
end $$;
reset role;
do $$ begin
  assert (select cashback_balance from user_stats where user_id = '00000000-0000-0000-0000-0000000000e5') = 50, 'cashback credited';
  assert (select cashback_pending from user_stats where user_id = '00000000-0000-0000-0000-0000000000e5') = 0, 'pending cleared';
  assert (select status from online_orders) = 'approved', 'order approved';
end $$;

-- Self-promotion still blocked for every non-admin role
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
do $$ begin
  update profiles set role = 'admin' where id = auth.uid();
  assert (select role from profiles where id = '00000000-0000-0000-0000-0000000000e1') = 'operations', 'ops cannot self-promote';
end $$;
reset role;

-- ── Least privilege (migration 09) ──
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', false);
do $$ begin
  assert (select count(*) from staff_merchant_ids()) = 1, 'am sees only assigned merchant ids';
  assert (select count(*) from profiles where role = 'student') = (select count(distinct user_id) from redemptions), 'am sees only own customers';
  assert (select count(*) from profiles where role = 'student') < (select count(*) from user_stats) + 99, 'sanity';
  assert not exists (select 1 from profiles p where p.role = 'student' and not exists (select 1 from redemptions r where r.user_id = p.id)), 'no non-customers visible';
  assert (select count(*) from user_stats where user_id <> auth.uid()) = 0, 'am cannot read student stats';
  assert (admin_overview()->>'scope') = 'mine', 'am overview scoped';
  assert (select count(*) from admin_requests where kind = 'cashback') = 0, 'am does not see cashback requests';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e3', false);
do $$ begin
  assert (select count(*) from staff_merchant_ids()) >= 89, 'finance sees all merchants';
  assert (select count(*) from admin_requests where kind = 'qr_code') = 0, 'finance no qr requests';
  assert (select count(*) from user_stats where user_id <> auth.uid()) = 0, 'finance cannot read stats';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
do $$ begin
  assert (admin_overview()->>'scope') = 'all', 'ops overview all';
  assert (select count(*) from admin_requests where kind = 'cashback') = 0, 'ops does not see cashback';
  assert (select count(*) from user_stats) >= 5, 'ops reads stats';
end $$;
reset role;

-- ── Daily rule: 4 per merchant per day (migration 10) ──
do $$ begin
  assert public.max_redemptions_per_merchant_per_day() = 4, 'daily limit is 4';
end $$;
-- Student f redeems at KFC 4 times (cooldown skipped by backdating 16 min each time), the 5th is refused
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000f1', 'four@perkly.test', '{"full_name":"Fatma Four"}');
select q.code as k_code, b.lat as k_lat, b.lng as k_lng, p.id as k_perk
  from branch_qr_codes q join merchant_branches b on b.id = q.branch_id join merchants m on m.id = b.merchant_id
  join perks p on p.merchant_id = m.id and p.min_spend = 0 and p.status = 'active'
 where m.name = 'KFC' and q.status = 'approved' and q.is_active limit 1 \gset
select set_config('test.k_code', :'k_code', false), set_config('test.k_perk', :'k_perk', false),
       set_config('test.k_lat', :'k_lat', false), set_config('test.k_lng', :'k_lng', false);
do $$
declare r jsonb; i int; v_hour int := extract(hour from now() at time zone 'Africa/Cairo');
begin
  if v_hour < 2 then raise notice 'skipping daily-limit test right after midnight'; return; end if;
  for i in 1..5 loop
    perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', true);
    set local role authenticated;
    r := redeem_perk(current_setting('test.k_code'), current_setting('test.k_perk')::uuid, 100,
                     current_setting('test.k_lat')::float8, current_setting('test.k_lng')::float8);
    reset role;
    if i <= 4 then assert (r->>'ok')::boolean, 'redemption ' || i || ' should pass: ' || r::text;
    else assert r->>'error' = 'daily_merchant_limit' and (r->>'limit')::int = 4, '5th should be refused: ' || r::text;
    end if;
    update redemptions set created_at = created_at - interval '16 minutes' where user_id = '00000000-0000-0000-0000-0000000000f1';
  end loop;
end $$;

-- ── VAT on commission (migration 12): the 112 EGP example ──
do $$ begin
  assert round(89.60 * 5 / 100, 2) = 4.48 and round(4.48 * vat_pct() / 100, 2) = 0.63, 'example maths';
  assert not exists (select 1 from redemptions where final_amount is not null
                       and merchant_net <> final_amount - commission_amount - vat_amount), 'merchant net = paid - commission - VAT';
  assert not exists (select 1 from redemptions where vat_amount <> round(coalesce(commission_amount, 0) * 0.14, 2)), 'VAT is 14% of commission';
  assert not exists (select 1 from redemptions where payment_method = 'merchant'
                       and settle_amount <> -(commission_amount + vat_amount)), 'cashier: merchant owes commission + VAT';
end $$;

-- ── Insights & finance summary (migration 13) ──
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e3', false);
do $$ declare d text; s jsonb; begin
  foreach d in array array['sector','location','campus','age','merchant'] loop
    assert (select sum(transactions) from insights(d, 365)) = (select count(*) from redemptions where status <> 'reversed'),
      'insights ' || d || ' covers every transaction';
    assert (select sum(commission) from insights(d, 365)) = (select sum(commission_amount) from redemptions where status <> 'reversed'), 'commission adds up ' || d;
  end loop;
  s := finance_summary(365);
  assert (s->>'gmv')::numeric = (select sum(original_amount) from redemptions where status <> 'reversed'), 'gmv';
  assert (s->>'net_revenue')::numeric > 0, 'net revenue';
  assert (s->>'paid_to_merchants')::numeric >= 0 and (s->>'to_be_paid_to_merchants')::numeric >= 0, 'dues';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', false);
do $$ begin
  assert (select count(*) from insights('merchant', 365)) <= 1, 'account manager sees only own merchants in insights';
end $$;
reset role;

-- ── Optional VAT (migration 14) ──
-- KFC: switch VAT off (operations) → its unsettled transactions lose VAT; settled ones (Costa) keep theirs
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
update merchants set vat_enabled = false where name = 'KFC';
reset role;
do $$ begin
  assert (select vat_enabled from merchants where name = 'KFC') = false, 'ops can switch VAT off';
  assert not exists (select 1 from redemptions r join merchants m on m.id = r.merchant_id
                      where m.name = 'KFC' and r.settlement_id is null and r.vat_amount <> 0), 'KFC unsettled VAT = 0';
  assert not exists (select 1 from redemptions r join merchants m on m.id = r.merchant_id
                      where m.name = 'KFC' and r.final_amount is not null and r.merchant_net <> r.final_amount - r.commission_amount), 'KFC net = paid - commission';
  assert exists (select 1 from redemptions where settlement_id is not null and vat_amount > 0), 'settled history keeps VAT';
end $$;
-- Finance cannot change a merchant's VAT; only admin can change the rate
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e3', false);
do $$ begin
  assert set_vat_rate(0)->>'error' = 'not_allowed', 'finance cannot set rate';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin
  assert (set_vat_rate(0)->>'ok')::boolean, 'admin sets 0%';
  assert not exists (select 1 from redemptions where settlement_id is null and vat_amount <> 0), 'VAT off everywhere (unsettled)';
  assert (set_vat_rate(14)->>'ok')::boolean, 'admin back to 14%';
  assert exists (select 1 from redemptions r join merchants m on m.id = r.merchant_id where m.vat_enabled and r.settlement_id is null and r.vat_amount > 0)
         or not exists (select 1 from redemptions r join merchants m on m.id = r.merchant_id where m.vat_enabled and r.settlement_id is null and r.commission_amount > 0), 'VAT back on';
end $$;
reset role;

-- ── Insights series (migration 15) ──
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e3', false);
do $$ begin
  assert (select sum(gmv) from insights_series('sector', 365)) = (select sum(gmv) from insights('sector', 365)), 'series adds up to insights';
  assert (select sum(transactions) from insights_series('merchant', 365)) = (select count(*) from redemptions where status <> 'reversed'), 'series covers all';
end $$;
reset role;

-- Transaction IDs: every transaction has a unique TRX- ID that never changes
do $$ declare v_id uuid; v_code text; begin
  assert (select count(*) from redemptions where tx_code !~ '^9[0-9]{9}$') = 0, 'tx_code format';
  assert (select count(distinct tx_code) from redemptions) = (select count(*) from redemptions), 'tx_code unique';
  select id, tx_code into v_id, v_code from redemptions order by created_at limit 1;
  update redemptions set tx_code = '9999999999' where id = v_id;
  assert (select tx_code from redemptions where id = v_id) = v_code, 'tx_code cannot be changed';
end $$;

-- Profile photos: only a path inside the user's own folder is accepted
do $$ declare v uuid; ok boolean := false; begin
  select id into v from profiles where role = 'student' limit 1;
  update profiles set avatar_path = v::text || '/avatar-1.jpg' where id = v;
  assert (select avatar_path from profiles where id = v) = v::text || '/avatar-1.jpg', 'own avatar path saved';
  begin update profiles set avatar_path = gen_random_uuid()::text || '/x.jpg' where id = v; exception when check_violation then ok := true; end;
  assert ok, 'someone else''s folder refused'; ok := false;
  begin update profiles set avatar_path = 'https://evil.example/x.jpg' where id = v; exception when check_violation then ok := true; end;
  assert ok, 'free URLs refused';
  update profiles set avatar_path = null where id = v;
end $$;

-- Cartoon avatar: small JSON object only, and a known kind
do $$ declare v uuid; ok boolean := false; begin
  select id into v from profiles where role = 'student' limit 1;
  update profiles set avatar_config = '{"skin":2,"hair":"curly"}', avatar_kind = 'cartoon' where id = v;
  assert (select avatar_kind from profiles where id = v) = 'cartoon', 'cartoon saved';
  begin update profiles set avatar_config = '"text"' where id = v; exception when check_violation then ok := true; end;
  assert ok, 'non-object config refused'; ok := false;
  begin update profiles set avatar_config = jsonb_build_object('x', repeat('a', 5000)) where id = v; exception when check_violation then ok := true; end;
  assert ok, 'huge config refused'; ok := false;
  begin update profiles set avatar_kind = 'gif' where id = v; exception when check_violation then ok := true; end;
  assert ok, 'unknown kind refused';
  update profiles set avatar_config = null, avatar_kind = null where id = v;
end $$;

-- Number-only IDs: first digit = type, no number shared between types
do $$ begin
  assert (select count(*) from (
    select user_code c from profiles union all select student_code from profiles where student_code is not null
    union all select merchant_code from merchants union all select tx_code from redemptions) x)
    = (select count(distinct c) from (
    select user_code c from profiles union all select student_code from profiles where student_code is not null
    union all select merchant_code from merchants union all select tx_code from redemptions) x), 'every ID unique across all types';
  assert id_kind('10000001') = 'user' and id_kind('20000001') = 'student' and id_kind('300001') = 'merchant' and id_kind('9000000001') = 'transaction', 'id_kind';
  assert id_kind('12345') is null and id_kind('MER-10001') is null, 'unknown ids';
  assert (select min(user_code) from profiles) = '10000001', 'first user keeps running number';
end $$;
