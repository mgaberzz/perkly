-- Merchant webhooks: who can manage them, signing, triggers, retries. Runs after test_api_keys.sql.
\set ON_ERROR_STOP 1
reset role;
select id as m_id from merchants where name = 'Costa Coffee' \gset
select set_config('test.m_id', :'m_id', false);

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);  -- Costa owner
do $$
declare m uuid := current_setting('test.m_id'); w uuid; ok boolean;
begin
  w := create_webhook(m, 'https://hooks.example.com/perkly', array['redemption.created','redemption.reversed','refund.requested','settlement.paid']);
  perform set_config('test.wh', w::text, false);
  assert (select count(*) from merchant_webhooks where merchant_id = m) = 1, 'owner sees the webhook';
  assert webhook_secret(w) like 'whsec_%', 'owner can read the secret through the function';
  begin perform secret from merchant_webhooks; ok := false; exception when others then ok := true; end;
  assert ok, 'the secret column is not readable directly';
  begin perform create_webhook(m, 'http://insecure.example.com', array['ping']); ok := false; exception when others then ok := true; end;
  assert ok, 'http and unknown events refused';
  begin perform create_webhook(m, 'https://localhost/x', array['redemption.created']); ok := false; exception when others then ok := true; end;
  assert ok, 'localhost refused';
  begin perform create_webhook(m, 'https://192.168.1.5/x', array['redemption.created']); ok := false; exception when others then ok := true; end;
  assert ok, 'private address refused';
  perform send_test_webhook(w);
  assert (select count(*) from webhook_deliveries where webhook_id = w and event = 'ping') = 1, 'test event queued';
end $$;

-- cashier: no access
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a002', false);
do $$ declare ok boolean; begin
  assert (select count(*) from merchant_webhooks) = 0, 'cashier sees no webhooks';
  begin perform webhook_secret(current_setting('test.wh')::uuid); ok := false; exception when others then ok := true; end;
  assert ok, 'cashier cannot read the secret';
  begin perform create_webhook(current_setting('test.m_id')::uuid, 'https://a.example.com', array['redemption.created']); ok := false; exception when others then ok := true; end;
  assert ok, 'cashier cannot add webhooks';
end $$;

reset role;
do $$
declare m uuid := current_setting('test.m_id'); w uuid := current_setting('test.wh'); r uuid; d webhook_deliveries; c net.calls;
  v_sig text; v_ts text; v_secret text;
begin
  -- the ping was signed: recompute the HMAC over "<t>.<body>"
  select * into d from webhook_deliveries where webhook_id = w and event = 'ping';
  assert d.status = 'sending' and d.request_id is not null, 'ping handed to pg_net';
  select * into c from net.calls where id = d.request_id;
  assert c.url = 'https://hooks.example.com/perkly', 'sent to the endpoint';
  assert c.headers->>'Perkly-Event' = 'ping', 'event header';
  v_ts := substring(c.headers->>'Perkly-Signature' from 't=(\d+)');
  v_sig := substring(c.headers->>'Perkly-Signature' from 'v1=([0-9a-f]{64})');
  select secret into v_secret from merchant_webhooks where id = w;
  assert v_sig = encode(extensions.hmac(convert_to(v_ts || '.' || c.body::text, 'UTF8'), convert_to(v_secret, 'UTF8'), 'sha256'), 'hex'), 'signature verifies';
  assert c.body->>'type' = 'ping' and c.body->>'id' = d.id::text, 'payload shape';

  -- reversing a transaction sends redemption.reversed (no student data in it)
  select id into r from redemptions where merchant_id = m and status <> 'reversed' order by created_at limit 1;
  update redemptions set status = 'reversed' where id = r;
  select * into d from webhook_deliveries where webhook_id = w and event = 'redemption.reversed';
  assert d.id is not null, 'reversal event queued';
  assert d.payload->'data'->>'uuid' = r::text and d.payload->'data' ? 'bill', 'transaction payload';
  assert not (d.payload->'data' ?| array['user_id','student_code','full_name','phone','email']), 'no student data';
  update redemptions set status = 'success' where id = r;

  -- results: 200 = sent; 500 = retry later
  insert into net._http_response (id, status_code) values ((select request_id from webhook_deliveries where webhook_id = w and event = 'ping'), 200);
  insert into net._http_response (id, status_code) values (d.request_id, 500);
  perform webhook_process();
  assert (select status from webhook_deliveries where webhook_id = w and event = 'ping') = 'sent', 'ping marked sent';
  assert (select status = 'pending' and next_attempt_at > now() and attempts = 1 and last_status_code = 500
            from webhook_deliveries where id = d.id), 'failed delivery scheduled for retry';
  assert (select failures_in_row = 1 from merchant_webhooks where id = w), 'failure counted';

  -- events the endpoint didn't choose aren't sent
  perform webhook_emit(m, 'refund.decided', '{}'::jsonb);
  assert not exists (select 1 from webhook_deliveries where webhook_id = w and event = 'refund.decided'), 'unsubscribed event skipped';

  -- API access off: no more sending
  update merchants set api_enabled = false where id = m;
  perform webhook_emit(m, 'redemption.created', webhook_tx(r));
  assert (select status from webhook_deliveries where webhook_id = w and event = 'redemption.created' order by created_at desc limit 1) = 'failed', 'not sent while API access is off';
  update merchants set api_enabled = true where id = m;
end $$;

-- owner rotates the secret and deletes the webhook
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);
do $$ declare w uuid := current_setting('test.wh'); old text; begin
  old := webhook_secret(w);
  assert rotate_webhook_secret(w) <> old, 'new secret';
  perform delete_webhook(w);
  assert (select count(*) from merchant_webhooks) = 0, 'deleted';
end $$;
reset role;
