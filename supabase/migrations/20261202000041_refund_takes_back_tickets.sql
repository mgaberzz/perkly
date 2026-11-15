-- An approved refund also takes back the spin tickets that purchase earned (only tickets not yet used).
alter table public.redemptions add column if not exists tickets_awarded integer not null default 0;

-- First redemption of the (Cairo) day: +1 ticket, remembered on the redemption
create or replace function public.ticket_on_redemption() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from redemptions
     where user_id = new.user_id and id <> new.id and status <> 'reversed'
       and (created_at at time zone 'Africa/Cairo')::date = (new.created_at at time zone 'Africa/Cairo')::date
  ) then
    update user_stats set spin_tickets = least(spin_tickets + 1, 20) where user_id = new.user_id;
    update redemptions set tickets_awarded = tickets_awarded + 1 where id = new.id;
  end if;
  return new;
end $$;

-- Quest completed: +1 ticket, remembered on the redemption made in the same step (if any)
create or replace function public.ticket_on_quest() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.completed_at is not null and (tg_op = 'INSERT' or old.completed_at is null) then
    update user_stats set spin_tickets = least(spin_tickets + 1, 20) where user_id = new.user_id;
    update redemptions set tickets_awarded = tickets_awarded + 1
     where id = (select id from redemptions where user_id = new.user_id and created_at = now() order by id limit 1);
  end if;
  return new;
end $$;

do $$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p where p.proname = 'decide_refund' and p.pronamespace = 'public'::regnamespace;
  if v_def not like '%tickets_awarded%' then
    v_def := replace(v_def, 'total_redemptions = greatest(0, total_redemptions - 1),',
      'total_redemptions = greatest(0, total_redemptions - 1), spin_tickets = greatest(0, spin_tickets - coalesce(v.tickets_awarded, 0)),');
    if v_def not like '%tickets_awarded%' then raise exception 'decide_refund was not updated'; end if;
    execute v_def;
  end if;
end $$;
