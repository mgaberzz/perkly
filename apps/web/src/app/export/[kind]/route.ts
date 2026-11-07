import type { NextRequest } from "next/server";
import { getSession, isStaffRole, can, requireMerchant } from "@/lib/auth";
import { cairo, fileResponse, type Column } from "@/lib/export";
import { getLang, getT } from "@/lib/i18n/server";
import type { Balance, Settlement } from "@/lib/types";

type Tx = {
  id: string; created_at: string; verification_code: string; status: string; flag_reason: string | null; first_time_at_merchant: boolean;
  channel: string; payment_method: string; payment_status: string; payment_ref: string | null;
  original_amount: number | null; discount_amount: number | null; final_amount: number | null;
  commission_amount: number | null; merchant_net: number | null; settlement_id: string | null; xp_awarded: number;
  merchant: { merchant_code: string; name: string } | null; branch: { name: string } | null;
  qr: { label: string; cashier_name: string | null } | null; perk: { title: string } | null;
  student?: { student_code: string | null; user_code: string } | null;
};

const TX_SELECT = "id, created_at, verification_code, status, flag_reason, first_time_at_merchant, channel, payment_method, payment_status, payment_ref, original_amount, discount_amount, final_amount, commission_amount, merchant_net, settlement_id, xp_awarded, merchant:merchants(merchant_code, name), branch:merchant_branches(name), qr:branch_qr_codes(label, cashier_name), perk:perks(title)";

const forbidden = () => new Response("Not allowed", { status: 403 });

