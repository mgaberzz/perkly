/** Events a business can subscribe to (same list as the database). */
export const WEBHOOK_EVENTS = ["redemption.created", "redemption.reversed", "refund.requested", "refund.decided", "settlement.paid"] as const;
export const WEBHOOK_EVENT_LABEL: Record<string, string> = {
  "redemption.created": "A student redeems a perk",
  "redemption.reversed": "A transaction is reversed",
  "refund.requested": "A student asks for a refund",
  "refund.decided": "A refund is approved or rejected",
  "settlement.paid": "A payout is paid",
  ping: "Test event",
};
