-- Payment notifications write the amount like the rest of the app ("You paid 240 EGP"), and the title in Title Case.
do $$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p where p.proname = 'notify_payment' and p.pronamespace = 'public'::regnamespace;
  v_def := replace(v_def, '''You paid EGP '' || to_char(new.final_amount, ''FM999G999D00'') || '' at ''', '''You paid '' || num_text(new.final_amount) || '' EGP at ''');
  v_def := replace(v_def, 'to_char(new.final_amount, ''FM999G999D00'')', 'num_text(new.final_amount)');
  v_def := replace(v_def, '''Payment received ✅''', '''Payment Received ✅''');
  if v_def like '%FM999G999D00%' or v_def not like '%num_text%' then raise exception 'notify_payment was not updated'; end if;
  execute v_def;
end $$;
