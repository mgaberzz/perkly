# Perkly pre-launch checklist

Everything parked "for launch". Go through it top to bottom before real students and merchants start using Perkly.
Ask Claude: **"launch checklist"** to walk through it.

## Accounts & stores
- [ ] Apple Developer account → iPhone build on TestFlight → App Store review
  - Enrolled as **Individual** (company not registered yet). After registering the company: get a D-U-N-S number, then ask Apple Support to change the membership to **Organization** so the store shows "Perkly" as the seller.
- [ ] Google Play Console → internal testing → production release
- [ ] Android push notifications tested on a real phone (Settings → "Notifications on this phone" shows **On ✓**)

## Domain & contact details
- [ ] Own domain (e.g. `perkly.app`) on Vercel — do it **before** the team registers Face ID / passkeys on the portal
- [ ] Set `EXPO_PUBLIC_WEB_URL` in `apps/mobile/eas.json` to the new domain (legal links in the app)
- [ ] Real support email + registered company name in `apps/web/src/lib/legal.ts` (replace `support@perkly.app` / "Perkly")
- [ ] WhatsApp support number for the app's "Support chat" button (`apps/mobile/src/app/settings.tsx`)
- [ ] Lawyer in Egypt reviews the Privacy Policy and Terms of Use

## Providers
- [ ] SMS provider for students' login codes (Supabase Auth → Phone)
- [ ] Email provider: Resend is connected but in **test mode** (only emails m.gaberz@hotmail.com). Verify the domain at resend.com/domains, then change the sender in Supabase → Auth → SMTP to e.g. `no-reply@<domain>`. Until then students can't get email login codes and portal invites don't arrive. This also enables university-email verification.
- [ ] Paymob merchant account → switch in-app payments from **test** to **live** (Settings)

## Analytics & CRM
- [ ] **PostHog** (analytics, free up to 1M events/month, EU servers): create the account, save the project key in Expo/Vercel (not in chat). Claude then adds:
  - app events (app opened, sign-up completed, perk viewed, QR scanned, redeemed, spin played, notification opened); sign-ups and redemptions also sent from the database
  - analytics on the consent screen + a line in the Privacy Policy (no names, phones or emails sent; only an anonymous ID, campus, level, language)
  - starter dashboard: sign-up funnel, weekly retention by campus, redemptions per notification
- [ ] **HubSpot free** (CRM for the merchant pipeline): create the account, save the private app token in Supabase (not in chat). Claude then sends merchant applications in as leads and keeps status (live, monthly transactions) up to date
- [ ] Lawyer review covers the analytics consent (Egypt data protection law 151/2020)

## Monitoring
- [ ] **Sentry source maps**: create a Sentry auth token (secret) and add it to
  - Vercel: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT=perkly-portal`
  - Expo: `npx eas-cli env:create --name SENTRY_AUTH_TOKEN --visibility secret …` (+ org/project), then remove `SENTRY_DISABLE_AUTO_UPLOAD` from `apps/mobile/eas.json`
  - Result: error reports show the exact file and line instead of compiled code
- [ ] Resolve the Sentry test issue(s) so only real errors remain

## Database & data
- [x] Supabase security & performance advisors reviewed and fixed (Nov 2026, migration 031). Re-run before launch.
- [ ] Supabase → Authentication → **Leaked password protection** ON (Pro plan)
- [ ] Supabase plan **Pro** with daily backups; consider the PITR add-on once real money flows
- [ ] Remove test & demo data with `supabase/scripts/launch_cleanup.sql` (dry run first; ready, not run):
  - 89 demo merchants and their perks/branches
  - "ZZ Test Partner (delete me)" (400001) and the test café link
  - Demo logins: ops / finance / am / partner `.demo@perkly.app`
  - Anonymised test accounts 10000006 and 10000007
  - "Perkly Test Café" (no location check — must not stay live)

## Switches on launch day
- [ ] Settings → **Require verification to redeem** ON (decide free redemptions before verifying)
- [ ] Settings → payments mode **live** (after Paymob)
- [ ] First real push notification sent from Push notifications
