-- VAT on commission is optional:
--   • per merchant: merchants.vat_enabled (default on) — set by admin / operations
--   • platform-wide: app_settings 'tax'.vat_pct — set by admin; 0 = no VAT for anyone
-- Changing either recalculates only transactions that are not yet in a settlement (settled history keeps its amounts).

alter table public.merchants add column vat_enabled boolean not null default true;

-- VAT for one transaction
create or replace function public.vat_for(p_merchant_id uuid, p_commission numeric) returns numeric
language sql stable security definer set search_path = public as $$
  select case when coalesce((select vat_enabled from merchants where id = p_merchant_id), true)
              then round(coalesce(p_commission, 0) * public.vat_pct() / 100, 2) else 0 end
$$;
grant execute on function public.vat_for(uuid, numeric) to authenticated;

create or replace function public.fill_merchant_net() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.vat_amount is null then
    new.vat_amount := public.vat_for(new.merchant_id, new.commission_amount);
  end if;
  new.merchant_net := case when new.final_amount is null then null
                           else new.final_amount - coalesce(new.commission_amount, 0) - coalesce(new.vat_amount, 0) end;
  return new;
end $$;

-- Recalculate VAT on unsettled transactions (all merchants, or one)
create or replace function public.recalc_unsettled_vat(p_merchant_id uuid default null) returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  update redemptions r
     set vat_amount = public.vat_for(r.merchant_id, r.commission_amount),
         merchant_net = case when r.final_amount is null then null
                             else r.final_amount - coalesce(r.commission_amount, 0) - public.vat_for(r.merchant_id, r.commission_amount) end
   where r.settlement_id is null and (p_merchant_id is null or r.merchant_id = p_merchant_id);
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.recalc_unsettled_vat(uuid) from public, anon, authenticated;

create or replace function public.on_merchant_vat_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.recalc_unsettled_vat(new.id);
  return new;
end $$;
create trigger on_merchant_vat_change after update of vat_enabled on public.merchants
  for each row when (old.vat_enabled is distinct from new.vat_enabled)
  execute function public.on_merchant_vat_change();
revoke execute on function public.on_merchant_vat_change() from public, anon, authenticated;

-- Admin sets the platform VAT rate (0 = off)
create or replace function public.set_vat_rate(p_pct numeric) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'not_allowed'); end if;
  if p_pct is null or p_pct < 0 or p_pct > 100 then return jsonb_build_object('ok', false, 'error', 'invalid_rate'); end if;
  insert into app_settings (key, value) values ('tax', jsonb_build_object('vat_pct', p_pct))
  on conflict (key) do update set value = app_settings.value || jsonb_build_object('vat_pct', p_pct), updated_at = now();
  v_n := public.recalc_unsettled_vat(null);
  return jsonb_build_object('ok', true, 'vat_pct', p_pct, 'recalculated', v_n);
end $$;
revoke execute on function public.set_vat_rate(numeric) from public, anon;
grant execute on function public.set_vat_rate(numeric) to authenticated;

-- Only admin / operations may switch a merchant's VAT (commercial term, like commission)
create or replace function public.guard_merchant_update() returns trigger
language plpgsql set search_path = public as $$
declare v_system boolean := current_user in ('postgres', 'service_role', 'supabase_admin');
begin
  new.merchant_code := old.merchant_code;
  if not v_system and not public.is_staff(array['admin','operations']) then
    new.plan := old.plan;
    new.commission_pct := old.commission_pct;
    new.vat_enabled := old.vat_enabled;
    if not public.can_manage_merchant(old.id) then
      new.status := old.status;
      new.brand_type := old.brand_type;
    end if;
  end if;
  return new;
end $$;
