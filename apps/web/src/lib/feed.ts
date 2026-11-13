// Shared by the merchant Transactions page (server) and the live feed (browser).
export type FeedRow = {
  receipt_ref?: string | null;
  id: string; created_at: string; verification_code: string; tx_code: string; branch_id: string | null;
  original_amount: number | null; discount_amount: number | null; final_amount: number | null;
  status: string; first_time_at_merchant: boolean; channel: string; payment_method: string;
  perk: { title: string } | null; branch: { name: string } | null; qr: { label: string; cashier_name: string | null } | null;
};

export const FEED_SELECT = "id, created_at, verification_code, tx_code, receipt_ref, branch_id, original_amount, discount_amount, final_amount, status, first_time_at_merchant, channel, payment_method, perk:perks(title), branch:merchant_branches(name), qr:branch_qr_codes(label, cashier_name)";
