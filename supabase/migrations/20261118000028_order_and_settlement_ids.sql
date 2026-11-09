-- Short numeric IDs for settlements (5xxxxxxx) and online orders (6xxxxxxxxx), and an optional
-- shop receipt / order number on every transaction so it can be matched to the shop's own system.

-- ───────── Settlement ID: 8 digits starting with 5 ─────────
create sequence if not exists public.settlement_code_seq minvalue 50000001 maxvalue 59999999 start with 50000001;
alter table public.settlements add column if not exists settlement_code text;
update public.settlements set settlement_code = nextval('public.settlement_code_seq')::text where settlement_code is null;
alter table public.settlements
  alter column settlement_code set default nextval('public.settlement_code_seq')::text,
  alter column settlement_code set not null,
  add constraint settlements_code_format check (settlement_code ~ '^5[0-9]{7}$'),
  add constraint settlements_code_unique unique (settlement_code);

-- ───────── Perkly Order ID for online orders: 10 digits starting with 6 ─────────
create sequence if not exists public.order_code_seq minvalue 6000000001 maxvalue 6999999999 start with 6000000001;
alter table public.online_orders add column if not exists order_code text;
update public.online_orders set order_code = nextval('public.order_code_seq')::text where order_code is null;
alter table public.online_orders
  alter column order_code set default nextval('public.order_code_seq')::text,
  alter column order_code set not null,
  add constraint online_orders_code_format check (order_code ~ '^6[0-9]{9}$'),
  add constraint online_orders_code_unique unique (order_code);

create or replace function public.id_kind(p_code text) returns text
language sql immutable as $$
  select case
    when p_code ~ '^1[0-9]{7}$' then 'user'
    when p_code ~ '^2[0-9]{7}$' then 'student'
    when p_code ~ '^3[0-9]{5}$' then 'merchant'
    when p_code ~ '^4[0-9]{5}$' then 'partner'
    when p_code ~ '^5[0-9]{7}$' then 'settlement'
    when p_code ~ '^6[0-9]{9}$' then 'order'
    when p_code ~ '^9[0-9]{9}$' then 'transaction'
  end
$$;

-- ───────── Shop receipt / order number on a transaction ─────────
alter table public.redemptions add column if not exists receipt_ref text
  check (receipt_ref is null or (length(receipt_ref) between 1 and 40 and receipt_ref ~ '^[A-Za-z0-9 #/._-]+$'));
create index if not exists redemptions_receipt_ref_idx on public.redemptions (merchant_id, receipt_ref) where receipt_ref is not null;

-- Who may set it: the student (within 24 hours), the shop's team, or Perkly operations
create or replace function public.set_receipt_ref(p_redemption_id uuid, p_ref text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v redemptions; v_ref text := nullif(trim(coalesce(p_ref, '')), '');
begin
  select * into v from redemptions where id = p_redemption_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not (
       (v.user_id = auth.uid() and v.created_at > now() - interval '24 hours')
    or public.is_merchant_member(v.merchant_id, array['owner', 'manager', 'branch_manager', 'cashier'])
    or public.is_staff(array['admin', 'operations'])
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;
  if v_ref is not null and (length(v_ref) > 40 or v_ref !~ '^[A-Za-z0-9 #/._-]+$') then
    return jsonb_build_object('ok', false, 'error', 'bad_ref');
  end if;
  update redemptions set receipt_ref = v_ref where id = p_redemption_id;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.set_receipt_ref(uuid, text) from public, anon;
grant execute on function public.set_receipt_ref(uuid, text) to authenticated;

-- The student's history shows it too (new column at the end of the view)
create or replace view public.my_redemptions with (security_invoker = true) as
 select r.id, r.created_at, r.original_amount, r.discount_amount, r.final_amount, r.xp_awarded, r.status, r.verification_code,
        m.name as merchant_name, m.logo_url, coalesce(b.name, 'Online'::text) as branch_name, p.title as perk_title,
        r.channel, r.payment_method, r.payment_status, r.tx_code, r.receipt_ref
   from redemptions r
   join merchants m on m.id = r.merchant_id
   left join merchant_branches b on b.id = r.branch_id
   join perks p on p.id = r.perk_id
  where r.user_id = auth.uid();
