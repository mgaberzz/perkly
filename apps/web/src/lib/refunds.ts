export const REFUND_REASON_LABEL: Record<string, string> = {
  wrong_amount: "Wrong amount entered", order_cancelled: "Order cancelled", returned: "Item returned",
  charged_twice: "Charged twice", no_discount: "Discount wasn't applied", other: "Other",
};
export const REFUND_ERRORS: Record<string, string> = {
  not_allowed: "You don't have permission to do this.", already_decided: "This refund was already decided.",
  note_required: "Write a reason so the student knows why.", note_too_long: "Keep the note under 500 characters.",
  reference_required: "Enter the payment reference.", not_due: "This refund isn't waiting for payment.", not_found: "Refund not found.",
};
export const REFUND_SELECT =
  "id, refund_code, student_code, amount, paid_in_app, reason, note, status, decided_as, decided_at, decision_note, payout_status, payout_ref, paid_at, was_settled, created_at, merchant_id, " +
  "redemption:redemptions(id, tx_code, created_at, original_amount, discount_amount, final_amount, receipt_ref, settlement:settlements(settlement_code), branch:merchant_branches(name), perk:perks(title)), " +
  "student:profiles!refund_requests_user_id_fkey(full_name, student_code), merchant:merchants(id, name, merchant_code)";
export type RefundRow = {
  id: string; refund_code: string; /** the student's Student ID, copied onto the request so merchants can see it */ student_code: string | null; amount: number; paid_in_app: boolean; reason: string; note: string | null; status: "pending" | "approved" | "rejected";
  decided_as: "merchant" | "perkly" | null; decided_at: string | null; decision_note: string | null;
  payout_status: "na" | "by_merchant" | "due" | "paid"; payout_ref: string | null; paid_at: string | null; was_settled: boolean; created_at: string; merchant_id: string;
  redemption: { id: string; tx_code: string | null; created_at: string; original_amount: number | null; discount_amount: number | null; final_amount: number | null; receipt_ref: string | null;
    settlement: { settlement_code: string } | null; branch: { name: string } | null; perk: { title: string } | null } | null;
  student: { full_name: string | null; student_code: string | null } | null;
  merchant: { id: string; name: string; merchant_code: string } | null;
};
