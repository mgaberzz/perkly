/** App features the Perkly team can switch on/off for the student app (app_settings 'features'). */
export const APP_FEATURES = [
  { key: "arcade", label: "Arcade (Spin the Wheel)", hint: "Arcade card, tickets and the wheel. Spins are also blocked on the server." },
  { key: "quests", label: "Quests", hint: "The Quests section in Rewards." },
  { key: "leaderboard", label: "Leaderboard", hint: "This week's leaderboard in Rewards." },
  { key: "badges", label: "Badges", hint: "The Badges section in Rewards." },
  { key: "streaks", label: "Streaks & freezes", hint: "Streak counters and freeze messages." },
  { key: "invite", label: "Invite friends", hint: "Invite card, invite code and the share button." },
  { key: "pay_in_app", label: "Pay in app", hint: "The “Pay in app” option at the cashier. Also blocked on the server; students pay at the till as usual." },
  { key: "shop_online", label: "Shop online & cashback", hint: "Online perks, cashback balance and “Shop online” buttons. One-time codes are also blocked on the server." },
  { key: "flash_perks", label: "Flash perks", hint: "The “Ending soon” shelf and the Flash perks filter." },
  { key: "collections", label: "Collections", hint: "Themed shelves such as Coffee runs and Hero deals." },
  { key: "avatar_builder", label: "Avatar builder", hint: "The cartoon avatar. Profile photos still work." },
  { key: "verification", label: "Student verification", hint: "The verify screens. While off, nobody is asked to verify, even if “Require verification” is on." },
  { key: "language", label: "Language switch", hint: "The English ⇄ العربية switch. While off, everyone uses the language chosen here." },
] as const;
export type FeatureKey = (typeof APP_FEATURES)[number]["key"];
export type FeatureCfg = Partial<Record<FeatureKey, { on?: boolean; campuses?: string[]; default?: "en" | "ar" }>>;
