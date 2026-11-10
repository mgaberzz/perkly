-- Quest names in Title Case, like the rest of the app's labels
update public.quests set title = case title
  when 'Campus explorer' then 'Campus Explorer' when 'Daily saver' then 'Daily Saver' when 'Monthly legend' then 'Monthly Legend'
  when 'Try somewhere new' then 'Try Somewhere New' when 'Weekly grind' then 'Weekly Grind' else title end
where title in ('Campus explorer', 'Daily saver', 'Monthly legend', 'Try somewhere new', 'Weekly grind');
