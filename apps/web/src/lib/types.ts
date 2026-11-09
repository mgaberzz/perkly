export type StaffRole = "admin" | "operations" | "account_manager" | "finance";
export type Role = "student" | "merchant" | StaffRole;
export const STAFF_ROLES: StaffRole[] = ["admin", "operations", "account_manager", "finance"];
export type MemberRole = "owner" | "manager" | "branch_manager" | "cashier";

export interface Profile {
  id: string; full_name: string | null; email: string | null; phone: string | null;
  role: Role; status: "active" | "banned"; campus_id: string | null; referral_code: string; created_at: string;
  user_code: string; student_code: string | null;
}
export interface Campus { id: string; name: string; short_name: string | null; city: string; type: string; lat: number | null; lng: number | null; is_active: boolean; }
export interface Merchant {
  id: string; name: string; category: string; subcategory: string | null; brand_type: string; description: string | null;
  logo_url: string | null; cover_url: string | null; contact_name: string | null; contact_phone: string | null; contact_email: string | null;
  status: "pending" | "live" | "paused" | "churned"; plan: "free" | "pro"; commission_pct: number; created_at: string;
  merchant_code: string; vat_enabled: boolean; channel: "in_store" | "online" | "both"; website_url: string | null; affiliate_url: string | null;
}
export interface Branch {
  id: string; merchant_id: string; name: string; address: string | null; city: string | null; campus_id: string | null;
  lat: number | null; lng: number | null; is_active: boolean; created_at: string;
}
export interface QrCode {
  id: string; branch_id: string; code: string; label: string; is_active: boolean; created_at: string;
  cashier_name: string | null; status: "pending" | "approved" | "rejected"; review_note: string | null;
}
export type DiscountType = "percentage" | "amount" | "bogo" | "bundle";
export interface Perk {
  id: string; merchant_id: string; branch_id: string | null; title: string; description: string | null; terms: string | null;
  discount_type: DiscountType; discount_value: number; max_discount_amount: number | null; min_spend: number;
  max_uses_per_user: number | null; daily_cap: number | null; valid_days: number[] | null;
  start_at: string | null; end_at: string | null; is_flash: boolean; priority_score: number;
  status: "pending" | "active" | "paused" | "expired" | "rejected"; review_note: string | null; created_at: string;
}
export interface Redemption {
  id: string; user_id: string; perk_id: string; merchant_id: string; branch_id: string | null;
  original_amount: number | null; discount_amount: number | null; final_amount: number | null; xp_awarded: number;
  status: "success" | "flagged" | "reversed"; flag_reason: string | null; first_time_at_merchant: boolean;
  verification_code: string; distance_m: number | null; created_at: string;
  channel: "in_store" | "online"; payment_method: "merchant" | "in_app"; payment_status: string;
  commission_amount: number | null; merchant_net: number | null; settlement_id: string | null;
}
export interface Quest { id: string; title: string; description: string | null; emoji: string | null; quest_type: string; metric: string; target: number; xp_reward: number; is_active: boolean; }

export type ActionState = { error?: string; ok?: string } | undefined;

export const CATEGORIES = ["Food", "Coffee", "Fashion", "Beauty", "Fitness", "Entertainment", "Electronics", "Transport", "Services"] as const;

export interface Balance {
  merchant_id: string; merchant_code: string; merchant_name: string; brand_type: string;
  in_app_gross: number; in_app_commission: number; due_to_merchant: number; cashier_sales: number; commission_owed: number;
  /** 14% VAT on Perkly commission (unsettled) */ vat: number;
  /** + Perkly pays the merchant, − merchant pays Perkly (unsettled transactions) */ net_to_settle: number;
  /** remaining on open settlements (signed) */ pending_settlements: number; paid_out: number; received_from_merchant: number;
  last_paid_at: string | null; bank_name: string | null; iban: string | null;
}
export interface Settlement {
  id: string; settlement_code: string; merchant_id: string; period_start: string | null; period_end: string; gross_amount: number; commission: number;
  amount: number; lines: number; status: "pending" | "partially_paid" | "paid"; paid_amount: number; vat: number; reference: string | null; created_at: string; paid_at: string | null;
}
export interface AdminRequest {
  id: string; kind: "qr_code" | "perk" | "cashback" | "payout"; merchant_id: string | null; ref_id: string; title: string;
  details: Record<string, unknown>; status: "pending" | "approved" | "rejected"; created_at: string; resolved_at: string | null; note: string | null;
}
export const BRAND_TYPES = ["local", "chain", "mega_account"] as const;

/** Settlement status shown on every transaction (follows its settlement batch; changes only when finance records a payment) */
export const SETTLEMENT_LABEL: Record<string, string> = { paid: "Settled", partially_paid: "Partially settled", pending: "Not settled yet" };
export const settlementLabel = (status: string | null | undefined) => SETTLEMENT_LABEL[status ?? "pending"] ?? "Not settled yet";

export type Partner = {
  id: string; partner_code: string; name: string; contact_name: string | null; contact_phone: string | null; contact_email: string | null;
  cut_type: "percentage" | "fixed"; cut_value: number; status: "active" | "paused"; notes: string | null; created_at: string;
};
export type PartnerBalance = {
  partner_id: string; partner_code: string; name: string; status: string; cut_type: "percentage" | "fixed"; cut_value: number;
  merchants: number; transactions: number; gmv: number; commission: number; earned: number; paid: number; due: number; last_paid_at: string | null;
};
