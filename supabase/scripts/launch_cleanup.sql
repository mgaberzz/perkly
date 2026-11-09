-- Launch-day cleanup of demo & test data. DO NOT RUN until launch (the owner keeps demo data until then).
-- Claude runs PART 1 first and shows the counts; PART 2 runs only after the owner says yes.
-- What counts as demo/test (frozen 2026-11-09, before any real merchant existed):
--   • merchants 300001–300090 (89 demo merchants + "Perkly Test Café" 300090) and everything under them
--   • partner 400001 "ZZ Test Partner (delete me)"
--   • logins ops / finance / am / partner .demo@perkly.app
--   • anonymised test accounts 10000006 and 10000007
-- Before running: re-check foreign keys (new tables may have appeared) and take a backup.

-- ───────── PART 1: dry run (read-only) ─────────
with m as (select id from merchants where merchant_code between '300001' and '300090'),
     u as (select id from profiles where email in ('ops.demo@perkly.app','finance.demo@perkly.app','am.demo@perkly.app','partner.demo@perkly.app')
           or user_code in ('10000006','10000007'))
select
  (select count(*) from m)                                                   as merchants,
  (select count(*) from merchant_branches where merchant_id in (select id from m)) as branches,
  (select count(*) from perks where merchant_id in (select id from m))       as perks,
  (select count(*) from branch_qr_codes q join merchant_branches b on b.id = q.branch_id where b.merchant_id in (select id from m)) as qr_codes,
  (select count(*) from redemptions where merchant_id in (select id from m)) as transactions,
  (select count(*) from settlements where merchant_id in (select id from m)) as settlements,
  (select count(*) from partners where partner_code = '400001')              as partners,
  (select count(*) from u)                                                   as accounts,
  (select count(*) from merchants where merchant_code not between '300001' and '300090') as real_merchants_kept;

-- ───────── PART 2: delete (inside a transaction; Claude reviews the result before COMMIT) ─────────
-- begin;
--   (child rows first where foreign keys don't cascade: redemptions, settlements, partner_earnings, online_* …)
--   delete from merchants where merchant_code between '300001' and '300090';
--   delete from partners where partner_code = '400001';
--   delete from auth.users where id in (select id from profiles where email in (...demo logins...) or user_code in ('10000006','10000007'));
-- commit;
