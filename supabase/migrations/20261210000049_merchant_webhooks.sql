-- Merchant webhooks: Perkly POSTs signed JSON to the business's own system when something happens.
--   Events: redemption.created, redemption.reversed, refund.requested, refund.decided, settlement.paid, ping (test)
--   Signature header:  Perkly-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>" with the endpoint secret>
-- Sending uses pg_net (async); a pg_cron job every minute records results and retries failures with backoff.

create table if not exists public.merchant_webhooks (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  url text not null check (url ~ '^https://[^/\s]+\.[^/\s]+' and length(url) <= 500),
  events text[] not null default array['redemption.created','redemption.reversed','refund.requested','refund.decided','settlement.paid'],
  secret text not null default ('whsec_' || encode(extensions.gen_random_bytes(24), 'hex')),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  secret_rotated_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  failures_in_row integer not null default 0
);
create index if not exists merchant_webhooks_merchant on public.merchant_webhooks (merchant_id);
alter table public.merchant_webhooks enable row level security;
revoke all on public.merchant_webhooks from anon, authenticated;
-- every column except the secret (owners read it through webhook_secret())
grant select (id, merchant_id, url, events, is_active, created_at, secret_rotated_at, last_success_at, last_failure_at, failures_in_row)
  on public.merchant_webhooks to authenticated;
create policy "webhooks: owners, managers and Perkly staff can see" on public.merchant_webhooks
  for select to authenticated
  using (public.is_merchant_member(merchant_id, array['owner','manager'])
         or (public.is_staff(array['admin','operations','account_manager']) and public.can_see_merchant(merchant_id)));

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references public.merchant_webhooks(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  event text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  request_id bigint,
  last_status_code integer,
  last_error text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);
create index if not exists webhook_deliveries_webhook on public.webhook_deliveries (webhook_id, created_at desc);
create index if not exists webhook_deliveries_due on public.webhook_deliveries (status, next_attempt_at) where status in ('pending','sending');
alter table public.webhook_deliveries enable row level security;
revoke all on public.webhook_deliveries from anon, authenticated;
grant select on public.webhook_deliveries to authenticated;
create policy "webhook deliveries: owners, managers and Perkly staff can see" on public.webhook_deliveries
  for select to authenticated
  using (public.is_merchant_member(merchant_id, array['owner','manager'])
         or (public.is_staff(array['admin','operations','account_manager']) and public.can_see_merchant(merchant_id)));

