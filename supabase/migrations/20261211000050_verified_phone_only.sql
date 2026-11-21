-- A student (or merchant) can only put a mobile number on their profile after confirming it by SMS:
-- the profile number must match the number on the sign-in account (set by verifyOtp type 'phone_change').
-- Perkly staff and server code (no signed-in user) are not limited. Clearing the number is always allowed.
create or replace function public.guard_profile_phone() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_auth text;
begin
  if new.phone is null or new.phone is not distinct from old.phone then return new; end if;
  if auth.uid() is null or auth.uid() <> new.id or public.is_staff() then return new; end if;
  select phone into v_auth from auth.users where id = new.id;
  if regexp_replace(new.phone, '\D', '', 'g') is distinct from regexp_replace(coalesce(v_auth, ''), '\D', '', 'g') then
    raise exception 'phone_not_verified' using hint = 'Confirm the number with the SMS code first.';
  end if;
  return new;
end $$;
create or replace trigger guard_profile_phone before update of phone on public.profiles
  for each row execute function public.guard_profile_phone();
