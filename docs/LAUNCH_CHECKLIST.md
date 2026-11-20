# Perkly pre-launch checklist

Everything parked "for launch". Go through it top to bottom before real students and merchants start using Perkly.
Ask Claude: **"launch checklist"** to walk through it.

## Accounts & stores
- [x] Apple Developer account → iPhone build on TestFlight (17 Nov 2026: installed on an iPhone, push notifications and in-app payment tested)
- [ ] TestFlight external beta (Perkly pilot group): build 1 rejected (no sign-in info). Build 2 waiting for Beta App Review since 18 Nov 2026
  - 20 Nov: Test Information filled in: sign-in required (student.demo@perkly.app), review notes, privacy URL, marketing URL
  - If still waiting after ~5 days in total, contact Apple (App Store Connect → Contact Us)
  - Switch the Feedback Email to support@perklyapp.co once that mailbox works
- [ ] App Store review (not started; the listing needs screenshots and a description first)
  - Waiting for Apple's reply to the identity check (ID sent)
  - Enrolled as **Individual** (company not registered yet). After registering the company: get a D-U-N-S number, then ask Apple Support to change the membership to **Organization** so the store shows "Perkly" as the seller.
- [x] Google Play Console developer account approved (18 Nov 2026)
- [ ] Google Play store setup (package name `app.perkly.student`):
  - Category: **Shopping** (tags: coupons, deals, discounts)
  - Privacy policy: https://perklyapp.co/privacy · Terms: https://perklyapp.co/terms · Account deletion: https://perklyapp.co/delete-account
  - App access: demo login for reviewers (student.demo@perkly.app)
  - Data safety, content rating, target audience 16+, financial features (in-app payments)
  - Advertising ID: **No** (the AD_ID permission is blocked in app.json)
  - Trader status: Yes. Your developer-account contact details are shown to EU/UK users: switch to business details once the company is registered
- [ ] First Android release uploaded **by hand** to Closed testing (the `.aab` from the EAS production build)
- [x] Production AAB (version code 3, 1.0.0) uploaded to Closed testing (20 Nov 2026)
- Tester guide, invite message and Test Café QR: docs/testing/ANDROID_CLOSED_TEST.md
- [ ] Closed test: at least 12 testers opted in for 14 days in a row (check the exact rule on the Play Console dashboard), then apply for production access
- [ ] Automatic Play uploads: create a Google service account with Play access and save its JSON key in Expo (`npx eas-cli credentials`, never in the repo). `eas.json` already uploads to the closed-testing track
- [x] New Android build installed and checked on a real phone (14 Nov 2026): camera scan, fingerprint login, student ID photo upload and approval, receipt
- [ ] In-app payment tried on a real phone (test mode)
- [x] Android push notifications tested on a real phone (14 Nov 2026: test message arrived on the preview build)

## Domain & contact details
- [x] Domains bought: `perklyapp.co` and `perklyeg.com` (Namecheap)
- [ ] Connect `perklyapp.co` (primary) and `perklyeg.com` (redirects to it) in Vercel → Settings → Domains, and add Vercel's DNS records in Namecheap — do it **before** the team registers Face ID / passkeys on the portal
- [ ] Set `NEXT_PUBLIC_SITE_URL` to `https://perklyapp.co` in Vercel's environment variables and redeploy (invite and password-reset links use it)
- [ ] Supabase → Auth → URL Configuration: set Site URL to `https://perklyapp.co` and add `https://perklyapp.co/**` to the redirect URLs
- [x] `EXPO_PUBLIC_WEB_URL` in `apps/mobile/eas.json` set to `https://perklyapp.co` (legal links in the app) — new app builds need the domain live first
- [ ] Create the `support@perklyapp.co` mailbox (already shown on the legal pages) and put the registered company name in `apps/web/src/lib/legal.ts` (replace "Perkly")
- [ ] Verify `perklyapp.co` in Resend (email)
- [ ] WhatsApp support number for the app's "Support chat" button (`apps/mobile/src/app/settings.tsx`)
  - Today the button opens an empty WhatsApp link, so it does nothing useful until the number is set
- [ ] Lawyer in Egypt reviews the Privacy Policy and Terms of Use

