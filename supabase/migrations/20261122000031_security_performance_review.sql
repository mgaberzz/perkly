-- Pre-launch review of the Supabase security & performance advisors.

-- ───────── Security ─────────
-- Pin search_path on helper functions (protects against search_path hijacking)
alter function public.age_bucket(date) set search_path = public;
alter function public.id_kind(text) set search_path = public;
alter function public.insights_key(text, text, text, uuid, uuid, date, uuid) set search_path = public;
alter function public.partner_cut_for(text, numeric, numeric) set search_path = public;
alter function public.settlement_status_label(text) set search_path = public;

-- Trigger functions are never meant to be called through the API
revoke execute on function public.notifications_push() from public, anon, authenticated;
revoke execute on function public.notify_payment() from public, anon, authenticated;
revoke execute on function public.notify_verification_result() from public, anon, authenticated;

-- Internal helpers: signed-out visitors don't need them (signed-in callers keep access; triggers and RPCs use them)
revoke execute on function public.max_redemptions_per_merchant_per_day() from public, anon;
revoke execute on function public.vat_for(uuid, numeric) from public, anon;
revoke execute on function public.vat_pct() from public, anon;
grant execute on function public.max_redemptions_per_merchant_per_day() to authenticated;
grant execute on function public.vat_for(uuid, numeric) to authenticated;
grant execute on function public.vat_pct() to authenticated;

-- ───────── Performance: index every foreign key (faster joins and deletes) ─────────
create index if not exists admin_requests_created_by_idx on public.admin_requests (created_by);
create index if not exists admin_requests_resolved_by_idx on public.admin_requests (resolved_by);
create index if not exists branch_qr_codes_requested_by_idx on public.branch_qr_codes (requested_by);
create index if not exists branch_qr_codes_reviewed_by_idx on public.branch_qr_codes (reviewed_by);
create index if not exists broadcasts_campus_idx on public.broadcasts (campus_id);
create index if not exists broadcasts_perk_idx on public.broadcasts (perk_id);
create index if not exists broadcasts_sent_by_idx on public.broadcasts (sent_by);
create index if not exists link_clicks_merchant_idx on public.link_clicks (merchant_id);
create index if not exists link_clicks_perk_idx on public.link_clicks (perk_id);
create index if not exists merchant_members_branch_idx on public.merchant_members (branch_id);
create index if not exists notifications_broadcast_idx on public.notifications (broadcast_id);
create index if not exists online_codes_merchant_idx on public.online_codes (merchant_id);
create index if not exists online_codes_perk_idx on public.online_codes (perk_id);
create index if not exists online_codes_redemption_idx on public.online_codes (redemption_id);
create index if not exists online_orders_click_idx on public.online_orders (click_id);
create index if not exists online_orders_reported_by_idx on public.online_orders (reported_by);
create index if not exists partner_earnings_merchant_idx on public.partner_earnings (merchant_id);
create index if not exists partner_payouts_paid_by_idx on public.partner_payouts (paid_by);
create index if not exists partners_created_by_idx on public.partners (created_by);
create index if not exists redemptions_online_code_idx on public.redemptions (online_code_id);
create index if not exists settlement_payments_paid_by_idx on public.settlement_payments (paid_by);
create index if not exists settlements_created_by_idx on public.settlements (created_by);
create index if not exists settlements_paid_by_idx on public.settlements (paid_by);
create index if not exists student_verifications_campus_idx on public.student_verifications (campus_id);
create index if not exists student_verifications_reviewed_by_idx on public.student_verifications (reviewed_by);
