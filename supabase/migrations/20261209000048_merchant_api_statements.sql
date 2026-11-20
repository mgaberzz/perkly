-- Merchant self-service API keys (like Paymob's "API Keys" page), an Operations switch for API access,
-- and a monthly statement per merchant.

-- ── API access switch (Operations) ──
alter table public.merchants add column if not exists api_enabled boolean not null default true;

-- ── API credentials (one set per business, like Paymob's API Keys page) ──
-- public_key: not secret, identifies the business.  secret key: used as "Authorization: Bearer sk_live_…".
-- The secret is stored twice: a SHA-256 hash (for checking requests) and an encrypted copy (so owners can
-- View/Copy it again). It is encrypted by the web server with a key the database never sees.
create table if not exists public.merchant_api_credentials (
  merchant_id uuid primary key references public.merchants(id) on delete cascade,
  public_key text not null unique check (public_key ~ '^pk_live_[A-Za-z0-9]{24,64}$'),
  secret_hash text not null unique check (secret_hash ~ '^[0-9a-f]{64}$'),
  secret_enc text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  public_rotated_at timestamptz not null default now(),
  secret_rotated_at timestamptz not null default now(),
  last_used_at timestamptz
);
alter table public.merchant_api_credentials enable row level security;
revoke all on public.merchant_api_credentials from anon, authenticated;
grant select on public.merchant_api_credentials to authenticated;

create policy "api credentials: owners, managers and Perkly staff can see" on public.merchant_api_credentials
  for select to authenticated
  using (public.is_merchant_member(merchant_id, array['owner','manager'])
         or (public.is_staff(array['admin','operations','account_manager']) and public.can_see_merchant(merchant_id)));
-- no insert/update/delete policies: changes go through the functions below

-- Create the keys, or recreate one of them (pass null to keep the current public key / secret).
create or replace function public.save_api_credentials(p_merchant_id uuid, p_public text, p_secret_hash text, p_secret_enc text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_merchant_member(p_merchant_id, array['owner','manager']) then raise exception 'not allowed'; end if;
  if not coalesce((select api_enabled from merchants where id = p_merchant_id), false) then
    raise exception 'API access is turned off for this business. Contact Perkly.';
  end if;
  if (p_secret_hash is null) <> (p_secret_enc is null) then raise exception 'invalid key'; end if;
  if exists (select 1 from merchant_api_credentials where merchant_id = p_merchant_id) then
    update merchant_api_credentials set
      public_key = coalesce(p_public, public_key),
      public_rotated_at = case when p_public is null then public_rotated_at else now() end,
      secret_hash = coalesce(p_secret_hash, secret_hash), secret_enc = coalesce(p_secret_enc, secret_enc),
      secret_rotated_at = case when p_secret_hash is null then secret_rotated_at else now() end
    where merchant_id = p_merchant_id;
  else
    if p_public is null or p_secret_hash is null then raise exception 'invalid key'; end if;
    insert into merchant_api_credentials (merchant_id, public_key, secret_hash, secret_enc, created_by)
    values (p_merchant_id, p_public, p_secret_hash, p_secret_enc, auth.uid());
  end if;
end $$;

-- Operations: delete a business's keys (they stop working at once; the business can create new ones)
create or replace function public.revoke_api_credentials(p_merchant_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_staff(array['admin','operations']) and public.can_see_merchant(p_merchant_id)) then raise exception 'not allowed'; end if;
  delete from merchant_api_credentials where merchant_id = p_merchant_id;
end $$;

create or replace function public.set_merchant_api_access(p_merchant_id uuid, p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff(array['admin','operations']) then raise exception 'not allowed'; end if;
  update merchants set api_enabled = p_enabled where id = p_merchant_id;
end $$;

-- Used only by the server's API routes (service role): which business does this secret key belong to?
create or replace function public.api_key_lookup(p_hash text)
returns table (merchant_id uuid)
language sql volatile security definer set search_path = public as $$
  with u as (
    update merchant_api_credentials c set last_used_at = now()
      from merchants m
     where c.secret_hash = p_hash and m.id = c.merchant_id and m.api_enabled and m.status <> 'banned'
    returning c.merchant_id
  ) select * from u
$$;

revoke execute on function public.api_key_lookup(text) from public, anon, authenticated;
revoke execute on function public.save_api_credentials(uuid, text, text, text) from public, anon;
revoke execute on function public.revoke_api_credentials(uuid) from public, anon;
revoke execute on function public.set_merchant_api_access(uuid, boolean) from public, anon;
grant execute on function public.save_api_credentials(uuid, text, text, text) to authenticated;
grant execute on function public.revoke_api_credentials(uuid) to authenticated;
grant execute on function public.set_merchant_api_access(uuid, boolean) to authenticated;
grant execute on function public.api_key_lookup(text) to service_role;

-- ── Monthly statement (Cairo calendar month) ──
create or replace function public.merchant_statement(p_merchant_id uuid, p_month date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_from timestamptz := (date_trunc('month', p_month)::timestamp) at time zone 'Africa/Cairo';
  v_to   timestamptz := ((date_trunc('month', p_month) + interval '1 month')::timestamp) at time zone 'Africa/Cairo';
  v jsonb;
begin
  if not (public.is_merchant_member(p_merchant_id, array['owner','manager'])
          or (public.is_staff(array['admin','operations','finance','account_manager']) and public.can_see_merchant(p_merchant_id))) then
    raise exception 'not allowed';
  end if;
  with r as (
    select * from redemptions where merchant_id = p_merchant_id and created_at >= v_from and created_at < v_to
  ), ok as (select * from r where status <> 'reversed')
  select jsonb_build_object(
    'month', to_char(date_trunc('month', p_month), 'YYYY-MM'),
    'merchant', (select jsonb_build_object('name', name, 'code', merchant_code, 'commission_pct', commission_pct) from merchants where id = p_merchant_id),
    'transactions', (select count(*) from ok),
    'students', (select count(distinct user_id) from ok),
    'new_students', (select count(*) from ok where first_time_at_merchant),
    'bills', coalesce((select sum(original_amount) from ok), 0),
    'discounts', coalesce((select sum(discount_amount) from ok), 0),
    'paid_by_students', coalesce((select sum(final_amount) from ok), 0),
    'in_app', jsonb_build_object(
       'count', (select count(*) from ok where payment_method = 'in_app'),
       'amount', coalesce((select sum(final_amount) from ok where payment_method = 'in_app'), 0),
       'commission', coalesce((select sum(commission_amount) from ok where payment_method = 'in_app'), 0)),
    'cashier', jsonb_build_object(
       'count', (select count(*) from ok where payment_method = 'merchant'),
       'amount', coalesce((select sum(final_amount) from ok where payment_method = 'merchant'), 0),
       'commission', coalesce((select sum(commission_amount) from ok where payment_method = 'merchant'), 0)),
    'vat', coalesce((select sum(vat_amount) from ok), 0),
    'net', coalesce((select sum(settle_amount) from ok), 0),
    'reversed', jsonb_build_object('count', (select count(*) from r where status = 'reversed'),
                                   'amount', coalesce((select sum(original_amount) from r where status = 'reversed'), 0)),
    'by_branch', coalesce((select jsonb_agg(x order by x->>'branch') from (
        select jsonb_build_object('branch', coalesce(b.name, 'Online'), 'count', count(*), 'bills', coalesce(sum(ok.original_amount), 0),
                                  'discounts', coalesce(sum(ok.discount_amount), 0)) x
          from ok left join merchant_branches b on b.id = ok.branch_id group by b.name) t), '[]'::jsonb),
    'settlements', coalesce((select jsonb_agg(jsonb_build_object('code', settlement_code, 'amount', amount, 'paid', paid_amount,
                                  'status', status, 'paid_at', paid_at, 'reference', reference) order by paid_at)
          from settlements where merchant_id = p_merchant_id and paid_at >= v_from and paid_at < v_to), '[]'::jsonb)
  ) into v;
  return v;
end $$;
revoke execute on function public.merchant_statement(uuid, date) from public, anon;
grant execute on function public.merchant_statement(uuid, date) to authenticated;
