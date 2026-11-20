import { auth, fail, json, TX_SELECT, txOut, type TxRow } from "@/lib/api-v1";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/v1/transactions?from=YYYY-MM-DD&to=YYYY-MM-DD&branch_id=&status=&limit=50&before=<created_at> */
export async function GET(req: Request) {
  const a = await auth(req); if (a instanceof Response) return a;
  const q = new URL(req.url).searchParams;
  const from = q.get("from"), to = q.get("to"), before = q.get("before"), status = q.get("status"), branch = q.get("branch_id");
  if ((from && !DAY.test(from)) || (to && !DAY.test(to))) return fail(400, "bad_request", "Use dates as YYYY-MM-DD.");
  if (status && !["success", "flagged", "reversed"].includes(status)) return fail(400, "bad_request", "status must be success, flagged or reversed.");
  if (before && Number.isNaN(Date.parse(before))) return fail(400, "bad_request", "before must be a created_at value from a previous page.");
  const limit = Math.min(Math.max(Number(q.get("limit") ?? 50) || 50, 1), 200);
  let query = a.db.from("redemptions").select(TX_SELECT).eq("merchant_id", a.merchantId).order("created_at", { ascending: false }).limit(limit);
  if (from) query = query.gte("created_at", `${from}T00:00:00+02:00`);
  if (to) query = query.lte("created_at", `${to}T23:59:59.999+02:00`);
  if (before) query = query.lt("created_at", before);
  if (status) query = query.eq("status", status);
  if (branch) query = query.eq("branch_id", branch);
  const { data, error } = await query.returns<TxRow[]>();
  if (error) return fail(400, "bad_request", "Check your filters (branch_id must be a branch id from /api/v1/branches).");
  const rows = (data ?? []).map(txOut);
  return json({ data: rows, next_before: rows.length === limit ? rows[rows.length - 1].created_at : null });
}
