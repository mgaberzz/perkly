import type { NextRequest } from "next/server";
import { getSession, isStaffRole, can, requireMerchant } from "@/lib/auth";
import { cairo, fileResponse, type Column } from "@/lib/export";
import { applyTxFilters, readTxFilters, txSelect } from "@/lib/tx-filters";
import { getLang, getT } from "@/lib/i18n/server";
import { settlementLabel, type Balance, type PartnerBalance, type Settlement } from "@/lib/types";

type Tx = {
  id: string; created_at: string; verification_code: string; tx_code: string; status: string; flag_reason: string | null; first_time_at_merchant: boolean;
  channel: string; payment_method: string; payment_status: string; payment_ref: string | null;
  original_amount: number | null; discount_amount: number | null; final_amount: number | null;
  commission_amount: number | null; vat_amount: number | null; merchant_net: number | null; settle_amount: number | null; settlement_id: string | null; xp_awarded: number;
  settlement: { status: string; paid_at: string | null; reference: string | null; settlement_code: string } | null; receipt_ref: string | null;
  merchant: { merchant_code: string; name: string } | null; branch: { name: string } | null;
  qr: { label: string; cashier_name: string | null } | null; perk: { title: string } | null;
  student?: { student_code: string | null; user_code: string } | null;
  partner_earning?: { cut: number; cut_type: string; cut_value: number; partner: { partner_code: string; name: string } | null } | null;
};

const TX_SELECT = "id, created_at, verification_code, tx_code, status, flag_reason, first_time_at_merchant, channel, payment_method, payment_status, payment_ref, original_amount, discount_amount, final_amount, commission_amount, vat_amount, merchant_net, settle_amount, settlement_id, xp_awarded, receipt_ref, settlement:settlements(status, paid_at, reference, settlement_code), merchant:merchants(merchant_code, name), branch:merchant_branches(name), qr:branch_qr_codes(label, cashier_name), perk:perks(title)";

const forbidden = () => new Response("Not allowed", { status: 403 });

