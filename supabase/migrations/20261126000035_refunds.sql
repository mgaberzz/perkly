-- Refunds. A student asks for a refund on a transaction → the merchant (owner / manager / that branch's manager)
-- approves or rejects it → on approval the transaction is reversed (XP and savings taken back, no commission).
--   • paid at the cashier: the shop gives the money back itself
--   • paid in the app:     Perkly returns the money; Finance marks the refund as paid with a reference
-- Admin / Operations can decide when a merchant doesn't. One request per transaction.
-- Refund ID: 8 digits starting with 7.

create sequence if not exists public.refund_code_seq minvalue 70000001 maxvalue 79999999 start with 70000001;

create table public.refund_requests (
  id            uuid primary key default gen_random_uuid(),
  refund_code   text not null unique default nextval('public.refund_code_seq')::text check (refund_code ~ '^7[0-9]{7}$'),
  redemption_id uuid not null unique references public.redemptions(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  merchant_id   uuid not null references public.merchants(id) on delete cascade,
  branch_id     uuid references public.merchant_branches(id) on delete set null,
  amount        numeric(12,2) not null,           -- what the student paid
  paid_in_app   boolean not null,
  reason        text not null check (reason in ('wrong_amount', 'order_cancelled', 'returned', 'charged_twice', 'no_discount', 'other')),
  note          text check (length(note) <= 500),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by    uuid references public.profiles(id) on delete set null,
  decided_as    text check (decided_as in ('merchant', 'perkly')),
  decided_at    timestamptz,
  decision_note text check (length(decision_note) <= 500),
  -- money back: na (not approved) · by_merchant (shop returns it) · due (Perkly must return it) · paid
  payout_status text not null default 'na' check (payout_status in ('na', 'by_merchant', 'due', 'paid')),
  payout_ref    text check (length(payout_ref) <= 80),
  paid_by       uuid references public.profiles(id) on delete set null,
  paid_at       timestamptz,
  was_settled   boolean not null default false,   -- already paid out to the merchant → Finance recovers it
  created_at    timestamptz not null default now()
);
create index refund_requests_merchant_idx on public.refund_requests (merchant_id, status, created_at desc);
create index refund_requests_user_idx on public.refund_requests (user_id, created_at desc);
create index refund_requests_branch_idx on public.refund_requests (branch_id);
create index refund_requests_decided_by_idx on public.refund_requests (decided_by);
create index refund_requests_paid_by_idx on public.refund_requests (paid_by);
create index refund_requests_payout_idx on public.refund_requests (payout_status) where payout_status = 'due';

alter table public.refund_requests enable row level security;
create policy refund_requests_read on public.refund_requests for select to authenticated using (
  user_id = (select auth.uid())
  or public.can_see_merchant(merchant_id)
  or public.is_merchant_member(merchant_id, array['owner', 'manager'])
  or (branch_id is not null and public.is_branch_manager(branch_id))
);
revoke all on public.refund_requests from anon, authenticated;
grant select on public.refund_requests to authenticated;

insert into public.app_settings (key, value) values ('refunds', '{"window_days": 7}') on conflict (key) do nothing;

create or replace function public.id_kind(p_code text) returns text
language sql immutable set search_path = public as $$
  select case
    when p_code ~ '^1[0-9]{7}$' then 'user'
    when p_code ~ '^2[0-9]{7}$' then 'student'
    when p_code ~ '^3[0-9]{5}$' then 'merchant'
    when p_code ~ '^4[0-9]{5}$' then 'partner'
    when p_code ~ '^5[0-9]{7}$' then 'settlement'
    when p_code ~ '^6[0-9]{9}$' then 'order'
    when p_code ~ '^7[0-9]{7}$' then 'refund'
    when p_code ~ '^9[0-9]{9}$' then 'transaction'
  end
$$;

-- Notifications get a 'refund' kind
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('verification', 'payment', 'broadcast', 'reminder', 'refund'));

-- ───────── Student: ask for a refund ─────────
create or replace function public.request_refund(p_redemption_id uuid, p_reason text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v redemptions; v_days int; v_note text := nullif(trim(coalesce(p_note, '')), ''); v_id uuid; v_code text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if not feature_enabled('refunds') then return jsonb_build_object('ok', false, 'error', 'refunds_off'); end if;
  select * into v from redemptions where id = p_redemption_id and user_id = auth.uid();
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if p_reason not in ('wrong_amount', 'order_cancelled', 'returned', 'charged_twice', 'no_discount', 'other') then
    return jsonb_build_object('ok', false, 'error', 'bad_reason');
  end if;
  if p_reason = 'other' and v_note is null then return jsonb_build_object('ok', false, 'error', 'note_required'); end if;
  if length(coalesce(v_note, '')) > 500 then return jsonb_build_object('ok', false, 'error', 'note_too_long'); end if;
  if v.status = 'reversed' then return jsonb_build_object('ok', false, 'error', 'already_reversed'); end if;
  if v.final_amount is null or v.final_amount <= 0 then return jsonb_build_object('ok', false, 'error', 'no_amount'); end if;
  v_days := coalesce((select (value->>'window_days')::int from app_settings where key = 'refunds'), 7);
  if v.created_at < now() - make_interval(days => v_days) then
    return jsonb_build_object('ok', false, 'error', 'too_late', 'days', v_days);
  end if;
  if exists (select 1 from refund_requests where redemption_id = v.id) then
    return jsonb_build_object('ok', false, 'error', 'already_requested');
  end if;
  insert into refund_requests (redemption_id, user_id, merchant_id, branch_id, amount, paid_in_app, reason, note)
  values (v.id, v.user_id, v.merchant_id, v.branch_id, v.final_amount, v.payment_method = 'in_app' and v.payment_status = 'paid', p_reason, v_note)
  returning id, refund_code into v_id, v_code;
  return jsonb_build_object('ok', true, 'id', v_id, 'refund_code', v_code);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'already_requested');
end $$;
revoke all on function public.request_refund(uuid, text, text) from public, anon;
grant execute on function public.request_refund(uuid, text, text) to authenticated;

-- ───────── Merchant (or Perkly Admin / Operations): approve or reject ─────────
create or replace function public.decide_refund(p_id uuid, p_approve boolean, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q refund_requests; v redemptions; v_as text; v_note text := nullif(trim(coalesce(p_note, '')), '');
        v_ar boolean; v_name text; v_xp int;
begin
  select * into q from refund_requests where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if is_merchant_member(q.merchant_id, array['owner', 'manager']) or (q.branch_id is not null and is_branch_manager(q.branch_id)) then v_as := 'merchant';
  elsif is_staff(array['admin', 'operations']) then v_as := 'perkly';
  else return jsonb_build_object('ok', false, 'error', 'not_allowed'); end if;
  if q.status <> 'pending' then return jsonb_build_object('ok', false, 'error', 'already_decided'); end if;
  if not p_approve and v_note is null then return jsonb_build_object('ok', false, 'error', 'note_required'); end if;
  if length(coalesce(v_note, '')) > 500 then return jsonb_build_object('ok', false, 'error', 'note_too_long'); end if;

  select * into v from redemptions where id = q.redemption_id for update;
  v_ar := (select lang = 'ar' from profiles where id = q.user_id);
  v_name := (select name from merchants where id = q.merchant_id);

  if not p_approve then
    update refund_requests set status = 'rejected', decided_by = auth.uid(), decided_as = v_as, decided_at = now(), decision_note = v_note where id = p_id;
    insert into notifications (user_id, kind, title, body, data) values (q.user_id, 'refund',
      case when v_ar then 'طلب الاسترجاع اترفض' else 'Refund Not Approved' end,
      case when v_ar then v_name || ' رفض طلب الاسترجاع: ' || v_note else v_name || ' didn''t approve your refund: ' || v_note end,
      jsonb_build_object('url', '/refund?id=' || q.redemption_id));
    return jsonb_build_object('ok', true, 'status', 'rejected');
  end if;

  update refund_requests set status = 'approved', decided_by = auth.uid(), decided_as = v_as, decided_at = now(), decision_note = v_note,
         payout_status = case when q.paid_in_app then 'due' else 'by_merchant' end,
         was_settled = v.settlement_id is not null
   where p_id = id;
  -- Reverse the transaction and take back what it earned
  if v.status <> 'reversed' then
    update redemptions set status = 'reversed', flag_reason = 'Refund ' || q.refund_code where id = v.id;
    v_xp := coalesce(v.xp_awarded, 0);
    update user_stats set total_xp = greatest(0, total_xp - v_xp), level = level_for_xp(greatest(0, total_xp - v_xp)),
           total_saved = greatest(0, total_saved - coalesce(v.discount_amount, 0)),
           total_redemptions = greatest(0, total_redemptions - 1), updated_at = now()
     where user_id = q.user_id;
    if v_xp > 0 then
      insert into xp_events (user_id, amount, reason, capped, context)
      values (q.user_id, -v_xp, 'admin', false, jsonb_build_object('refund', q.refund_code, 'redemption_id', v.id));
    end if;
  end if;
  insert into notifications (user_id, kind, title, body, data) values (q.user_id, 'refund',
    case when v_ar then 'تمت الموافقة على الاسترجاع ✅' else 'Refund Approved ✅' end,
    case when q.paid_in_app
      then case when v_ar then 'هيرجعلك ' || to_char(q.amount, 'FM999G999D00') || ' ج.م من Perkly خلال أيام قليلة.'
                else 'EGP ' || to_char(q.amount, 'FM999G999D00') || ' is on its way back to you from Perkly within a few days.' end
      else case when v_ar then v_name || ' وافق. استلم ' || to_char(q.amount, 'FM999G999D00') || ' ج.م من الكاشير.'
                else v_name || ' approved it. Collect EGP ' || to_char(q.amount, 'FM999G999D00') || ' at the cashier.' end end,
    jsonb_build_object('url', '/refund?id=' || q.redemption_id));
  return jsonb_build_object('ok', true, 'status', 'approved', 'payout_status', case when q.paid_in_app then 'due' else 'by_merchant' end);
end $$;
revoke all on function public.decide_refund(uuid, boolean, text) from public, anon;
grant execute on function public.decide_refund(uuid, boolean, text) to authenticated;

-- ───────── Finance: Perkly returned the money for an in-app payment ─────────
create or replace function public.mark_refund_paid(p_id uuid, p_reference text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q refund_requests; v_ref text := nullif(trim(coalesce(p_reference, '')), ''); v_ar boolean;
begin
  if not is_staff(array['admin', 'finance']) then return jsonb_build_object('ok', false, 'error', 'not_allowed'); end if;
  if v_ref is null or length(v_ref) > 80 then return jsonb_build_object('ok', false, 'error', 'reference_required'); end if;
  select * into q from refund_requests where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if q.payout_status <> 'due' then return jsonb_build_object('ok', false, 'error', 'not_due'); end if;
  update refund_requests set payout_status = 'paid', payout_ref = v_ref, paid_by = auth.uid(), paid_at = now() where id = p_id;
  update redemptions set payment_status = 'refunded' where id = q.redemption_id;
  v_ar := (select lang = 'ar' from profiles where id = q.user_id);
  insert into notifications (user_id, kind, title, body, data) values (q.user_id, 'refund',
    case when v_ar then 'فلوسك رجعت 💸' else 'Refund Sent 💸' end,
    case when v_ar then 'رجّعنالك ' || to_char(q.amount, 'FM999G999D00') || ' ج.م. رقم الاسترجاع ' || q.refund_code
         else 'We sent back EGP ' || to_char(q.amount, 'FM999G999D00') || '. Refund ID ' || q.refund_code end,
    jsonb_build_object('url', '/refund?id=' || q.redemption_id));
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.mark_refund_paid(uuid, text) from public, anon;
grant execute on function public.mark_refund_paid(uuid, text) to authenticated;

-- New feature switch (on by default)
update public.app_settings set value = value || '{"refunds": {"on": true, "campuses": []}}'::jsonb
 where key = 'features' and not value ? 'refunds';
