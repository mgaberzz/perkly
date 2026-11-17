-- Emails go out in one language: the person's app language.
-- 1) profiles.lang is copied into the sign-in record (auth user metadata), where Supabase's email
--    templates can read it as {{ .Data.lang }}. An invite's chosen language becomes the profile language.
-- 2) Merchant applications remember the language of the form, for the confirmation email.

create or replace function public.profile_lang_from_invite() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_lang text;
begin
  select raw_user_meta_data->>'lang' into v_lang from auth.users where id = new.id;
  if v_lang in ('en', 'ar') then new.lang := v_lang; end if;
  return new;
end $$;
create or replace trigger profile_lang_from_invite before insert on public.profiles
  for each row execute function public.profile_lang_from_invite();

create or replace function public.sync_lang_to_auth() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('lang', new.lang)
   where id = new.id and coalesce(raw_user_meta_data->>'lang', '') is distinct from new.lang;
  return null;
end $$;
create or replace trigger sync_lang_to_auth after insert or update of lang on public.profiles
  for each row execute function public.sync_lang_to_auth();
revoke execute on function public.profile_lang_from_invite(), public.sync_lang_to_auth() from public, anon, authenticated;

-- Existing accounts: the profile language is the app setting
update auth.users u set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('lang', p.lang)
  from public.profiles p where p.id = u.id and coalesce(u.raw_user_meta_data->>'lang', '') is distinct from p.lang;

-- Applications remember the form's language
alter table public.merchant_applications add column if not exists lang text not null default 'en' check (lang in ('en', 'ar'));

create or replace function public.submit_merchant_application(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(coalesce(p->>'contact_email', '')));
begin
  if (select count(*) from merchant_applications where created_at > now() - interval '1 hour') >= 60 then
    return jsonb_build_object('ok', false, 'error', 'busy');
  end if;
  if exists (select 1 from merchant_applications where lower(contact_email) = v_email and status = 'pending') then
    return jsonb_build_object('ok', false, 'error', 'duplicate');
  end if;
  insert into merchant_applications (business_name, category, channel, branches, area, address, website_url, social_url,
                                     contact_name, contact_phone, contact_email, student_offer, message, lang)
  values (trim(p->>'business_name'), p->>'category', coalesce(p->>'channel', 'in_store'), coalesce((p->>'branches')::int, 1),
          nullif(trim(p->>'area'), ''), nullif(trim(p->>'address'), ''), nullif(trim(p->>'website_url'), ''), nullif(trim(p->>'social_url'), ''),
          trim(p->>'contact_name'), trim(p->>'contact_phone'), v_email, nullif(trim(p->>'student_offer'), ''), nullif(trim(p->>'message'), ''),
          case when p->>'lang' = 'ar' then 'ar' else 'en' end);
  return jsonb_build_object('ok', true);
exception
  when unique_violation then return jsonb_build_object('ok', false, 'error', 'duplicate');
  when check_violation or not_null_violation or invalid_text_representation then return jsonb_build_object('ok', false, 'error', 'invalid');
end $$;
