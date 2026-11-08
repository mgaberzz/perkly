-- Number-only IDs. The FIRST DIGIT says what the number is, and each type has its own fixed length,
-- so no two IDs of any type can ever be the same number:
--   1xxxxxxx    (8 digits)  User ID        10000001 – 19999999
--   2xxxxxxx    (8 digits)  Student ID     20000001 – 29999999
--   3xxxxx      (6 digits)  Merchant ID    300001   – 399999
--   9xxxxxxxxx  (10 digits) Transaction ID 9000000001 – 9999999999
-- Existing IDs keep their running number: USR-100001 → 10000001, STU-100001 → 20000001,
-- MER-10001 → 300001, TRX-1000001 → 9000000001.

-- re-number existing rows (old prefix removed, running number kept).
-- The guard triggers normally forbid changing an ID, so they are paused for this one-off renumbering.
alter table public.profiles disable trigger guard_profile_update;
alter table public.merchants disable trigger guard_merchant_update;
update public.profiles set user_code = (10000000 + (substring(user_code from 5)::bigint - 100000))::text where user_code like 'USR-%';
update public.profiles set student_code = (20000000 + (substring(student_code from 5)::bigint - 100000))::text where student_code like 'STU-%';
update public.merchants set merchant_code = (300000 + (substring(merchant_code from 5)::bigint - 10000))::text where merchant_code like 'MER-%';
alter table public.redemptions disable trigger keep_tx_code;
update public.redemptions set tx_code = (9000000000 + (substring(tx_code from 5)::bigint - 1000000))::text where tx_code like 'TRX-%';
alter table public.redemptions enable trigger keep_tx_code;
alter table public.profiles enable trigger guard_profile_update;
alter table public.merchants enable trigger guard_merchant_update;

-- each sequence now lives inside its own range (it stops instead of spilling into another type's range)
do $$
declare v bigint;
begin
  select coalesce(max(user_code::bigint), 10000000) into v from public.profiles where user_code ~ '^[0-9]+$';
  execute format('alter sequence public.user_code_seq minvalue 10000001 maxvalue 19999999 start with 10000001 restart with %s', greatest(v + 1, 10000001));
  select coalesce(max(student_code::bigint), 20000000) into v from public.profiles where student_code ~ '^[0-9]+$';
  execute format('alter sequence public.student_code_seq minvalue 20000001 maxvalue 29999999 start with 20000001 restart with %s', greatest(v + 1, 20000001));
  select coalesce(max(merchant_code::bigint), 300000) into v from public.merchants where merchant_code ~ '^[0-9]+$';
  execute format('alter sequence public.merchant_code_seq minvalue 300001 maxvalue 399999 start with 300001 restart with %s', greatest(v + 1, 300001));
  select coalesce(max(tx_code::bigint), 9000000000) into v from public.redemptions where tx_code ~ '^[0-9]+$';
  execute format('alter sequence public.tx_code_seq minvalue 9000000001 maxvalue 9999999999 start with 9000000001 restart with %s', greatest(v + 1, 9000000001));
end $$;

alter table public.profiles alter column user_code set default (nextval('public.user_code_seq')::text);
alter table public.merchants alter column merchant_code set default (nextval('public.merchant_code_seq')::text);
alter table public.redemptions alter column tx_code set default (nextval('public.tx_code_seq')::text);

create or replace function public.assign_student_code() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'student' and new.student_code is null then
    new.student_code := nextval('public.student_code_seq')::text;
  end if;
  return new;
end $$;

-- the format is enforced, so the first digit can always be trusted
alter table public.profiles add constraint profiles_user_code_format check (user_code ~ '^1[0-9]{7}$');
alter table public.profiles add constraint profiles_student_code_format check (student_code is null or student_code ~ '^2[0-9]{7}$');
alter table public.merchants add constraint merchants_merchant_code_format check (merchant_code ~ '^3[0-9]{5}$');
alter table public.redemptions add constraint redemptions_tx_code_format check (tx_code ~ '^9[0-9]{9}$');

-- What kind of ID is this number? (for support/search: 'user' | 'student' | 'merchant' | 'transaction' | null)
create or replace function public.id_kind(p_code text) returns text
language sql immutable as $$
  select case
    when p_code ~ '^1[0-9]{7}$' then 'user'
    when p_code ~ '^2[0-9]{7}$' then 'student'
    when p_code ~ '^3[0-9]{5}$' then 'merchant'
    when p_code ~ '^9[0-9]{9}$' then 'transaction'
  end
$$;
grant execute on function public.id_kind(text) to authenticated;
