-- Default quests and badges (Notion: Gamification Strategy, Phase 1)
insert into public.quests (title, description, emoji, quest_type, metric, target, xp_reward) values
  ('Daily saver',        'Redeem 1 perk today',                  '☀️', 'daily',   'redemptions',      1, 15),
  ('Try somewhere new',  'Visit a merchant you''ve never tried',  '🧭', 'daily',   'new_merchants',    1, 25),
  ('Weekly grind',       'Redeem 5 perks this week',             '🔥', 'weekly',  'redemptions',      5, 50),
  ('Campus explorer',    'Visit 3 different merchants this week','🗺️', 'weekly',  'unique_merchants', 3, 75),
  ('Monthly legend',     'Make 10 new merchant visits this month','👑', 'monthly', 'new_merchants',   10, 200);

insert into public.badges (code, name, description, emoji) values
  ('first_perk',  'First Perk Ever',      'Redeemed your very first perk',       '🎉'),
  ('streak_3',    '3-Day Streaker',       'Kept a 3-day streak',                 '🔥'),
  ('streak_7',    'Streak Legend',        'Kept a 7-day streak',                 '⚡'),
  ('streak_30',   'Streak King/Queen',    'Kept a 30-day streak',                '👑'),
  ('explorer_10', '10 Merchants Visited', 'Redeemed at 10 different merchants',  '🧭'),
  ('saver_1000',  'Big Saver',            'Saved 1,000 EGP with Perkly',         '💰'),
  ('elite_saver', 'Elite Saver',          'Reached level 5',                     '💎');
