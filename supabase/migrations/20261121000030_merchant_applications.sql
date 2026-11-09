-- Merchant self-signup: shops apply from the public /apply page; Admin / Operations approve or reject.
-- Applications are written by the portal server (service role) after validation, so there is no insert policy.
create table public.merchant_applications (
  id            uuid primary key default gen_random_uuid(),
  business_name text not null check (length(business_name) between 2 and 120),
  category      text not null,
  channel       text not null default 'in_store' check (channel in ('in_store', 'online', 'both')),
  branches      int  not null default 1 check (branches between 1 and 500),
  area          text check (length(area) <= 120),
  address       text check (length(address) <= 300),
  website_url   text check (length(website_url) <= 300),
  social_url    text check (length(social_url) <= 300),
  contact_name  text not null check (length(contact_name) between 2 and 120),
  contact_phone text not null check (length(contact_phone) between 6 and 30),
  contact_email text not null check (contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(contact_email) <= 200),
  student_offer text check (length(student_offer) <= 500),
  message       text check (length(message) <= 1000),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  merchant_id   uuid references public.merchants(id) on delete set null,
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz,
  review_note   text check (length(review_note) <= 500),
  created_at    timestamptz not null default now()
);
-- One open application per email
create unique index merchant_applications_one_pending on public.merchant_applications (lower(contact_email)) where status = 'pending';
create index merchant_applications_status_idx on public.merchant_applications (status, created_at desc);
create index merchant_applications_merchant_idx on public.merchant_applications (merchant_id);
create index merchant_applications_reviewer_idx on public.merchant_applications (reviewed_by);

alter table public.merchant_applications enable row level security;
create policy "team reads applications" on public.merchant_applications
  for select to authenticated using (public.is_staff(array['admin', 'operations']));
create policy "team reviews applications" on public.merchant_applications
  for update to authenticated using (public.is_staff(array['admin', 'operations']))
  with check (public.is_staff(array['admin', 'operations']));
revoke all on public.merchant_applications from anon, authenticated;
grant select, update on public.merchant_applications to authenticated;

-- The public form calls this (signed out). It validates, applies a flood guard and blocks duplicate open applications.
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
                                     contact_name, contact_phone, contact_email, student_offer, message)
  values (trim(p->>'business_name'), p->>'category', coalesce(p->>'channel', 'in_store'), coalesce((p->>'branches')::int, 1),
          nullif(trim(p->>'area'), ''), nullif(trim(p->>'address'), ''), nullif(trim(p->>'website_url'), ''), nullif(trim(p->>'social_url'), ''),
          trim(p->>'contact_name'), trim(p->>'contact_phone'), v_email, nullif(trim(p->>'student_offer'), ''), nullif(trim(p->>'message'), ''));
  return jsonb_build_object('ok', true);
exception
  when unique_violation then return jsonb_build_object('ok', false, 'error', 'duplicate');
  when check_violation or not_null_violation or invalid_text_representation then return jsonb_build_object('ok', false, 'error', 'invalid');
end $$;
revoke all on function public.submit_merchant_application(jsonb) from public;
grant execute on function public.submit_merchant_application(jsonb) to anon, authenticated;
