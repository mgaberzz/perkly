export type DiscountType = 'percentage' | 'amount' | 'bogo' | 'bundle';

export interface Perk {
  id: string; title: string; description: string | null; terms?: string | null;
  discount_type: DiscountType; discount_value: number; max_discount_amount?: number | null;
  min_spend: number; is_flash: boolean; end_at: string | null; branch_id?: string | null; status?: string;
  priority_score?: number; valid_days?: number[] | null;
}
export interface Branch { id: string; name: string; address?: string | null; lat: number | null; lng: number | null; campus_id: string | null; }
export interface Merchant {
  id: string; name: string; category: string; subcategory: string | null; description: string | null;
  logo_url: string | null; cover_url: string | null; perks: Perk[]; branches: Branch[];
}
export interface Campus { id: string; name: string; short_name: string | null; city: string; lat: number | null; lng: number | null; }
export interface Profile {
  id: string; full_name: string | null; phone: string | null; email: string | null; campus_id: string | null; referral_code: string;
  status: string; role: string; birth_date: string | null; marketing_opt_in: boolean; terms_accepted_at: string | null; referred_by: string | null;
}
export interface Stats {
  total_xp: number; level: number; current_streak: number; longest_streak: number; last_redemption_date: string | null;
  freeze_tokens: number; total_saved: number; total_redemptions: number; spin_tickets: number;
}

export interface RedeemResult {
  ok: true; redemption_id: string; verification_code: string; created_at: string;
  merchant_name: string; branch_name: string; perk_title: string; discount_type: DiscountType; discount_value: number;
  original_amount: number | null; discount_amount: number | null; final_amount: number | null;
  first_time_at_merchant: boolean; xp_awarded: number; total_xp: number; level: number; level_name: string; leveled_up: boolean;
  streak: number; used_freeze_token: boolean;
  quests_completed: { title: string; emoji: string; xp_reward: number }[];
  badges_unlocked: { code: string; name: string; emoji: string }[];
}
export type RpcError = { ok: false; error: string; [k: string]: unknown };
