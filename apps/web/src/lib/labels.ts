export const ROLE_LABEL: Record<string, string> = {
  admin: "Admin", operations: "Operations", account_manager: "Account manager", finance: "Finance",
  student: "Student", merchant: "Merchant",
};
export const MEMBER_ROLE_LABEL: Record<string, string> = {
  owner: "Owner", manager: "Manager", branch_manager: "Branch manager", cashier: "Cashier",
};
export const BRAND_TYPE_LABEL: Record<string, string> = { local: "Local", chain: "Chain", mega_account: "Mega account" };
export const CHANNEL_LABEL: Record<string, string> = { in_store: "In-store", online: "Online", both: "In-store + online" };
export const REQUEST_KIND_LABEL: Record<string, string> = { qr_code: "Cashier QR", perk: "Perk approval", cashback: "Cashback", payout: "Payout" };
