# Perkly

Student discount app for Egypt: **find perks → scan the QR on the cashier table → save instantly → earn XP**.

Built from the Perkly Notion workspace (UX spec, QR Redemption PRD, Gamification Strategy, Data Architecture,
Discount Tier System, Merchant Training Kit, Branding handbook).

```
perkly/
├── supabase/              Postgres schema, business logic (RPCs), RLS, seed, SQL tests
├── apps/mobile/           Student app — Expo (React Native), iOS / Android / web
├── apps/web/              Merchant portal (/merchant) + Perkly team portal (/admin) — Next.js 16, English/العربية
└── docs/screenshots/      Screens captured from the builds
```

## How redemption works

1. Every merchant branch has a **cashier QR** (`PK-XXXXXXXXXXXXXXXX`), printed from the merchant portal and placed on the cashier table.
2. The student taps **Scan**, scans it, picks a perk and (optionally) types the bill amount.
3. `redeem_perk()` validates everything **server-side** and records the redemption:
   QR active · merchant live · perk active today · min spend · **max 4/day per merchant** (setting `redemption_rules`) · **15-min cooldown** ·
   per-student limit · daily cap · **location check** (rejects >1 km away, flags >300 m or no location for admin review).
4. The student shows a **green success screen** with a ticking clock, animation and a 4-character code — a screenshot
   looks frozen. The same code appears instantly on the merchant's **Redemptions** page.
5. XP, streaks, quests and badges update in the same transaction.

Lost/photographed QR? Disable it in the portal and print a new one — the old one stops working immediately.

## What's included

