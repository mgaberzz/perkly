-- Allow the 'partner' role on profiles (partner portal users).
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student', 'merchant', 'partner', 'admin', 'operations', 'account_manager', 'finance'));
