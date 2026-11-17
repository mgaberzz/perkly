-- Security: signed-out visitors can no longer call merchant_week_redemptions (it returned a
-- redemption count for any shop ID). Signed-in students and merchant staff still can.
revoke execute on function public.merchant_week_redemptions(uuid) from public, anon;
