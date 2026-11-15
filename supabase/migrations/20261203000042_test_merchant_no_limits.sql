-- Test merchants (listed in app_settings.test_merchants.ids) skip the "one redemption every 15 minutes"
-- and "N per shop per day" rules, so the team can test freely. Real merchants are not affected.
-- The list must be emptied at launch (the launch cleanup removes the Test Café).
insert into public.app_settings (key, value) values ('test_merchants', '{"ids": []}') on conflict (key) do nothing;

create or replace function public.is_test_merchant(p_merchant_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_settings s, jsonb_array_elements_text(coalesce(s.value->'ids', '[]'::jsonb)) x
                  where s.key = 'test_merchants' and x = p_merchant_id::text)
$$;
revoke execute on function public.is_test_merchant(uuid) from public, anon;

do $$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p where p.proname = 'perform_redemption' and p.pronamespace = 'public'::regnamespace;
  if v_def like '%is_test_merchant%' then return; end if;
  v_def := regexp_replace(v_def, 'if exists \(select 1 from redemptions(\s+)where user_id = p_user and merchant_id = p_merchant_id and status <> ''reversed''(\s+)and created_at > now\(\) - interval ''15 minutes''\) then',
    'if not public.is_test_merchant(p_merchant_id) and exists (select 1 from redemptions\1where user_id = p_user and merchant_id = p_merchant_id and status <> ''reversed''\2and created_at > now() - interval ''15 minutes'') then');
  v_def := replace(v_def, 'if v_count >= public.max_redemptions_per_merchant_per_day() then',
    'if not public.is_test_merchant(p_merchant_id) and v_count >= public.max_redemptions_per_merchant_per_day() then');
  if (length(v_def) - length(replace(v_def, 'is_test_merchant', ''))) / length('is_test_merchant') <> 2 then
    raise exception 'perform_redemption was not updated as expected';
  end if;
  execute v_def;
end $$;
