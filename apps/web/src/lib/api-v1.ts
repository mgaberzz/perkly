import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashSecret } from "@/lib/api-keys";

/** Shared helpers for the merchant REST API (/api/v1). Every query is limited to the key's business. */
export type ApiCtx = { merchantId: string; db: ReturnType<typeof createAdminClient> };

export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export const fail = (status: number, code: string, message: string) => json({ error: { code, message } }, status);

export async function auth(req: Request): Promise<ApiCtx | Response> {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(sk_live_[A-Za-z0-9]{20,80})$/.exec(h.trim());
  if (!m) return fail(401, "unauthorized", "Send your secret key as: Authorization: Bearer sk_live_…");
  const db = createAdminClient();
  const { data, error } = await db.rpc("api_key_lookup", { p_hash: hashSecret(m[1]) });
  if (error) return fail(500, "server_error", "Something went wrong. Try again.");
  const row = (data as { merchant_id: string }[] | null)?.[0];
  if (!row) return fail(401, "unauthorized", "This key is not valid, was recreated, or API access is turned off for your business.");
  return { merchantId: row.merchant_id, db };
}

export const TX_SELECT =
  "id, tx_code, verification_code, created_at, status, channel, payment_method, original_amount, discount_amount, final_amount, " +
  "first_time_at_merchant, receipt_ref, branch:merchant_branches(id, name), qr:branch_qr_codes(label, cashier_name), perk:perks(id, title), settlement:settlements(status)";

type TxRow = {
  id: string; tx_code: string; verification_code: string; created_at: string; status: string; channel: string; payment_method: string;
  original_amount: number | null; discount_amount: number | null; final_amount: number | null; first_time_at_merchant: boolean; receipt_ref: string | null;
  branch: { id: string; name: string } | null; qr: { label: string; cashier_name: string | null } | null; perk: { id: string; title: string } | null;
  settlement: { status: string } | null;
};

/** The public shape of a transaction (no student personal data). */
export function txOut(r: TxRow) {
  return {
    id: r.tx_code, uuid: r.id, code: r.verification_code, created_at: r.created_at, status: r.status,
    channel: r.channel, payment: r.payment_method === "in_app" ? "in_app" : "cashier",
    bill: num(r.original_amount), discount: num(r.discount_amount), paid: num(r.final_amount), currency: "EGP",
    new_customer: r.first_time_at_merchant, receipt_ref: r.receipt_ref,
    branch: r.branch, cashier: r.qr ? r.qr.cashier_name ?? r.qr.label : null, perk: r.perk,
    settlement: r.status === "reversed" ? null : r.settlement?.status ?? "pending",
  };
}
const num = (v: number | null) => (v == null ? null : Number(v));
export type { TxRow };
