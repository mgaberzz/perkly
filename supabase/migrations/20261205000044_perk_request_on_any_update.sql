-- A perk that goes back to "pending" because the merchant changed its discount (or re-sent a rejected one)
-- must open a request in the Notification center. The original trigger only fires when the UPDATE itself
-- sets the status column; here the status is changed by the guard trigger, so it never fired.
-- This second trigger fires whenever the status actually changed (the function is safe to run twice).
drop trigger if exists sync_perk_request_changed on public.perks;
create trigger sync_perk_request_changed after update on public.perks
  for each row when (old.status is distinct from new.status)
  execute function public.sync_perk_request();
