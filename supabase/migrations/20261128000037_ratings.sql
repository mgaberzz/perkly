-- Rate your visit: after redeeming, a student gives the shop 1–5 stars and an optional comment.
--   • one rating per transaction, within 14 days, can be changed
--   • merchants see their average and the comments WITHOUT the student's identity (merchant_reviews)
--   • the average and count live on the merchant row so the app and portal can show them cheaply

alter table public.merchants add column if not exists rating_avg numeric(3,2), add column if not exists rating_count integer not null default 0;

create table public.ratings (
  redemption_id uuid primary key references public.redemptions(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  merchant_id   uuid not null references public.merchants(id) on delete cascade,
  branch_id     uuid references public.merchant_branches(id) on delete set null,
  stars         smallint not null check (stars between 1 and 5),
  comment       text check (length(comment) <= 300),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index ratings_merchant_idx on public.ratings (merchant_id, created_at desc);
create index ratings_user_idx on public.ratings (user_id);
create index ratings_branch_idx on public.ratings (branch_id);
alter table public.ratings enable row level security;
-- students see their own; the Perkly team sees all (merchants go through merchant_reviews, which hides who wrote it)
create policy ratings_read on public.ratings for select to authenticated using (
  user_id = (select auth.uid()) or public.is_staff(array['admin', 'operations', 'account_manager'])
);
revoke all on public.ratings from anon, authenticated;
grant select on public.ratings to authenticated;

-- Merchants (and anyone else through the API) can't edit the rating numbers
create or replace function public.guard_merchant_update() returns trigger
language plpgsql set search_path = public as $$
declare v_system boolean := current_user in ('postgres', 'service_role', 'supabase_admin');
begin
  new.merchant_code := old.merchant_code;
  if not v_system then
    new.rating_avg := old.rating_avg;
    new.rating_count := old.rating_count;
  end if;
  if not v_system and not public.is_staff(array['admin','operations']) then
    new.plan := old.plan;
    new.commission_pct := old.commission_pct;
    new.vat_enabled := old.vat_enabled;
    new.partner_id := old.partner_id;
    if not public.can_manage_merchant(old.id) then
      new.status := old.status;
      new.brand_type := old.brand_type;
    end if;
  end if;
  return new;
end $$;

create or replace function public.refresh_merchant_rating() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_m uuid := coalesce(new.merchant_id, old.merchant_id);
begin
  update merchants m set rating_count = x.n, rating_avg = x.avg
    from (select count(*)::int as n, round(avg(stars), 2) as avg from ratings where merchant_id = v_m) x
   where m.id = v_m;
  return null;
end $$;
create trigger refresh_merchant_rating after insert or update of stars or delete on public.ratings
  for each row execute function public.refresh_merchant_rating();
revoke execute on function public.refresh_merchant_rating() from public, anon, authenticated;

create or replace function public.rate_visit(p_redemption_id uuid, p_stars int, p_comment text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v redemptions; v_comment text := nullif(trim(coalesce(p_comment, '')), '');
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if not feature_enabled('ratings') then return jsonb_build_object('ok', false, 'error', 'ratings_off'); end if;
  if p_stars is null or p_stars not between 1 and 5 then return jsonb_build_object('ok', false, 'error', 'bad_stars'); end if;
  if length(coalesce(v_comment, '')) > 300 then return jsonb_build_object('ok', false, 'error', 'comment_too_long'); end if;
  select * into v from redemptions where id = p_redemption_id and user_id = auth.uid();
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v.status = 'reversed' then return jsonb_build_object('ok', false, 'error', 'reversed'); end if;
  if v.created_at < now() - interval '14 days' then return jsonb_build_object('ok', false, 'error', 'too_late'); end if;
  insert into ratings (redemption_id, user_id, merchant_id, branch_id, stars, comment)
  values (v.id, v.user_id, v.merchant_id, v.branch_id, p_stars, v_comment)
  on conflict (redemption_id) do update set stars = excluded.stars, comment = coalesce(excluded.comment, ratings.comment), updated_at = now();
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.rate_visit(uuid, int, text) from public, anon;
grant execute on function public.rate_visit(uuid, int, text) to authenticated;

-- What the merchant sees: stars, comment, when, where and which perk. Never who.
create or replace function public.merchant_reviews(p_merchant_id uuid, p_limit int default 100)
returns table (stars smallint, comment text, created_at timestamptz, branch_id uuid, branch_name text, perk_title text)
language sql stable security definer set search_path = public as $$
  select g.stars, g.comment, g.created_at, g.branch_id, b.name, p.title
    from ratings g
    join redemptions r on r.id = g.redemption_id
    left join merchant_branches b on b.id = g.branch_id
    left join perks p on p.id = r.perk_id
   where g.merchant_id = p_merchant_id
     and (public.is_merchant_member(p_merchant_id, array['owner', 'manager']) or public.can_see_merchant(p_merchant_id)
          or (g.branch_id is not null and public.is_branch_manager(g.branch_id)))
   order by g.created_at desc
   limit least(greatest(coalesce(p_limit, 100), 1), 500)
$$;
revoke all on function public.merchant_reviews(uuid, int) from public, anon;
grant execute on function public.merchant_reviews(uuid, int) to authenticated;

update public.app_settings set value = value || '{"ratings": {"on": true, "campuses": []}}'::jsonb
 where key = 'features' and not value ? 'ratings';