## Providers
- [ ] SMS provider for students' login codes (Supabase Auth → Phone)
  - Also needed for the merchant portal's mobile number verification (Settings → Mobile number); until then it shows "SMS codes aren't switched on yet"
- [ ] Applicant confirmation email: create a Resend API key (Sending access) and save it in Vercel as `RESEND_API_KEY` (Production), then redeploy. Until then applicants get no confirmation email.
- [ ] Email provider: Resend is connected but in **test mode** (only emails m.gaberz@hotmail.com). Verify the domain at resend.com/domains, then change the sender in Supabase → Auth → SMTP to e.g. `no-reply@<domain>`. Until then students can't get email login codes and portal invites don't arrive. This also enables university-email verification.
  - After email works: email each merchant their weekly summary every Sunday (today it's the "Your week with Perkly" card on their dashboard)
  - After email works: email merchants a refund reminder after 3 days (today they only see a banner in the portal)
- [ ] Paymob merchant account → switch in-app payments from **test** to **live** (Settings)
  - After Paymob: make approved in-app refunds go back to the student's card automatically (today Finance returns the money by hand and marks the refund paid)

## Analytics & CRM
- [ ] **PostHog** (analytics, free up to 1M events/month, EU servers): create the account, save the project key in Expo/Vercel (not in chat). Claude then adds:
  - app events (app opened, sign-up completed, perk viewed, QR scanned, redeemed, spin played, notification opened); sign-ups and redemptions also sent from the database
  - analytics on the consent screen + a line in the Privacy Policy (no names, phones or emails sent; only an anonymous ID, campus, level, language)
  - starter dashboard: sign-up funnel, weekly retention by campus, redemptions per notification
- [ ] **HubSpot free** (CRM for the merchant pipeline): create the account, save the private app token in Supabase (not in chat). Claude then sends merchant applications in as leads and keeps status (live, monthly transactions) up to date
- [ ] Lawyer review covers the analytics consent (Egypt data protection law 151/2020)

## Later (after launch)
- [ ] Apple Watch app (optional): show XP, quests, the spin wheel and the latest receipt. Today the watch only mirrors iPhone notifications. Decide after launch whether it's worth a separate build.
  - Passed 17 Nov 2026: with the iPhone locked and Perkly closed, notifications show on the Apple Watch (mirroring on). Nothing else appears there.
  - Note: with the app open on the phone, the watch doesn't show the notification.

## Email deliverability
- [ ] Temporary email forwarding with ImprovMX (support@, dmarc@ → personal inbox) until Google Workspace is ready. Namecheap Mail Settings stays on **Custom MX** (never switch to Namecheap "Email Forwarding": it removes Resend's `send` MX)
- [ ] When moving to Google Workspace: replace the two ImprovMX MX records on `@` with Google's `smtp.google.com` (priority 1), and in the SPF TXT record on `@` change `include:spf.improvmx.com` to `include:_spf.google.com` (same record, don't add a second). Leave the TXT on host `send` (Resend) untouched
- [x] Sending domain perklyapp.co verified in Resend (SPF/DKIM); Supabase sends from no-reply@perklyapp.co
- [x] DMARC record added (`_dmarc`, `p=none`, 18 Nov 2026). After a few weeks of clean reports, consider `p=quarantine`
- [x] Emails go out in the person's app language only (invite, password reset, merchant application confirmation)
- [ ] Hotmail/Outlook hid test emails from the new domain (delivered but not in the inbox): check again after a week of sending

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
  - Demo logins: **admin** (full control, delete first) / ops / finance / am / partner / merchant / student `.demo@perkly.app` (merchant.demo is an owner of the Test Café; student.demo is for testing the app)
  - Anonymised test accounts 10000006 and 10000007
  - "Perkly Test Café" (no location check — must not stay live)
- [ ] Empty the test-merchant list (`app_settings.test_merchants`): Perkly Test Café is exempt from the 15-minute and per-day redemption rules for testing

## Switches on launch day
- [ ] Settings → **Require verification to redeem** ON (decide free redemptions before verifying)
- [ ] Settings → payments mode **live** (after Paymob)
- [ ] First real push notification sent from Push notifications
