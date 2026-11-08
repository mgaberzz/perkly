-- Transaction ID: a permanent, readable ID for every transaction (TRX-1000001), like USR- / STU- / MER-.
-- Used in both portals, exports, search and the student's receipt. It never changes once given.

create sequence public.tx_code_seq start 1000001;
alter table public.redemptions add column tx_code text unique;
update public.redemptions r set tx_code = 'TRX-' || x.n
  from (select id, nextval('public.tx_code_seq') n from (select id from public.redemptions order by created_at, id) o) x
 where x.id = r.id;
alter table public.redemptions alter column tx_code set default ('TRX-' || nextval('public.tx_code_seq'));
alter table public.redemptions alter column tx_code set not null;

create or replace function public.keep_tx_code() returns trigger
language plpgsql set search_path = public as $$
begin
  new.tx_code := old.tx_code;
  return new;
end $$;
create trigger keep_tx_code before update of tx_code on public.redemptions
  for each row execute function public.keep_tx_code();
revoke execute on function public.keep_tx_code() from public, anon, authenticated;

-- Student's own history carries it too
create or replace view public.my_redemptions with (security_invoker = true) as
 select r.id, r.created_at, r.original_amount, r.discount_amount, r.final_amount, r.xp_awarded, r.status, r.verification_code,
        m.name as merchant_name, m.logo_url, coalesce(b.name, 'Online'::text) as branch_name, p.title as perk_title,
        r.channel, r.payment_method, r.payment_status, r.tx_code
   from redemptions r
   join merchants m on m.id = r.merchant_id
   left join merchant_branches b on b.id = r.branch_id
   join perks p on p.id = r.perk_id
  where r.user_id = auth.uid();
