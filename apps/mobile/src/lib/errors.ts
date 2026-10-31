// Friendly copy for redemption errors (Notion: UX spec §6 + QR PRD §9)
const MESSAGES: Record<string, string> = {
  invalid_qr: "Hmm, that's not a Perkly code. Try scanning the QR on the cashier table 🔄",
  merchant_inactive: "This place isn't taking Perkly right now. Check back soon 💜",
  wrong_merchant: "That perk isn't available at this branch.",
  perk_unavailable: "This perk isn't running right now (check the days and times).",
  amount_required: 'Enter your bill amount to use this perk.',
  below_min_spend: "Your bill is below this perk's minimum spend.",
  invalid_amount: 'Enter a valid bill amount.',
  too_soon: 'You just used Perkly here! Try again in 15 minutes ⏳',
  daily_merchant_limit: "You've hit today's limit here (2 per day). See you tomorrow 💜",
  perk_limit_reached: "You've already used this perk the max number of times.",
  perk_sold_out_today: 'This perk is sold out for today 😭 Try another one.',
  too_far: "Looks like you're not at this branch. Scan the code in-store 📍",
  account_restricted: 'Your account is restricted. Contact Perkly support.',
  not_authenticated: 'Please log in again.',
  network: 'Wi-Fi acting up? No worries 💜 Try again soon.',
};
export const friendlyError = (code: string | undefined) => MESSAGES[code ?? ''] ?? 'Oops! Something went wrong. Try again 🔄';
