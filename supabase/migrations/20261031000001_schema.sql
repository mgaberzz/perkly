-- Perkly core schema
-- Roles: student (mobile app), merchant (merchant portal, via merchant_members), admin (admin portal)

create extension if not exists pgcrypto;

-- ───────────────────────────── Reference data ─────────────────────────────
create table public.campuses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  short_name  text,
  city        text not null,
  type        text not null default 'university' check (type in ('university','school','hub')),
  lat         double precision,
  lng         double precision,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ───────────────────────────── Users ─────────────────────────────
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text,
  phone           text,
  email           text,
  avatar_url      text,
  campus_id       uuid references public.campuses(id) on delete set null,
  role            text not null default 'student' check (role in ('student','merchant','admin')),
  status          text not null default 'active' check (status in ('active','banned')),
  referral_code   text unique not null default upper(substr(encode(gen_random_bytes(6),'hex'),1,8)),
  referred_by     uuid references public.profiles(id) on delete set null,
  interests       text[] not null default '{}',
  created_at      timestamptz not null default now()
);

create table public.user_stats (
  user_id                uuid primary key references public.profiles(id) on delete cascade,
  total_xp               integer not null default 0,
  level                  integer not null default 1,
  current_streak         integer not null default 0,
  longest_streak         integer not null default 0,
  last_redemption_date   date,
  last_checkin_date      date,
  freeze_tokens          integer not null default 0,
  total_saved            numeric(12,2) not null default 0,
  total_redemptions      integer not null default 0,
  updated_at             timestamptz not null default now()
);

-- ───────────────────────────── Merchants ─────────────────────────────
create table public.merchants (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  category        text not null,
  subcategory     text,
  brand_type      text not null default 'local' check (brand_type in ('local','chain','national_brand')),
  description     text,
  logo_url        text,
  cover_url       text,
  contact_name    text,
  contact_phone   text,
  contact_email   text,
  status          text not null default 'pending' check (status in ('pending','live','paused','churned')),
  plan            text not null default 'free' check (plan in ('free','pro')),
  commission_pct  numeric(5,2) not null default 5,
  created_at      timestamptz not null default now()
);

create table public.merchant_members (
  merchant_id  uuid not null references public.merchants(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  member_role  text not null default 'owner' check (member_role in ('owner','manager','cashier')),
  created_at   timestamptz not null default now(),
  primary key (merchant_id, user_id)
);

create table public.merchant_branches (
  id           uuid primary key default gen_random_uuid(),
  merchant_id  uuid not null references public.merchants(id) on delete cascade,
  name         text not null,
  address      text,
  city         text,
  campus_id    uuid references public.campuses(id) on delete set null,
  lat          double precision,
  lng          double precision,
  open_hours   jsonb,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- The QR printed / displayed at the cashier table. Students scan it.
create table public.branch_qr_codes (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references public.merchant_branches(id) on delete cascade,
  code        text not null unique default ('PK-' || upper(encode(gen_random_bytes(8),'hex'))),
  label       text not null default 'Cashier',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ───────────────────────────── Perks ─────────────────────────────
create table public.perks (
  id                   uuid primary key default gen_random_uuid(),
  merchant_id          uuid not null references public.merchants(id) on delete cascade,
  branch_id            uuid references public.merchant_branches(id) on delete cascade, -- null = all branches
  title                text not null,
  description          text,
  terms                text,
  discount_type        text not null default 'percentage' check (discount_type in ('percentage','amount','bogo','bundle')),
  discount_value       numeric(10,2) not null default 10 check (discount_value >= 0),
  max_discount_amount  numeric(10,2),
  min_spend            numeric(10,2) not null default 0,
  max_uses_per_user    integer,   -- lifetime per student, null = unlimited
  daily_cap            integer,   -- total redemptions per day across all students
  valid_days           smallint[],-- 0=Sun..6=Sat, null = every day
  start_at             timestamptz,
  end_at               timestamptz,
  is_flash             boolean not null default false,
  priority_score       integer not null default 0,
  status               text not null default 'active' check (status in ('pending','active','paused','expired','rejected')),
  review_note          text,
  created_at           timestamptz not null default now(),
  check (discount_type <> 'percentage' or discount_value <= 100)
);

-- ───────────────────────────── Redemptions ─────────────────────────────
create table public.redemptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.profiles(id) on delete cascade,
  perk_id                uuid not null references public.perks(id) on delete restrict,
  merchant_id            uuid not null references public.merchants(id) on delete restrict,
  branch_id              uuid not null references public.merchant_branches(id) on delete restrict,
  qr_code_id             uuid references public.branch_qr_codes(id) on delete set null,
  original_amount        numeric(10,2),
  discount_amount        numeric(10,2),
  final_amount           numeric(10,2),
  xp_awarded             integer not null default 0,
  status                 text not null default 'success' check (status in ('success','flagged','reversed')),
  flag_reason            text,
  first_time_at_merchant boolean not null default false,
  verification_code      text not null,
  distance_m             integer,
  created_at             timestamptz not null default now()
);
create index redemptions_user_created_idx on public.redemptions (user_id, created_at desc);
create index redemptions_merchant_created_idx on public.redemptions (merchant_id, created_at desc);
create index redemptions_perk_created_idx on public.redemptions (perk_id, created_at desc);

-- ───────────────────────────── Gamification ─────────────────────────────
create table public.xp_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  amount      integer not null,
  reason      text not null check (reason in ('redemption','new_merchant','streak','streak_milestone','quest','referral','daily_open','admin')),
  capped      boolean not null default true, -- counts toward daily XP cap
  context     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index xp_events_user_created_idx on public.xp_events (user_id, created_at desc);
create index xp_events_created_idx on public.xp_events (created_at desc);

create table public.quests (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  emoji       text default '🎯',
  quest_type  text not null check (quest_type in ('daily','weekly','monthly')),
  metric      text not null check (metric in ('redemptions','unique_merchants','new_merchants')),
  target      integer not null check (target > 0),
  xp_reward   integer not null default 15,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.user_quests (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  quest_id      uuid not null references public.quests(id) on delete cascade,
  period_start  date not null,
  progress      integer not null default 0,
  completed_at  timestamptz,
  primary key (user_id, quest_id, period_start)
);

create table public.badges (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  name        text not null,
  description text,
  emoji       text not null default '🏅'
);

create table public.user_badges (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  badge_id    uuid not null references public.badges(id) on delete cascade,
  awarded_at  timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table public.favorites (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  merchant_id  uuid not null references public.merchants(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, merchant_id)
);

create index perks_merchant_idx on public.perks (merchant_id);
create index branches_merchant_idx on public.merchant_branches (merchant_id);
create index qr_branch_idx on public.branch_qr_codes (branch_id);