export async function GET(req: NextRequest, ctx: RouteContext<"/export/[kind]">) {
  const { kind } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const format = sp.get("format") === "xlsx" ? "xlsx" : "csv";
  const scope = sp.get("scope") === "merchant" ? "merchant" : "staff";
  const t = await getT();
  const rtl = (await getLang()) === "ar";

  // ── Who is asking, and which data they may export ──
  let supabase, merchantId: string | null = sp.get("merchant") || null, branchScope: string | null = null, staff = false, partnerData = false;
  if (scope === "merchant") {
    const m = await requireMerchant();
    supabase = m.supabase;
    merchantId = m.merchant.id;
    branchScope = m.branchScope?.id ?? null;
    if (kind !== "transactions" && !m.canSeeMoney) return forbidden();
  } else {
    const s = await getSession();
    if (!s.user || !isStaffRole(s.profile?.role) || s.profile.status !== "active") return forbidden();
    const need = kind === "transactions" ? "redemptions_view" : kind === "partners" || kind === "partner_payouts" ? "partners_view" : "finance";
    if (!can(s.profile.role, need)) return forbidden();
    partnerData = can(s.profile.role, "partners_view");
    supabase = s.supabase;
    staff = true;
  }

  if (kind === "transactions") {
    const rows: Tx[] = [];
    for (let page = 0; page < 50; page++) {
      const f = readTxFilters((k) => sp.get(k));
      const branch = branchScope ?? sp.get("branch");
      // Partner cut per transaction (staff who may see partners); ?partner=<id> keeps only that partner's transactions
      const partnerFilter = partnerData ? sp.get("partner") : null;
      const pe = partnerData ? `, partner_earning:partner_earnings${partnerFilter ? "!inner" : ""}(cut, cut_type, cut_value, partner_id, partner:partners(partner_code, name))` : "";
      let q = applyTxFilters(supabase.from("redemptions").select(txSelect(staff ? `${TX_SELECT}, student:profiles(student_code, user_code)${pe}` : TX_SELECT, f))
        .order("created_at", { ascending: false }).range(page * 1000, page * 1000 + 999), f);
      if (partnerFilter) q = q.eq("partner_earning.partner_id", partnerFilter);
      if (merchantId) q = q.eq("merchant_id", merchantId);
      if (branchScope) q = q.eq("branch_id", branchScope);
      else if (branch && !f.branch) q = q.eq("branch_id", branch);
      const { data, error } = await q.returns<Tx[]>();
      if (error) return new Response(error.message, { status: 400 });
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    const cols: Column<Tx>[] = [
      { header: t("Transaction ID"), value: (r) => r.tx_code, width: 14 },
      { header: t("Date (Cairo)"), value: (r) => cairo(r.created_at), width: 18 },
      { header: t("Code"), value: (r) => r.verification_code },
      { header: t("Shop receipt / order no."), value: (r) => r.receipt_ref ?? "", width: 18 },
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
      { header: t("Total GMV (EGP)"), value: (r) => r.original_amount, money: true },
      { header: t("Discount (EGP)"), value: (r) => r.discount_amount, money: true },
      { header: t("Discount %"), value: (r) => (r.discount_amount != null && Number(r.original_amount) > 0 ? Math.round((Number(r.discount_amount) / Number(r.original_amount)) * 1000) / 10 : null) },
      { header: t("Paid (EGP)"), value: (r) => r.final_amount, money: true },
      { header: t("Perkly commission (EGP)"), value: (r) => r.commission_amount, money: true },
      { header: t("VAT on commission (EGP)"), value: (r) => r.vat_amount, money: true, width: 18 },
      ...(partnerData ? [
        { header: t("Partner ID"), value: (r: Tx) => r.partner_earning?.partner?.partner_code ?? "" },
        { header: t("Partner"), value: (r: Tx) => r.partner_earning?.partner?.name ?? "", width: 20 },
        { header: t("Partner deal"), value: (r: Tx) => (r.partner_earning ? (r.partner_earning.cut_type === "fixed" ? t("{amount} EGP per transaction", { amount: Number(r.partner_earning.cut_value) }) : t("{pct}% of commission", { pct: Number(r.partner_earning.cut_value) })) : ""), width: 20 },
        { header: t("Partner cut (EGP)"), value: (r: Tx) => (r.status === "reversed" ? 0 : r.partner_earning?.cut ?? null), money: true },
        { header: t("Perkly commission after partner (EGP)"), value: (r: Tx) => (r.commission_amount == null ? null : Number(r.commission_amount) - (r.status === "reversed" ? 0 : Number(r.partner_earning?.cut ?? 0))), money: true, width: 20 },
      ] : []),
      { header: t("Settlement amount (EGP)"), value: (r) => r.merchant_net ?? (r.final_amount == null ? t("No bill entered") : null), money: true, width: 18 },
      { header: t("Collected by"), value: (r) => (r.payment_method === "in_app" ? t("Perkly (in app)") : t("Merchant (cashier)")), width: 18 },
      { header: t("Amount to settle (EGP)"), value: (r) => (r.status === "reversed" ? 0 : r.settle_amount), money: true, width: 18 },
      { header: t("Settlement direction"), value: (r) => (r.status === "reversed" ? t("Reversed — nothing to settle") : Number(r.settle_amount ?? 0) > 0 ? t("Perkly pays merchant") : Number(r.settle_amount ?? 0) < 0 ? t("Merchant pays Perkly commission") : t("Nothing to settle")), width: 26 },
      { header: t("Settlement status"), value: (r) => (r.status === "reversed" ? "—" : t(settlementLabel(r.settlement?.status))), width: 18 },
      { header: t("Settlement ID"), value: (r) => r.settlement?.settlement_code ?? "", width: 14 },
      { header: t("Settled on"), value: (r) => (r.settlement?.status === "paid" ? cairo(r.settlement.paid_at) : "") },
      { header: t("Bank reference"), value: (r) => r.settlement?.reference ?? "" , width: 18 },
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
      { header: t("Perkly commission on in-app (EGP)"), value: (r) => r.in_app_commission, money: true },
      { header: t("Due to merchant (EGP)"), value: (r) => r.due_to_merchant, money: true },
      { header: t("Cashier sales (EGP)"), value: (r) => r.cashier_sales, money: true },
      { header: t("Commission on cashier sales (EGP)"), value: (r) => r.commission_owed, money: true },
      { header: t("VAT on commission (EGP)"), value: (r) => r.vat, money: true },
      { header: t("Net to settle (EGP)"), value: (r) => r.net_to_settle, money: true, width: 18 },
      { header: t("Direction"), value: (r) => (Number(r.net_to_settle) > 0 ? t("Perkly pays merchant") : Number(r.net_to_settle) < 0 ? t("Merchant pays Perkly commission") : "—"), width: 26 },
      { header: t("Open settlements remaining (EGP)"), value: (r) => r.pending_settlements, money: true },
      { header: t("Paid to merchant (EGP)"), value: (r) => r.paid_out, money: true },
      { header: t("Received from merchant (EGP)"), value: (r) => r.received_from_merchant, money: true },
      { header: t("Last paid"), value: (r) => cairo(r.last_paid_at) },
      { header: t("Bank"), value: (r) => r.bank_name },
      { header: "IBAN", value: (r) => r.iban, width: 32 },
    ];
    const rows = ((data ?? []) as Balance[]).filter((r) => sp.get("all") === "1" || Number(r.net_to_settle) !== 0 || Number(r.pending_settlements) !== 0);
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
      { header: t("Settlement ID"), value: (r) => r.settlement_code, width: 14 },
      { header: t("Merchant ID"), value: (r) => r.merchant?.merchant_code },
      { header: t("Merchant"), value: (r) => r.merchant?.name, width: 24 },
      { header: t("From"), value: (r) => r.period_start },
      { header: t("To"), value: (r) => r.period_end },
      { header: t("Transactions"), value: (r) => r.lines },
      { header: t("In-app sales (EGP)"), value: (r) => r.gross_amount, money: true },
      { header: t("Perkly commission (EGP)"), value: (r) => r.commission, money: true },
      { header: t("VAT on commission (EGP)"), value: (r) => r.vat, money: true },
      { header: t("Net amount (EGP)"), value: (r) => r.amount, money: true },
      { header: t("Direction"), value: (r) => (r.amount > 0 ? t("Perkly pays merchant") : r.amount < 0 ? t("Merchant pays Perkly commission") : "—"), width: 26 },
      { header: t("Paid so far (EGP)"), value: (r) => r.paid_amount, money: true },
      { header: t("Remaining (EGP)"), value: (r) => Math.abs(r.amount) - Number(r.paid_amount), money: true },
      { header: t("Status"), value: (r) => t(settlementLabel(r.status)) },
      { header: t("Bank reference"), value: (r) => r.reference, width: 20 },
      { header: t("Paid at"), value: (r) => cairo(r.paid_at) },
    ];
    return fileResponse(data ?? [], cols, "perkly-settlements", format, rtl);
  }

  if (kind === "partners") {
    if (!staff) return forbidden();
    const { data, error } = await supabase.rpc("partner_balances", { p_partner_id: sp.get("partner") || null });
    if (error) return new Response(error.message, { status: 400 });
    const cols: Column<PartnerBalance>[] = [
      { header: t("Partner ID"), value: (r) => r.partner_code },
      { header: t("Partner"), value: (r) => r.name, width: 24 },
      { header: t("Deal"), value: (r) => (r.cut_type === "fixed" ? t("{amount} EGP per transaction", { amount: Number(r.cut_value) }) : t("{pct}% of commission", { pct: Number(r.cut_value) })), width: 22 },
      { header: t("Status"), value: (r) => t(r.status) },
      { header: t("Merchants"), value: (r) => Number(r.merchants) },
      { header: t("Transactions"), value: (r) => Number(r.transactions) },
      { header: t("Total GMV (EGP)"), value: (r) => r.gmv, money: true },
      { header: t("Perkly commission from their merchants (EGP)"), value: (r) => r.commission, money: true, width: 22 },
      { header: t("Partner cut earned (EGP)"), value: (r) => r.earned, money: true },
      { header: t("Perkly commission after partner (EGP)"), value: (r) => Number(r.commission) - Number(r.earned), money: true, width: 20 },
      { header: t("Paid to partner (EGP)"), value: (r) => r.paid, money: true },
      { header: t("Due to partner (EGP)"), value: (r) => r.due, money: true },
      { header: t("Last paid"), value: (r) => cairo(r.last_paid_at) },
    ];
    return fileResponse((data ?? []) as PartnerBalance[], cols, "perkly-partner-balances", format, rtl);
  }

  if (kind === "partner_payouts") {
    if (!staff) return forbidden();
    let q = supabase.from("partner_payouts").select("id, amount, reference, note, paid_at, partner:partners(partner_code, name), payer:profiles(full_name)")
      .order("paid_at", { ascending: false }).limit(5000);
    if (sp.get("partner")) q = q.eq("partner_id", sp.get("partner")!);
    type P = { id: string; amount: number; reference: string; note: string | null; paid_at: string; partner: { partner_code: string; name: string } | null; payer: { full_name: string | null } | null };
    const { data, error } = await q.returns<P[]>();
    if (error) return new Response(error.message, { status: 400 });
    const cols: Column<P>[] = [
      { header: t("Paid at"), value: (r) => cairo(r.paid_at), width: 18 },
      { header: t("Partner ID"), value: (r) => r.partner?.partner_code },
      { header: t("Partner"), value: (r) => r.partner?.name, width: 24 },
      { header: t("Amount (EGP)"), value: (r) => r.amount, money: true },
      { header: t("Bank reference"), value: (r) => r.reference, width: 20 },
      { header: t("Note"), value: (r) => r.note, width: 24 },
      { header: t("Recorded by"), value: (r) => r.payer?.full_name ?? "", width: 20 },
      { header: t("Payout ID"), value: (r) => r.id, width: 38 },
    ];
    return fileResponse(data ?? [], cols, "perkly-partner-payouts", format, rtl);
  }

  return new Response("Unknown export", { status: 404 });
}
