-- A perk that goes back to "pending" because the merchant changed its discount (or re-sent a rejected one)
-- must open a request in the Notification center. The old trigger only fired when the UPDATE itself set
-- the status column; here the status is changed by the guard trigger, so it never fired.
drop trigger if exists sync_perk_request on public.perks;
create trigger sync_perk_request after insert or update on public.perks
  for each row execute function public.sync_perk_request();