-- ── Managing endpoints (owners / managers) ──
create or replace function public.webhook_can_manage(p_merchant_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_merchant_member(p_merchant_id, array['owner','manager'])
$$;

create or replace function public.webhook_url_ok(p_url text) returns boolean
language sql immutable as $$
  -- public https URLs only (no localhost, private IPs or internal names)
  select p_url ~ '^https://[^/\s]+\.[^/\s]+'
     and p_url !~* '^https://(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.|0\.|\[|[^/]*\.(local|internal|lan)(/|:|$))'
     and length(p_url) <= 500
$$;

create or replace function public.create_webhook(p_merchant_id uuid, p_url text, p_events text[])
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.webhook_can_manage(p_merchant_id) then raise exception 'not allowed'; end if;
  if not coalesce((select api_enabled from merchants where id = p_merchant_id), false) then
    raise exception 'API access is turned off for this business. Contact Perkly.';
  end if;
  if not public.webhook_url_ok(trim(p_url)) then raise exception 'Use a public https:// address.'; end if;
  if p_events is null or cardinality(p_events) = 0
     or not p_events <@ array['redemption.created','redemption.reversed','refund.requested','refund.decided','settlement.paid'] then
    raise exception 'Choose at least one event.';
  end if;
  if (select count(*) from merchant_webhooks where merchant_id = p_merchant_id) >= 3 then
    raise exception 'You can have up to 3 webhook addresses.';
  end if;
  insert into merchant_webhooks (merchant_id, url, events, created_by) values (p_merchant_id, trim(p_url), p_events, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.update_webhook(p_id uuid, p_events text[], p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_m uuid;
begin
  select merchant_id into v_m from merchant_webhooks where id = p_id;
  if v_m is null or not public.webhook_can_manage(v_m) then raise exception 'not allowed'; end if;
  if p_events is not null and (cardinality(p_events) = 0
     or not p_events <@ array['redemption.created','redemption.reversed','refund.requested','refund.decided','settlement.paid']) then
    raise exception 'Choose at least one event.';
  end if;
  update merchant_webhooks set events = coalesce(p_events, events), is_active = coalesce(p_active, is_active),
         failures_in_row = case when p_active then 0 else failures_in_row end
   where id = p_id;
end $$;

create or replace function public.delete_webhook(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_m uuid;
begin
  select merchant_id into v_m from merchant_webhooks where id = p_id;
  if v_m is null then return; end if;
  if not (public.webhook_can_manage(v_m) or (public.is_staff(array['admin','operations']) and public.can_see_merchant(v_m))) then
    raise exception 'not allowed';
  end if;
  delete from merchant_webhooks where id = p_id;
end $$;

create or replace function public.webhook_secret(p_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_m uuid; v_s text;
begin
  select merchant_id, secret into v_m, v_s from merchant_webhooks where id = p_id;
  if v_m is null or not public.webhook_can_manage(v_m) then raise exception 'not allowed'; end if;
  return v_s;
end $$;

create or replace function public.rotate_webhook_secret(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_m uuid; v_s text := 'whsec_' || encode(extensions.gen_random_bytes(24), 'hex');
begin
  select merchant_id into v_m from merchant_webhooks where id = p_id;
  if v_m is null or not public.webhook_can_manage(v_m) then raise exception 'not allowed'; end if;
  update merchant_webhooks set secret = v_s, secret_rotated_at = now() where id = p_id;
  return v_s;
end $$;

-- ── Sending ──
create or replace function public.webhook_send(p_delivery uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  d webhook_deliveries; w merchant_webhooks;
  v_ts text := floor(extract(epoch from now()))::bigint::text;
  v_body jsonb; v_sig text; v_req bigint;
begin
  select * into d from webhook_deliveries where id = p_delivery for update skip locked;
  if d.id is null or d.status not in ('pending') then return; end if;
  select * into w from merchant_webhooks where id = d.webhook_id;
  if w.id is null or not w.is_active or not coalesce((select api_enabled from merchants where id = d.merchant_id), false) then
    update webhook_deliveries set status = 'failed', last_error = 'Webhook turned off' where id = d.id;
    return;
  end if;
  v_body := d.payload;
  -- pg_net sends the body as body::text, so we sign exactly that text
  v_sig := encode(extensions.hmac(convert_to(v_ts || '.' || v_body::text, 'UTF8'), convert_to(w.secret, 'UTF8'), 'sha256'), 'hex');
  begin
    v_req := net.http_post(
      url := w.url, body := v_body,
      headers := jsonb_build_object('Content-Type', 'application/json', 'User-Agent', 'Perkly-Webhooks/1',
        'Perkly-Event', d.event, 'Perkly-Delivery', d.id::text, 'Perkly-Signature', 't=' || v_ts || ',v1=' || v_sig),
      timeout_milliseconds := 10000);
  exception when others then
    update webhook_deliveries set attempts = attempts + 1, last_error = left(sqlerrm, 300),
           status = case when attempts + 1 >= 6 then 'failed' else 'pending' end,
           next_attempt_at = now() + make_interval(mins => (array[1,5,30,120,600])[least(attempts + 1, 5)])
     where id = d.id;
    return;
  end;
  update webhook_deliveries set status = 'sending', request_id = v_req, attempts = attempts + 1 where id = d.id;
end $$;

-- Queue an event for every active endpoint of the business that wants it, and send right away
create or replace function public.webhook_emit(p_merchant_id uuid, p_event text, p_data jsonb, p_only uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare w record; v_id uuid;
begin
  for w in select id from merchant_webhooks
            where merchant_id = p_merchant_id and is_active
              and (p_only is not null and id = p_only or p_only is null and p_event = any(events))
  loop
    v_id := gen_random_uuid();
    insert into webhook_deliveries (id, webhook_id, merchant_id, event, payload)
    values (v_id, w.id, p_merchant_id, p_event,
            jsonb_build_object('id', v_id, 'type', p_event, 'created_at', now(), 'data', p_data));
    perform public.webhook_send(v_id);
  end loop;
end $$;

-- Every minute: record pg_net results, retry failures (1, 5, 30, 120, 600 minutes; 6 tries in total)
create or replace function public.webhook_process()
returns integer language plpgsql security definer set search_path = public as $$
declare d record; v_code integer; v_timeout boolean; v_err text; n integer := 0;
begin
  for d in select * from webhook_deliveries where status = 'sending' and request_id is not null limit 500 loop
    select status_code, timed_out, error_msg into v_code, v_timeout, v_err from net._http_response where id = d.request_id;
    if not found then
      -- no answer recorded after 5 minutes: treat as a failed try
      if d.next_attempt_at > now() - interval '5 minutes' then continue; end if;
      v_code := null; v_timeout := true; v_err := 'No response';
    end if;
    if v_code between 200 and 299 then
      update webhook_deliveries set status = 'sent', last_status_code = v_code, last_error = null, delivered_at = now() where id = d.id;
      update merchant_webhooks set last_success_at = now(), failures_in_row = 0 where id = d.webhook_id;
    else
      update webhook_deliveries set last_status_code = v_code,
             last_error = left(coalesce(v_err, case when v_timeout then 'Timed out' else 'HTTP ' || v_code end), 300),
             status = case when attempts >= 6 then 'failed' else 'pending' end,
             next_attempt_at = now() + make_interval(mins => (array[1,5,30,120,600])[least(attempts, 5)])
       where id = d.id;
      update merchant_webhooks set last_failure_at = now(), failures_in_row = failures_in_row + 1 where id = d.webhook_id;
    end if;
    n := n + 1;
  end loop;
  for d in select id from webhook_deliveries where status = 'pending' and next_attempt_at <= now() order by next_attempt_at limit 200 loop
    perform public.webhook_send(d.id);
    n := n + 1;
  end loop;
  -- an endpoint failing 50 times in a row is switched off (the business can switch it back on)
  update merchant_webhooks set is_active = false where is_active and failures_in_row >= 50;
  return n;
end $$;

-- Test event from the portal
create or replace function public.send_test_webhook(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_m uuid;
begin
  select merchant_id into v_m from merchant_webhooks where id = p_id;
  if v_m is null or not public.webhook_can_manage(v_m) then raise exception 'not allowed'; end if;
  perform public.webhook_emit(v_m, 'ping', jsonb_build_object('message', 'Test event from Perkly. Your webhook works.'), p_id);
end $$;

-- ── Event payloads (no student personal data) ──
create or replace function public.webhook_tx(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', r.tx_code, 'uuid', r.id, 'code', r.verification_code, 'created_at', r.created_at, 'status', r.status,
    'channel', r.channel, 'payment', case when r.payment_method = 'in_app' then 'in_app' else 'cashier' end,
    'bill', r.original_amount, 'discount', r.discount_amount, 'paid', r.final_amount, 'currency', 'EGP',
    'new_customer', r.first_time_at_merchant, 'receipt_ref', r.receipt_ref,
    'branch', case when b.id is null then null else jsonb_build_object('id', b.id, 'name', b.name) end,
    'cashier', coalesce(q.cashier_name, q.label),
    'perk', case when p.id is null then null else jsonb_build_object('id', p.id, 'title', p.title) end)
  from redemptions r
  left join merchant_branches b on b.id = r.branch_id
  left join branch_qr_codes q on q.id = r.qr_code_id
  left join perks p on p.id = r.perk_id
  where r.id = p_id
$$;

create or replace function public.webhook_on_redemption() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from merchant_webhooks where merchant_id = new.merchant_id and is_active) then return new; end if;
  if tg_op = 'INSERT' then
    perform public.webhook_emit(new.merchant_id, 'redemption.created', public.webhook_tx(new.id));
  elsif new.status = 'reversed' and old.status is distinct from 'reversed' then
    perform public.webhook_emit(new.merchant_id, 'redemption.reversed', public.webhook_tx(new.id));
  end if;
  return new;
exception when others then
  -- a webhook problem must never stop a redemption, refund or payout
  raise warning 'webhook %: %', tg_name, sqlerrm;
  return new;
end $$;
create or replace trigger webhook_redemption after insert or update of status on public.redemptions
  for each row execute function public.webhook_on_redemption();

create or replace function public.webhook_on_refund() returns trigger
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not exists (select 1 from merchant_webhooks where merchant_id = new.merchant_id and is_active) then return new; end if;
  v := jsonb_build_object('id', new.refund_code, 'transaction_id', (select tx_code from redemptions where id = new.redemption_id),
         'amount', new.amount, 'paid_in_app', new.paid_in_app, 'reason', new.reason, 'status', new.status,
         'created_at', new.created_at, 'decided_at', new.decided_at, 'decision_note', new.decision_note);
  if tg_op = 'INSERT' then
    perform public.webhook_emit(new.merchant_id, 'refund.requested', v);
  elsif new.status is distinct from old.status and new.status <> 'pending' then
    perform public.webhook_emit(new.merchant_id, 'refund.decided', v);
  end if;
  return new;
exception when others then
  -- a webhook problem must never stop a redemption, refund or payout
  raise warning 'webhook %: %', tg_name, sqlerrm;
  return new;
end $$;
create or replace trigger webhook_refund after insert or update of status on public.refund_requests
  for each row execute function public.webhook_on_refund();

create or replace function public.webhook_on_settlement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.paid_amount is distinct from old.paid_amount and coalesce(new.paid_amount, 0) > coalesce(old.paid_amount, 0)
     and exists (select 1 from merchant_webhooks where merchant_id = new.merchant_id and is_active) then
    perform public.webhook_emit(new.merchant_id, 'settlement.paid', jsonb_build_object(
      'id', new.settlement_code, 'amount', abs(new.amount), 'direction', case when new.amount >= 0 then 'perkly_to_merchant' else 'merchant_to_perkly' end,
      'paid', new.paid_amount, 'paid_now', new.paid_amount - coalesce(old.paid_amount, 0), 'status', new.status,
      'reference', new.reference, 'period_start', new.period_start, 'period_end', new.period_end, 'paid_at', new.paid_at));
  end if;
  return new;
exception when others then
  -- a webhook problem must never stop a redemption, refund or payout
  raise warning 'webhook %: %', tg_name, sqlerrm;
  return new;
end $$;
create or replace trigger webhook_settlement after update of paid_amount on public.settlements
  for each row execute function public.webhook_on_settlement();

-- Old delivery logs are kept for 30 days
create or replace function public.webhook_cleanup() returns void
language sql security definer set search_path = public as $$
  delete from webhook_deliveries where created_at < now() - interval '30 days' and status in ('sent','failed')
$$;

revoke execute on function public.webhook_send(uuid), public.webhook_emit(uuid, text, jsonb, uuid), public.webhook_process(),
  public.webhook_tx(uuid), public.webhook_cleanup() from public, anon, authenticated;
revoke execute on function public.create_webhook(uuid, text, text[]), public.update_webhook(uuid, text[], boolean), public.delete_webhook(uuid),
  public.webhook_secret(uuid), public.rotate_webhook_secret(uuid), public.send_test_webhook(uuid) from public, anon;
grant execute on function public.create_webhook(uuid, text, text[]), public.update_webhook(uuid, text[], boolean), public.delete_webhook(uuid),
  public.webhook_secret(uuid), public.rotate_webhook_secret(uuid), public.send_test_webhook(uuid) to authenticated;

-- Schedules (only where pg_cron exists, i.e. on Supabase)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('perkly-webhooks', '* * * * *', 'select public.webhook_process()');
    perform cron.schedule('perkly-webhooks-cleanup', '17 3 * * *', 'select public.webhook_cleanup()');
  end if;
end $$;
