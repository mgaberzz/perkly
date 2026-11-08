-- Students can delete their own account from the app (required by the App Store and Google Play).
-- Redemptions and payments must stay for merchants' settlements and tax records, so the account is
-- anonymised rather than removed: personal data is erased, sign-in methods are removed and the
-- login is locked. The phone number / email become free to register a new account.

alter table public.profiles add column if not exists deleted_at timestamptz;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  select role into v_role from profiles where id = v_uid;
  if v_role is distinct from 'student' then
    raise exception 'Team, merchant and partner accounts are closed by the Perkly team. Contact support.';
  end if;

  -- Personal data on the profile (IDs stay so past transactions still add up)
  update profiles set
    full_name = null, phone = null, email = null, birth_date = null,
    avatar_url = null, avatar_path = null, avatar_config = null, avatar_kind = null,
    interests = '{}', marketing_opt_in = false,
    status = 'banned', deleted_at = now()
  where id = v_uid;

  delete from favorites where user_id = v_uid;

  -- Sign-in: no email/phone, no identities, sessions, passkeys or factors; login locked
  update auth.users set
    email = null, phone = null, raw_user_meta_data = '{}'::jsonb,
    banned_until = now() + interval '100 years'
  where id = v_uid;
  delete from auth.identities where user_id = v_uid;
  delete from auth.sessions where user_id = v_uid;
  delete from auth.webauthn_credentials where user_id = v_uid;
  delete from auth.mfa_factors where user_id = v_uid;
  delete from auth.one_time_tokens where user_id = v_uid;
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
