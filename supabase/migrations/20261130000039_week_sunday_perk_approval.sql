-- 1) The week starts on Sunday (leaderboard reset and weekly quests).
-- 2) Every new perk from a merchant waits for Perkly approval, and so does a change to its discount.

create or replace function public.week_start(d date) returns date
language sql immutable set search_path = public as $$ select d - extract(dow from d)::int $$;

-- Swap the Monday-based week for the Sunday-based one inside the two functions that use it
do $$
declare r record; v_def text;
begin
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('get_leaderboard', 'perform_redemption') loop
    v_def := pg_get_functiondef(r.oid);
    v_def := replace(v_def, 'date_trunc(''week'', cairo_today())::date', 'week_start(cairo_today())');
    v_def := replace(v_def, 'date_trunc(''week'', v_today)::date', 'week_start(v_today)');
    execute v_def;
  end loop;
end $$;

create or replace function public.guard_perk() returns trigger
language plpgsql set search_path = public as $$
declare
  v_high_tier boolean := new.discount_type = 'percentage' and new.discount_value > 30;
  v_privileged boolean := public.can_manage_merchant(new.merchant_id) or current_user in ('postgres', 'service_role', 'supabase_admin');
begin
  if v_high_tier and (new.end_at is null or new.max_uses_per_user is null or new.daily_cap is null) then
    raise exception 'Perks above 30%% need an end date, a per-student limit and a daily cap'
      using errcode = 'check_violation';
  end if;
  if new.branch_id is not null and not exists (
    select 1 from merchant_branches where id = new.branch_id and merchant_id = new.merchant_id
  ) then
    raise exception 'Branch does not belong to this merchant' using errcode = 'check_violation';
  end if;
  if not v_privileged then
    if tg_op = 'INSERT' then
      -- every new perk waits for Perkly
      new.status := 'pending';
    else
      if new.status not in ('pending', 'active', 'paused') then new.status := old.status; end if;
      -- merchants can't pause or activate a perk themselves
      if old.status in ('active', 'paused') and new.status in ('active', 'paused') then new.status := old.status; end if;
      -- a new discount, or sending a rejected perk again, goes back to Perkly
      if new.discount_value is distinct from old.discount_value or new.discount_type is distinct from old.discount_type
         or old.status = 'rejected' then
        new.status := 'pending';
      end if;
      if old.status = 'pending' then new.status := 'pending'; end if;
    end if;
  end if;
  return new;
end $$;
