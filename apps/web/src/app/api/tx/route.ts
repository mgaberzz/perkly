import type { NextRequest } from "next/server";
import { getSession, isStaffRole, can, requireMerchant } from "@/lib/auth";
import { applyTxFilters, readTxFilters, txSelect } from "@/lib/tx-filters";

/**
 * Transactions for an in-place "View transactions" panel: the same filters as the Transactions page.
 * Staff see what their role allows (account managers only their merchants); ?scope=merchant is the shop's own.
 */
const SELECT = "id, created_at, tx_code, verification_code, receipt_ref, status, payment_method, original_amount, discount_amount, final_amount, commission_amount, settle_amount, merchant:merchants(id, name), perk:perks(title), branch:merchant_branches(name), settlement:settlements(id, status, settlement_code)";
const LIMIT = 50;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const f = readTxFilters((k) => sp.get(k));
  let supabase, merchantId: string | null = null, branchId: string | null = null, scope: string[] | null = null, money = true;
  if (sp.get("scope") === "merchant") {
    const m = await requireMerchant();
    supabase = m.supabase; merchantId = m.merchant.id; branchId = m.branchScope?.id ?? null; money = m.canSeeMoney;
  } else {
    const s = await getSession();
    if (!s.user || !isStaffRole(s.profile?.role) || s.profile.status !== "active" || !can(s.profile.role, "redemptions_view")) return new Response("Not allowed", { status: 403 });
    supabase = s.supabase;
    if (s.profile.role === "account_manager") { const { data } = await s.supabase.rpc("staff_merchant_ids"); scope = (data ?? []) as string[]; }
    if (f.partner && !can(s.profile.role, "partners_view")) delete f.partner;
  }
  let q = applyTxFilters(supabase.from("redemptions").select(txSelect(SELECT, f), { count: "exact" }).order("created_at", { ascending: false }).limit(LIMIT), f);
  if (merchantId) q = q.eq("merchant_id", merchantId);
  if (branchId) q = q.eq("branch_id", branchId);
  if (scope) q = q.in("merchant_id", scope.length ? scope : ["00000000-0000-0000-0000-000000000000"]);
  const { data, count, error } = await q;
  if (error) return Response.json({ error: error.message }, { status: 400 });
  const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => (money ? r : { ...r, commission_amount: null, settle_amount: null }));
  return Response.json({ rows, count: count ?? rows.length, limit: LIMIT });
}
