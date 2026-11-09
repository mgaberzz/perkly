-- Safe retries on weak connections: the app sends a one-time request ID with each redemption.
-- If the same request arrives again (the first reply was lost), the original receipt is returned
-- instead of a second redemption or a "too soon" error.
create table if not exists public.redemption_requests (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  result     jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
alter table public.redemption_requests enable row level security; -- no direct access

create or replace function public.redeem_perk_safe(
  p_request_id uuid, p_code text, p_perk_id uuid, p_original_amount numeric default null,
  p_lat double precision default null, p_lng double precision default null, p_payment_method text default 'merchant'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_prev jsonb; v_res jsonb;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if p_request_id is null then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  -- same per-student lock the redemption itself uses, so two copies of one request can't race
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  select result into v_prev from redemption_requests where user_id = v_uid and request_id = p_request_id;
  if found then return v_prev || jsonb_build_object('replayed', true); end if;
  v_res := public.redeem_perk(p_code, p_perk_id, p_original_amount, p_lat, p_lng, p_payment_method);
  if coalesce((v_res->>'ok')::boolean, false) then
    insert into redemption_requests (user_id, request_id, result) values (v_uid, p_request_id, v_res);
  end if;
  return v_res;
end $$;
revoke all on function public.redeem_perk_safe(uuid, text, uuid, numeric, double precision, double precision, text) from public, anon;
grant execute on function public.redeem_perk_safe(uuid, text, uuid, numeric, double precision, double precision, text) to authenticated;
