import { auth, fail, json, TX_SELECT, txOut, type TxRow } from "@/lib/api-v1";

/** GET /api/v1/transactions/9000000018 (transaction ID) */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await auth(req); if (a instanceof Response) return a;
  const { id } = await params;
  if (!/^9\d{9}$/.test(id)) return fail(400, "bad_request", "Use the 10-digit transaction ID (starts with 9).");
  const { data } = await a.db.from("redemptions").select(TX_SELECT).eq("merchant_id", a.merchantId).eq("tx_code", id).maybeSingle<TxRow>();
  if (!data) return fail(404, "not_found", "No transaction with this ID for your business.");
  return json({ data: txOut(data) });
}
