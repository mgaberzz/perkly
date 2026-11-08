import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { Amount, Badge, Card, Input, LinkButton, PageHeader, Stat, Table, Td } from "@/components/ui";
import { MoneySummary } from "@/components/money-summary";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ExportButtons } from "@/components/export-buttons";
import { date, egp } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { BRAND_TYPE_LABEL } from "@/lib/labels";
import { settlementLabel, type Balance, type PartnerBalance, type Settlement } from "@/lib/types";
import { createSettlements, markSettlementPaid } from "../actions";

export const metadata = { title: "Finance" };

export default async function FinancePage({ searchParams }: PageProps<"/admin/finance">) {
  const { supabase, can } = await requireStaff("finance");
  const t = await getT();
  const sp = await searchParams;
  const view = sp.view === "all" ? "all" : "due";
  const [{ data: balances }, { data: settlements }, { data: setting }, { data: tax }, { data: partnerBal }] = await Promise.all([
    supabase.rpc("merchant_balances"),
    supabase.from("settlements").select("*, merchant:merchants(id, name, merchant_code)").order("created_at", { ascending: false }).limit(100)
      .returns<(Settlement & { merchant: { id: string; name: string; merchant_code: string } })[]>(),
    supabase.from("app_settings").select("value").eq("key", "payments").maybeSingle<{ value: { mode: string; provider: string | null } }>(),
    supabase.from("app_settings").select("value").eq("key", "tax").maybeSingle<{ value: { vat_pct: number } }>(),
    supabase.rpc("partner_balances"),
  ]);
  const partners = (partnerBal ?? []) as PartnerBalance[];
  const pSum = (k: keyof PartnerBalance) => partners.reduce((a, p) => a + Number(p[k] ?? 0), 0);
  const all = (balances ?? []) as Balance[];
  const sum = (k: keyof Balance) => all.reduce((a, b) => a + Number(b[k] ?? 0), 0);
  const rows = view === "all" ? all : all.filter((b) => Number(b.net_to_settle) !== 0 || Number(b.pending_settlements) !== 0);
  rows.sort((a, b) => Math.abs(Number(b.net_to_settle)) - Math.abs(Number(a.net_to_settle)));
  const pending = (settlements ?? []).filter((s) => s.status !== "paid");
  const net = sum("net_to_settle");
  const mode = setting?.value.mode ?? "off";

  return (
    <>
      <PageHeader title={t("Finance & settlements")} subtitle={t("What Perkly owes merchants from in-app payments, and the commission merchants owe on cashier sales.")}
        actions={<ExportButtons kind="balances" params={{ all: view === "all" ? "1" : undefined }} />} />

      <MoneySummary days={Number(sp.days) || 30} />
      <h2 className="mb-3 mt-2 font-bold">{t("Settlement position")}</h2>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Link href={`/admin/explain?metric=net_to_settle`} className="block transition hover:-translate-y-0.5"><Stat label={t("Net to settle")} value={<Amount v={net} />} hint={t("In-app sales owed to merchants minus commission on cashier sales — not yet in a settlement")} /></Link>
        <Link href={`/admin/explain?metric=open_settlements`} className="block transition hover:-translate-y-0.5"><Stat label={t("Open settlements")} value={<Amount v={sum("pending_settlements")} />} hint={t("{n} settlement(s) not fully paid", { n: pending.length })} /></Link>
        <Link href={`/admin/explain?metric=paid_to_merchants`} className="block transition hover:-translate-y-0.5"><Stat label={t("Paid to merchants")} value={<Amount v={sum("paid_out")} />} /></Link>
        <Link href={`/admin/explain?metric=received_from_merchants`} className="block transition hover:-translate-y-0.5"><Stat label={t("Received from merchants")} value={<Amount v={sum("received_from_merchant")} />} hint={t("Commission collected")} /></Link>
      </div>

      <div className="mb-3 mt-2 flex items-center justify-between"><h2 className="font-bold">🤝 {t("Partners")}</h2><Link href="/admin/partners" className="text-sm font-semibold text-perk-purple hover:underline">{t("Open partners")} →</Link></div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Link href="/admin/partners" className="block transition hover:-translate-y-0.5"><Stat label={t("Owed to partners")} value={<Amount v={pSum("due")} />} hint={t("Earned minus paid")} /></Link>
        <Link href="/admin/partners" className="block transition hover:-translate-y-0.5"><Stat label={t("Partner cuts")} value={<Amount v={pSum("earned")} />} hint={t("All time")} /></Link>
        <Link href="/admin/partners" className="block transition hover:-translate-y-0.5"><Stat label={t("Paid to partners")} value={<Amount v={pSum("paid")} />} hint={t("All time")} /></Link>
        <Link href="/admin/partners" className="block transition hover:-translate-y-0.5"><Stat label={t("Perkly commission after partners")} value={<Amount v={partners.reduce((a, p) => a + Number(p.commission) - Number(p.earned), 0)} />} hint={t("On partner merchants, all time")} /></Link>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-4">
        <Card title={t("Create settlements")} className="lg:col-span-2">
          <p className="mb-3 text-sm text-zinc-500">{t("Groups every unsettled transaction up to the chosen date into one netted settlement per merchant: in-app payments Perkly owes the merchant, minus the commission the merchant owes Perkly on cashier sales. Transactions show “Not settled yet” until finance records a payment.")}</p>
          <ActionForm action={createSettlements} className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-zinc-500">{t("Up to (Cairo date)")}<Input type="date" name="until" className="w-44" /></label>
            <SubmitButton>{t("Create settlements")}</SubmitButton>
          </ActionForm>
        </Card>
        <Card title={t("Rates & payments")} className="lg:col-span-2">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>{t("VAT on commission")}: <Badge tone={Number(tax?.value.vat_pct ?? 14) > 0 ? "live" : "paused"}>{Number(tax?.value.vat_pct ?? 14) > 0 ? `${tax?.value.vat_pct ?? 14}%` : t("off")}</Badge></div>
            <div>{t("In-app payments")}: <Badge tone={mode === "live" ? "live" : mode === "test" ? "pending" : "paused"}>{t(mode)}</Badge></div>
          </div>
          <p className="mt-3 text-xs text-zinc-500">{can("settings") ? <>{t("Change these in")} <Link href="/admin/settings" className="font-semibold text-perk-purple hover:underline">{t("Settings")}</Link>.</> : t("Only an admin can change these.")}</p>
        </Card>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">{t("Merchant balances")}</h2>
        <div className="flex gap-2">
          <LinkButton href="/admin/finance" variant={view === "due" ? "primary" : "secondary"}>{t("With amounts due")}</LinkButton>
          <LinkButton href="/admin/finance?view=all" variant={view === "all" ? "primary" : "secondary"}>{t("All merchants")}</LinkButton>
        </div>
      </div>
      <Table head={[t("Merchant"), t("Brand type"), t("In-app sales"), t("Due to merchant"), t("Commission on cashier sales"), t("VAT on commission"), t("Net to settle"), t("Open settlements"), t("Bank")]} empty={t("Nothing due 🎉")}>
        {rows.map((b) => (
          <tr key={b.merchant_id}>
            <Td><Link href={`/admin/merchants/${b.merchant_id}`} className="font-semibold hover:text-perk-purple">{b.merchant_name}</Link><div className="font-mono text-xs text-zinc-500">{b.merchant_code}</div></Td>
            <Td>{t(BRAND_TYPE_LABEL[b.brand_type] ?? b.brand_type)}</Td>
            <Td><Link href={`/admin/explain?metric=net_to_settle&kind=in_app&merchant=${b.merchant_id}`} className="hover:underline"><Amount v={b.in_app_gross} /></Link></Td>
            <Td><Link href={`/admin/explain?metric=net_to_settle&kind=in_app&merchant=${b.merchant_id}`} className="hover:underline"><Amount v={b.due_to_merchant} /></Link></Td>
            <Td><Link href={`/admin/explain?metric=net_to_settle&kind=cashier&merchant=${b.merchant_id}`} className="hover:underline"><Amount v={b.commission_owed} /></Link></Td>
            <Td><Link href={`/admin/explain?metric=net_to_settle&kind=cashier&merchant=${b.merchant_id}`} className="hover:underline"><Amount v={b.vat} /></Link></Td>
            <Td phone="sum" className="font-bold text-perk-purple"><Link href={`/admin/explain?metric=net_to_settle&merchant=${b.merchant_id}`} className="hover:underline"><Amount v={b.net_to_settle} /></Link><div className="text-xs font-normal text-zinc-500">{Number(b.net_to_settle) > 0 ? t("Perkly pays merchant") : Number(b.net_to_settle) < 0 ? t("Merchant pays Perkly commission") : ""}</div></Td>
            <Td><Link href={`/admin/explain?metric=open_settlements&merchant=${b.merchant_id}`} className="hover:underline"><Amount v={b.pending_settlements} /></Link></Td>
            <Td className="text-xs">{b.bank_name ? <>{b.bank_name}<div className="font-mono text-zinc-500">{b.iban}</div></> : <span className="text-amber-600">{t("Missing")}</span>}</Td>
          </tr>
        ))}
      </Table>

      <div className="mb-3 mt-8 flex items-center justify-between">
        <h2 id="settlements" className="font-bold">{t("Settlements")}</h2>
        <ExportButtons kind="settlements" />
      </div>
      <Table head={[t("Created"), t("Merchant"), t("Period"), t("Transactions"), t("Net amount"), t("Paid"), t("Status"), ""]} empty={t("No settlements yet.")}>
        {(settlements ?? []).map((s) => (
          <tr key={s.id}>
            <Td>{date(s.created_at)}</Td>
            <Td phone="lead">{s.merchant.name}<div className="font-mono text-xs text-zinc-500">{s.merchant.merchant_code}</div></Td>
            <Td className="text-xs">{s.period_start} → {s.period_end}</Td>
            <Td><Link href={`/admin/explain?metric=settlement&id=${s.id}`} className="font-semibold text-perk-purple hover:underline">{s.lines}</Link></Td>
            <Td phone="sum" className="font-bold"><Link href={`/admin/explain?metric=settlement&id=${s.id}`} className="hover:underline">{egp(Math.abs(s.amount))}</Link><div className="text-xs font-normal text-zinc-500">{s.amount >= 0 ? t("Perkly pays merchant") : t("Merchant pays Perkly commission")}</div><div className="text-xs font-normal text-zinc-500">{t("commission {c} + VAT {v}", { c: egp(s.commission), v: egp(s.vat) })}</div></Td>
            <Td>{egp(s.paid_amount)}<div className="text-xs text-zinc-500">{t("{amount} remaining", { amount: egp(Math.abs(s.amount) - Number(s.paid_amount)) })}</div></Td>
            <Td phone="sum"><Badge tone={s.status === "paid" ? "paid" : s.status === "partially_paid" ? "pending" : "paused"}>{t(settlementLabel(s.status))}</Badge>{s.reference && <div className="font-mono text-xs text-zinc-500">{s.reference}</div>}</Td>
            <Td>
              {s.status !== "paid" && (
                <ActionForm action={markSettlementPaid} className="flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={s.id} />
                  <Input name="amount" type="number" step="0.01" min="0.01" placeholder={t("Amount (empty = all)")} className="w-32 text-xs" />
                  <Input name="reference" placeholder={t("Bank reference")} className="w-32 text-xs" required />
                  <SubmitButton variant="secondary" className="text-xs">{t("Record payment")}</SubmitButton>
                </ActionForm>
              )}
            </Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
