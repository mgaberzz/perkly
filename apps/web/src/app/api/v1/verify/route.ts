import { auth, fail, json, TX_SELECT, txOut, type TxRow } from "@/lib/api-v1";

/**
 * GET /api/v1/verify?code=7F3K
 * For cashier systems: is the 4-character code on the student's screen a real Perkly redemption
 * at this business in the last 30 minutes? Returns the newest match.
 */
export async function GET(req: Request) {
  const a = await auth(req); if (a instanceof Response) return a;
  const code = (new URL(req.url).searchParams.get("code") ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(code)) return fail(400, "bad_request", "code must be the 4 characters on the student's screen.");
  const since = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data } = await a.db.from("redemptions").select(TX_SELECT).eq("merchant_id", a.merchantId).eq("verification_code", code)
    .gte("created_at", since).order("created_at", { ascending: false }).limit(1).maybeSingle<TxRow>();
  if (!data) return json({ valid: false, message: "No redemption with this code at your business in the last 30 minutes." });
  return json({ valid: data.status !== "reversed", data: txOut(data) });
}
