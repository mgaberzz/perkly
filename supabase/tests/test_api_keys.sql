-- Merchant API keys, Operations API switch and monthly statements. Runs last.
\set ON_ERROR_STOP 1
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000a001', 'owner-api@perkly.test', '{"full_name":"Omar Owner"}'),
  ('00000000-0000-0000-0000-00000000a002', 'cashier-api@perkly.test', '{"full_name":"Cami Cashier"}');
update profiles set role = 'merchant' where id in ('00000000-0000-0000-0000-00000000a001','00000000-0000-0000-0000-00000000a002');
select id as m_id from merchants where name = 'Costa Coffee' \gset
select id as other_id from merchants where name = 'KFC' \gset
insert into merchant_members (merchant_id, user_id, member_role) values
  (:'m_id', '00000000-0000-0000-0000-00000000a001', 'owner'),
  (:'m_id', '00000000-0000-0000-0000-00000000a002', 'cashier');
select set_config('test.m_id', :'m_id', false), set_config('test.other_id', :'other_id', false);

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);
do $$
declare m uuid := current_setting('test.m_id'); o uuid := current_setting('test.other_id'); ok boolean;
  pk text := 'pk_live_' || repeat('A', 32);
begin
  perform save_api_credentials(m, pk, repeat('a', 64), 'enc1');
  assert (select public_key from merchant_api_credentials where merchant_id = m) = pk, 'owner sees own keys';
  -- recreate only the secret: public key stays
  perform save_api_credentials(m, null, repeat('d', 64), 'enc2');
  assert (select secret_hash = repeat('d', 64) and public_key = pk from merchant_api_credentials where merchant_id = m), 'secret recreated, public kept';
  begin perform save_api_credentials(o, 'pk_live_' || repeat('B', 32), repeat('b', 64), 'x'); ok := false; exception when others then ok := true; end;
  assert ok, 'cannot create keys for another merchant';
  begin perform save_api_credentials(m, 'bad', null, null); ok := false; exception when others then ok := true; end;
  assert ok, 'key format checked';
  assert (merchant_statement(m, current_date)->>'month') = to_char(current_date, 'YYYY-MM'), 'statement month';
  begin perform merchant_statement(o, current_date); ok := false; exception when others then ok := true; end;
  assert ok, 'no statement for another merchant';
end $$;

-- a cashier can't see or make keys
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a002', false);
do $$
declare m uuid := current_setting('test.m_id'); ok boolean;
begin
  assert (select count(*) from merchant_api_credentials) = 0, 'cashier sees no keys';
  begin perform save_api_credentials(m, null, repeat('c', 64), 'x'); ok := false; exception when others then ok := true; end;
  assert ok, 'cashier cannot change keys';
  begin perform * from api_key_lookup(repeat('d', 64)); ok := false; exception when others then ok := true; end;
  assert ok, 'signed-in users cannot call the key lookup';
end $$;

reset role;
do $$
declare m uuid := current_setting('test.m_id');
begin
  assert (select count(*) from api_key_lookup(repeat('a', 64))) = 0, 'old secret no longer works';
  assert (select merchant_id from api_key_lookup(repeat('d', 64))) = m, 'current secret resolves to its merchant';
  assert (select last_used_at is not null from merchant_api_credentials where merchant_id = m), 'last used recorded';
  update merchants set api_enabled = false where id = m;
  assert (select count(*) from api_key_lookup(repeat('d', 64))) = 0, 'Operations switched API off';
  update merchants set api_enabled = true where id = m;
end $$;

-- Operations revokes the keys
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select revoke_api_credentials(current_setting('test.m_id')::uuid);
reset role;
do $$ begin
  assert (select count(*) from api_key_lookup(repeat('d', 64))) = 0, 'revoked keys no longer work';
end $$;
