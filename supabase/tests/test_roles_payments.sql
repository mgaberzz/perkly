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
  assert (select bool_and(user_code ~ '^USR-[0-9]{6}$') from profiles), 'user codes';
  assert (select count(distinct user_code) = count(*) from profiles), 'user codes unique';
  assert (select bool_and(student_code ~ '^STU-[0-9]{6}$') from profiles where role = 'student'), 'student codes';
  assert (select bool_and(merchant_code ~ '^MER-[0-9]{5}$') from merchants), 'merchant codes';
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
  assert (select merchant_net from redemptions where id = (r->>'redemption_id')::uuid) = 243, 'merchant net';
  assert (select qr_code_id from redemptions where id = (r->>'redemption_id')::uuid) = current_setting('test.new_qr')::uuid, 'cashier tracked';
  assert redeem_perk('x', current_setting('test.costa_perk')::uuid, null, null, null, 'in_app')->>'error' = 'invalid_qr', 'bad qr';
end $$;

-- Owner sees balance & cashier insights; cannot create settlements
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$
declare s jsonb;
begin
  assert (select due_to_merchant from merchant_balances(current_setting('test.costa_id')::uuid)) = 243, 'due to merchant';
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
declare r jsonb; v_id uuid;
begin
  assert (select iban from merchant_balances(current_setting('test.costa_id')::uuid)) like 'EG38%', 'finance sees iban';
  r := create_settlements();
  assert (r->>'ok')::boolean and (r->>'settlements')::int = 1 and (r->>'total')::numeric = 243, 'settlement created: ' || r::text;
  assert (select due_to_merchant from merchant_balances(current_setting('test.costa_id')::uuid)) = 0, 'nothing left due';
  assert (select pending_settlements from merchant_balances(current_setting('test.costa_id')::uuid)) = 243, 'pending payout';
  select id into v_id from settlements where merchant_id = current_setting('test.costa_id')::uuid;
  assert mark_settlement_paid(v_id, '')->>'error' = 'reference_required', 'needs reference';
  assert (mark_settlement_paid(v_id, 'TRX-1')->>'ok')::boolean, 'paid';
  assert (select paid_out from merchant_balances(current_setting('test.costa_id')::uuid)) = 243, 'paid out';
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
