export type Role = "student" | "merchant" | "admin";
export type MemberRole = "owner" | "manager" | "cashier";

export interface Profile {
  id: string; full_name: string | null; email: string | null; phone: string | null;
  role: Role; status: "active" | "banned"; campus_id: string | null; referral_code: string; created_at: string;
}
export interface Campus { id: string; name: string; short_name: string | null; city: string; type: string; lat: number | null; lng: number | null; is_active: boolean; }
export interface Merchant {
  id: string; name: string; category: string; subcategory: string | null; brand_type: string; description: string | null;
  logo_url: string | null; cover_url: string | null; contact_name: string | null; contact_phone: string | null; contact_email: string | null;
  status: "pending" | "live" | "paused" | "churned"; plan: "free" | "pro"; commission_pct: number; created_at: string;
}
export interface Branch {
  id: string; merchant_id: string; name: string; address: string | null; city: string | null; campus_id: string | null;
  lat: number | null; lng: number | null; is_active: boolean; created_at: string;
}
export interface QrCode { id: string; branch_id: string; code: string; label: string; is_active: boolean; created_at: string; }
export type DiscountType = "percentage" | "amount" | "bogo" | "bundle";
export interface Perk {
  id: string; merchant_id: string; branch_id: string | null; title: string; description: string | null; terms: string | null;
  discount_type: DiscountType; discount_value: number; max_discount_amount: number | null; min_spend: number;
  max_uses_per_user: number | null; daily_cap: number | null; valid_days: number[] | null;
  start_at: string | null; end_at: string | null; is_flash: boolean; priority_score: number;
  status: "pending" | "active" | "paused" | "expired" | "rejected"; review_note: string | null; created_at: string;
}
export interface Redemption {
  id: string; user_id: string; perk_id: string; merchant_id: string; branch_id: string;
  original_amount: number | null; discount_amount: number | null; final_amount: number | null; xp_awarded: number;
  status: "success" | "flagged" | "reversed"; flag_reason: string | null; first_time_at_merchant: boolean;
  verification_code: string; distance_m: number | null; created_at: string;
}
export interface Quest { id: string; title: string; description: string | null; emoji: string | null; quest_type: string; metric: string; target: number; xp_reward: number; is_active: boolean; }

export type ActionState = { error?: string; ok?: string } | undefined;

export const CATEGORIES = ["Food", "Coffee", "Fashion", "Beauty", "Fitness", "Entertainment", "Electronics", "Transport", "Services"] as const;