**Student app** (flows modelled on the reference walkthrough in the shared PDF, in Perkly's own brand):
- **Onboarding**: intro slides → *Log in or sign up* (🇪🇬 +20 phone OTP, Google, Apple, email) → *Complete your profile*
  (name, email, date of birth, campus, invite code) → consent (terms + optional "perk drops" opt-in) → location permission with the Perky mascot.
- **Home**: location bar with *Change* (Nearby / my campus / recent / popular places), search pill, stats strip
  (saved · streak · spins · XP), category shortcuts, promo banners, *Ending soon*, *Near you*, *Trending at campus*.
- **Category pages**: search in area, *Perks / Flash / Places* tabs, subcategory tabs, collections, trending perk cards
  ("N redeemed", ♡), list view, floating **Filter & Sort** sheet, "Try these filters" chips.
- **Perk detail**: validity, branches sheet with maps, valid days, fine print (see more), *How does Perkly work?*, about, ♡ + *Scan to redeem*.
- **Scan & Save**: first-time 3-step guide (story-style progress), camera + manual code, *How much are you paying?*
  screen with live savings, green live cashier screen + **receipt** (ID, bill, discount, total, help link).
- **Rewards**: level, streak, quests, badges, weekly leaderboard, **Arcade** (Spin the Wheel with tickets, coach-mark tour, prizes).
- **Me**: mascot avatar, Edit profile, savings, recent redemptions, invite code, faves, **Settings** (perk-drop toggle, help, log out).
- Dark mode supported.

**Merchant portal** — dashboard (redemptions, unique/new/returning students, revenue after discount, per day/hour/branch/perk),
live redemptions feed, perks (create/edit/pause, tier badges; >30% needs approval), branches + QR codes + printable QR poster
with cashier cheat sheet, team (owner invites managers/cashiers), business profile, multi-merchant switcher.

**Admin portal** — KPIs + alerts, merchants (create + invite owner, status/plan/commission, branches, QR, access),
perk approval queue, redemptions (flagged review, mark OK / reverse), users (search, ban, roles), campuses, quests.

**Arcade**: 1 welcome ticket, +1 for the first redemption each day, +1 per completed quest (max 20). `spin_wheel()` picks
a weighted segment **on the server** (XP or a streak freeze) — odds are never sent to the app.

**Gamification** (Notion Phase 1 + part of 2): +20 XP first redemption of the day (2× on Fri/Sat), +10 after,
+25 new merchant, streak bonus, milestones (3/5/7/14/30 days), freeze tokens, levels 1–7 (Newbie → Campus Legend),
daily/weekly/monthly quests, badges, referral +50 XP when the friend first redeems, daily open +5 XP, 150 XP/day cap.

## Roles & portals

| Who | Where | Can do |
|---|---|---|
| **Admin** | `/admin` | Everything: users & roles, team assignments, payment settings |
| **Operations** | `/admin` | Create/edit merchants & campaigns, campuses, quests, review transactions, approve cashier QRs |
| **Account manager** | `/admin` | Only the merchants/campuses assigned in *Team & assignments* |
| **Finance** | `/admin` | Read-only merchants & transactions, settlements, payouts, cashback approvals, Excel/CSV exports |
| **Merchant owner / manager** | `/merchant` | Insights (merchant → branch → cashier), new vs recurring %, perks, branches, cashier QRs, payouts, exports |
| **Branch manager** | `/merchant` | Their branch only: insights, transactions, request cashier QR codes (pending until Perkly approves) |
| **Cashier** | `/merchant` | Live transactions |

IDs: every person gets `USR-…`, students also `STU-…`, merchants `MER-…`. Brand types: local · chain · mega account.

**Notification center** (`/admin/notifications`): cashier QR requests, high-tier perk approvals, online cashback — approve/reject in one place.

**Money**: students can *pay in the app* (currently **test mode** — no card is charged; connect a gateway such as Paymob later and switch to live).
Perkly owes the merchant the in-app amount minus commission → Finance creates settlements, transfers, and marks them paid with the bank reference.
Merchants see "to be settled to your bank account" at merchant level and add their IBAN under *Payouts*.

**Online merchants** (channel = online / both): one-time checkout codes (30 min, single use, validated in the merchant portal)
and tracked links (`?perkly_ref=PKR…`) — the shop reports orders, finance approves cashback to the student.

**Student app**: Face ID / fingerprint lock (Settings), Student ID card on *Me*, Arabic with right-to-left layout (Settings → Language, or on the welcome screen).

## Live portal

**https://perkly-five.vercel.app** — merchant portal (`/merchant`) and Perkly team portal (`/admin`), deployed on Vercel from `apps/web`.
Every push to `main` redeploys it automatically.

## Live backend

The Supabase project **Perkly** (`qnvzkjojuumtzpkvjlja`, eu-west-1) has all 8 migrations and the demo seed applied:
10 campuses · 89 demo merchants · 128 branches (each with a cashier QR) · 105 perks · 5 quests · 7 badges.
The earlier prototype tables were moved, untouched, into the `legacy` schema.

- API URL: `https://qnvzkjojuumtzpkvjlja.supabase.co`
- Publishable key: in Supabase → Project Settings → API keys (already filled into the git-ignored `apps/*/.env*` files of the dev box)
- Demo QR codes: `select m.name, q.code from branch_qr_codes q join merchant_branches b on b.id = q.branch_id join merchants m on m.id = b.merchant_id;`

## Setup

### 1. Supabase

Create a project at [supabase.com](https://supabase.com) (or run locally with the Supabase CLI + Docker).

```bash
npm i -g supabase
```

```bash
cd perkly && supabase init   # creates supabase/config.toml; keeps the existing migrations
```

```bash
supabase link --project-ref YOUR_PROJECT_REF && supabase db push
```

Optional **demo data** (89 merchants from the Notion "Targeted Merchants" list, 10 campuses, 128 branches, 105 perks):
run `supabase/seed.sql` in the SQL editor. ⚠️ These merchants are **sales prospects, not partners** — demo only, never production.
Regenerate it with `python3 scripts/gen_seed.py`.

In the Supabase dashboard:
- **Auth → Providers → Phone**: enable and connect an SMS provider (Twilio, MessageBird, Vonage…). Until then students can use **email** codes.
- **Auth → Email templates → Magic link**: include `{{ .Token }}` so the email contains the 6-digit code the app asks for.
- **Auth → Providers → Google / Apple**: enable them and add `perkly://auth-callback` (and your Expo Go URL during development)
  to *Redirect URLs*. On iOS, App Store rules expect Sign in with Apple whenever Google sign-in is offered.
- **Auth → URL configuration**: add your portal URL + `/auth/callback` to redirect URLs.

**Create the first admin**: Auth → Users → *Add user* (email + password), then in the SQL editor:

```sql
update profiles set role = 'admin' where email = 'you@perkly.app';
```

### 2. Web portals (merchant + admin)

```bash
cd apps/web && cp .env.example .env.local && npm install && npm run dev
```

Fill `.env.local` with the project URL, anon key and **service role key** (server-only; used for staff invites).
Open http://localhost:3000 → sign in → admins land on `/admin`, merchant staff on `/merchant`.
Onboard a merchant from **Admin → Merchants → New merchant** with the owner's email: they get an invite to set a password.

### 3. Student app

```bash
cd apps/mobile && cp .env.example .env && npm install && npx expo start
```

Scan the Expo QR with **Expo Go** or a development build. The camera scanner works on devices; on web, use "type the code".

## Tests

```bash
bash supabase/tests/run_tests.sh
```

Spins up a throwaway local Postgres (no Docker), applies all migrations + seed, and checks: signup trigger, referral linking,
QR lookup, discount maths, XP/streak/badges, `too_soon`, `wrong_merchant`, `too_far`, direct-insert blocking, role
escalation blocking, merchant data isolation, high-tier perk approval, admin-only RPCs, referral XP.

## Decisions & things to finish

- **QR direction**: the student scans the merchant's QR (as requested), instead of the dynamic student QR in the PRD.
  Anti-fraud comes from the server rules + location check + live success screen + QR rotation.
- **Brand colors** are placeholders (`#7B2FF7` purple, `#FF3EA5` pink, `#2F80FF` blue, `#16131F` ink) — Notion names
  the colors but has no HEX codes. Change them in `apps/mobile/src/lib/theme.ts` and `apps/web/src/app/globals.css`.
- **Reference PDF**: used for flows and layout only. "Flip the cards" and "Claw machine" show as *coming soon*.
- **In-app payments are in test mode** until a payment gateway is connected (no real charge). Reversing an in-app transaction does not refund it yet.
- **Not built yet**: map view (needs `react-native-maps` + API keys), push notifications, image uploads (logo URLs for now),
  Perkly+ subscription, sponsored placements, TikTok XP verification, offline redemption.
- App icons/splash are Expo defaults — replace in `apps/mobile/assets`.
