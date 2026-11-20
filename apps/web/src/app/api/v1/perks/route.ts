import { auth, json } from "@/lib/api-v1";

/** GET /api/v1/perks?status=active (default active; "all" for every perk) */
export async function GET(req: Request) {
  const a = await auth(req); if (a instanceof Response) return a;
  const status = new URL(req.url).searchParams.get("status") ?? "active";
  let q = a.db.from("perks").select("id, title, description, discount_type, discount_value, max_discount_amount, min_spend, valid_days, start_at, end_at, is_flash, status, branch_id")
    .eq("merchant_id", a.merchantId).order("created_at", { ascending: false });
  if (status !== "all") q = q.eq("status", status);
  const { data } = await q;
  return json({ data: (data ?? []).map((p) => ({ ...p, discount_value: Number(p.discount_value), min_spend: Number(p.min_spend), max_discount_amount: p.max_discount_amount == null ? null : Number(p.max_discount_amount) })) });
}