export async function GET(req: NextRequest, ctx: RouteContext<"/export/[kind]">) {
  const { kind } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const format = sp.get("format") === "xlsx" ? "xlsx" : "csv";
  const scope = sp.get("scope") === "merchant" ? "merchant" : "staff";
  const t = await getT();
  const rtl = (await getLang()) === "ar";
  const from = sp.get("from"), to = sp.get("to");

  // ── Who is asking, and which data they may export ──
  let supabase, merchantId: string | null = sp.get("merchant") || null, branchScope: string | null = null, staff = false;
  if (scope === "merchant") {
    const m = await requireMerchant();
    supabase = m.supabase;
    merchantId = m.merchant.id;
    branchScope = m.branchScope?.id ?? null;
    if (kind !== "transactions" && !m.canSeeMoney) return forbidden();
  } else {
    const s = await getSession();
    if (!s.user || !isStaffRole(s.profile?.role) || s.profile.status !== "active") return forbidden();
    const need = kind === "transactions" ? "redemptions_view" : "finance";
    if (!can(s.profile.role, need)) return forbidden();
    supabase = s.supabase;
    staff = true;
  }

  if (kind === "transactions") {
    const rows: Tx[] = [];
    for (let page = 0; page < 50; page++) {
      let q = supabase.from("redemptions").select(staff ? `${TX_SELECT}, student:profiles(student_code, user_code)` : TX_SELECT)
        .order("created_at", { ascending: false }).range(page * 1000, page * 1000 + 999);
      if (merchantId) q = q.eq("merchant_id", merchantId);
      const branch = branchScope ?? sp.get("branch");
      if (branch) q = q.eq("branch_id", branch);
      if (sp.get("qr")) q = q.eq("qr_code_id", sp.get("qr")!);
      if (sp.get("status")) q = q.eq("status", sp.get("status")!);
      if (sp.get("channel")) q = q.eq("channel", sp.get("channel")!);
      if (sp.get("payment")) q = q.eq("payment_method", sp.get("payment")!);
      if (from) q = q.gte("created_at", `${from}T00:00:00+02:00`);
      if (to) q = q.lte("created_at", `${to}T23:59:59+02:00`);
      const { data, error } = await q.returns<Tx[]>();
      if (error) return new Response(error.message, { status: 400 });
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    const cols: Column<Tx>[] = [
      { header: t("Transaction ID"), value: (r) => r.id, width: 38 },
      { header: t("Date (Cairo)"), value: (r) => cairo(r.created_at), width: 18 },
      { header: t("Code"), value: (r) => r.verification_code },
      { header: t("Merchant ID"), value: (r) => r.merchant?.merchant_code },
      { header: t("Merchant"), value: (r) => r.merchant?.name, width: 22 },
      { header: t("Branch"), value: (r) => r.branch?.name ?? t("Online"), width: 20 },
      { header: t("Cashier"), value: (r) => r.qr?.cashier_name ?? r.qr?.label ?? "" , width: 16 },
      { header: t("Perk"), value: (r) => r.perk?.title, width: 24 },
      ...(staff ? [{ header: t("Student ID"), value: (r: Tx) => r.student?.student_code ?? r.student?.user_code }] : []),
      { header: t("Customer"), value: (r) => (r.first_time_at_merchant ? t("New customer") : t("Recurring customer")), width: 18 },
      { header: t("Channel"), value: (r) => t(r.channel === "online" ? "Online" : "In-store") },
      { header: t("Payment"), value: (r) => t(r.payment_method === "in_app" ? "Paid in app" : "Paid at cashier"), width: 16 },
      { header: t("Payment ref"), value: (r) => r.payment_ref, width: 20 },
      { header: t("Bill (EGP)"), value: (r) => r.original_amount, money: true },
      { header: t("Discount (EGP)"), value: (r) => r.discount_amount, money: true },
      { header: t("Paid (EGP)"), value: (r) => r.final_amount, money: true },
      { header: t("Perkly commission (EGP)"), value: (r) => r.commission_amount, money: true },
      { header: t("Merchant net (EGP)"), value: (r) => r.merchant_net, money: true },
      { header: t("Settled"), value: (r) => (r.payment_method === "in_app" ? (r.settlement_id ? t("Yes") : t("No")) : "") },
      { header: t("Status"), value: (r) => t(r.status) },
      { header: t("Flag"), value: (r) => r.flag_reason },
    ];
    return fileResponse(rows, cols, "perkly-transactions", format, rtl);
  }

  if (kind === "balances") {
    if (!staff) return forbidden();
    const { data, error } = await supabase.rpc("merchant_balances", { p_merchant_id: merchantId });
    if (error) return new Response(error.message, { status: 400 });
    const cols: Column<Balance>[] = [
      { header: t("Merchant ID"), value: (r) => r.merchant_code },
      { header: t("Merchant"), value: (r) => r.merchant_name, width: 24 },
      { header: t("Brand type"), value: (r) => r.brand_type },
      { header: t("In-app sales (EGP)"), value: (r) => r.in_app_gross, money: true },
      { header: t("Perkly commission (EGP)"), value: (r) => r.in_app_commission, money: true },
      { header: t("Due to merchant (EGP)"), value: (r) => r.due_to_merchant, money: true },
      { header: t("Pending payouts (EGP)"), value: (r) => r.pending_settlements, money: true },
      { header: t("Paid out (EGP)"), value: (r) => r.paid_out, money: true },
      { header: t("Cashier sales (EGP)"), value: (r) => r.cashier_sales, money: true },
      { header: t("Commission to invoice (EGP)"), value: (r) => r.commission_owed, money: true },
      { header: t("Last paid"), value: (r) => cairo(r.last_paid_at) },
      { header: t("Bank"), value: (r) => r.bank_name },
      { header: "IBAN", value: (r) => r.iban, width: 32 },
    ];
    const rows = ((data ?? []) as Balance[]).filter((r) => sp.get("all") === "1" || Number(r.due_to_merchant) > 0 || Number(r.pending_settlements) > 0 || Number(r.commission_owed) > 0);
    return fileResponse(rows, cols, "perkly-merchant-balances", format, rtl);
  }

  if (kind === "settlements") {
    let q = supabase.from("settlements").select("*, merchant:merchants(merchant_code, name)").order("created_at", { ascending: false }).limit(5000);
    if (merchantId) q = q.eq("merchant_id", merchantId);
    if (sp.get("status")) q = q.eq("status", sp.get("status")!);
    const { data, error } = await q.returns<(Settlement & { merchant: { merchant_code: string; name: string } })[]>();
    if (error) return new Response(error.message, { status: 400 });
    type S = NonNullable<typeof data>[number];
    const cols: Column<S>[] = [
      { header: t("Settlement ID"), value: (r) => r.id, width: 38 },
      { header: t("Merchant ID"), value: (r) => r.merchant?.merchant_code },
      { header: t("Merchant"), value: (r) => r.merchant?.name, width: 24 },
      { header: t("From"), value: (r) => r.period_start },
      { header: t("To"), value: (r) => r.period_end },
      { header: t("Transactions"), value: (r) => r.lines },
      { header: t("In-app sales (EGP)"), value: (r) => r.gross_amount, money: true },
      { header: t("Perkly commission (EGP)"), value: (r) => r.commission, money: true },
      { header: t("Payout (EGP)"), value: (r) => r.amount, money: true },
      { header: t("Status"), value: (r) => t(r.status) },
      { header: t("Bank reference"), value: (r) => r.reference, width: 20 },
      { header: t("Paid at"), value: (r) => cairo(r.paid_at) },
    ];
    return fileResponse(data ?? [], cols, "perkly-settlements", format, rtl);
  }

  return new Response("Unknown export", { status: 404 });
}
