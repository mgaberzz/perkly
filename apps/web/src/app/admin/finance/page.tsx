import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { Amount, Badge, Card, Input, LinkButton, PageHeader, Stat, Table, Td } from "@/components/ui";
import { MoneySummary } from "@/components/money-summary";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ExportButtons } from "@/components/export-buttons";
import { date, egp } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { BRAND_TYPE_LABEL } from "@/lib/labels";
import { settlementLabel, type Balance, type Settlement } from "@/lib/types";
import { createSettlements, markSettlementPaid, setPaymentsMode } from "../actions";

export const metadata = { title: "Finance" };

export default async function FinancePage({ searchParams }: PageProps<"/admin/finance">) {
  const { supabase, can } = await requireStaff("finance");
  const t = await getT();
  const sp = await searchParams;
  const view = sp.view === "all" ? "all" : "due";
  const [{ data: balances }, { data: settlements }, { data: setting }] = await Promise.all([
    supabase.rpc("merchant_balances"),
    supabase.from("settlements").select("*, merchant:merchants(id, name, merchant_code)").order("created_at", { ascending: false }).limit(100)
      .returns<(Settlement & { merchant: { id: string; name: string; merchant_code: string } })[]>(),
    supabase.from("app_settings").select("value").eq("key", "payments").maybeSingle<{ value: { mode: string; provider: string | null } }>(),
  ]);
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
        <Stat label={t("Net to settle")} value={<Amount v={net} />} hint={t("In-app sales owed to merchants minus commission on cashier sales — not yet in a settlement")} />
        <Stat label={t("Open settlements")} value={<Amount v={sum("pending_settlements")} />} hint={t("{n} settlement(s) not fully paid", { n: pending.length })} />
        <Stat label={t("Paid to merchants")} value={<Amount v={sum("paid_out")} />} />
        <Stat label={t("Received from merchants")} value={<Amount v={sum("received_from_merchant")} />} hint={t("Commission collected")} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card title={t("Create settlements")} className="lg:col-span-2">
          <p className="mb-3 text-sm text-zinc-500">{t("Groups every unsettled transaction up to the chosen date into one netted settlement per merchant: in-app payments Perkly owes the merchant, minus the commission the merchant owes Perkly on cashier sales. Transactions show “Not settled yet” until finance records a payment.")}</p>
          <ActionForm action={createSettlements} className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-zinc-500">{t("Up to (Cairo date)")}<Input type="date" name="until" className="w-44" /></label>
            <SubmitButton>{t("Create settlements")}</SubmitButton>
          </ActionForm>
        </Card>
        <Card title={t("In-app payments")}>
          <div className="mb-3 flex items-center gap-2 text-sm">{t("Mode")}: <Badge tone={mode === "live" ? "live" : mode === "test" ? "pending" : "paused"}>{t(mode)}</Badge></div>
          <p className="mb-3 text-xs text-zinc-500">{t("Test mode records payments without charging cards. Switch to live once a payment gateway (e.g. Paymob) is connected.")}</p>
          {can("settings") && (
            <form action={setPaymentsMode} className="flex gap-2">
              {["off", "test", "live"].map((m) => (
                <button key={m} name="mode" value={m} disabled={m === "live"} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-zinc-200 disabled:opacity-40 ${m === mode ? "bg-perk-ink text-white" : "bg-white"}`}>{t(m)}</button>
              ))}
            </form>
          )}
        </Card>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">{t("Merchant balances")}</h2>
        <div className="flex gap-2">
          <LinkButton href="/admin/finance" variant={view === "due" ? "primary" : "secondary"}>{t("With amounts due")}</LinkButton>
          <LinkButton href="/admin/finance?view=all" variant={view === "all" ? "primary" : "secondary"}>{t("All merchants")}</LinkButton>
        </div>
      </div>
      <Table head={[t("Merchant"), t("Brand type"), t("In-app sales"), t("Due to merchant"), t("Commission on cashier sales"), t("VAT 14% on commission"), t("Net to settle"), t("Open settlements"), t("Bank")]} empty={t("Nothing due 🎉")}>
        {rows.map((b) => (
          <tr key={b.merchant_id}>
            <Td><Link href={`/admin/merchants/${b.merchant_id}`} className="font-semibold hover:text-perk-purple">{b.merchant_name}</Link><div className="font-mono text-xs text-zinc-500">{b.merchant_code}</div></Td>
            <Td>{t(BRAND_TYPE_LABEL[b.brand_type] ?? b.brand_type)}</Td>
            <Td>{egp(b.in_app_gross)}</Td>
            <Td>{egp(b.due_to_merchant)}</Td>
            <Td>{egp(b.commission_owed)}</Td>
            <Td>{egp(b.vat)}</Td>
            <Td className="font-bold text-perk-purple">{egp(b.net_to_settle)}<div className="text-xs font-normal text-zinc-500">{Number(b.net_to_settle) > 0 ? t("Perkly pays merchant") : Number(b.net_to_settle) < 0 ? t("Merchant pays Perkly commission") : ""}</div></Td>
            <Td>{egp(b.pending_settlements)}</Td>
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
            <Td>{s.merchant.name}<div className="font-mono text-xs text-zinc-500">{s.merchant.merchant_code}</div></Td>
            <Td className="text-xs">{s.period_start} → {s.period_end}</Td>
            <Td>{s.lines}</Td>
            <Td className="font-bold">{egp(Math.abs(s.amount))}<div className="text-xs font-normal text-zinc-500">{s.amount >= 0 ? t("Perkly pays merchant") : t("Merchant pays Perkly commission")}</div><div className="text-xs font-normal text-zinc-500">{t("commission {c} + VAT {v}", { c: egp(s.commission), v: egp(s.vat) })}</div></Td>
            <Td>{egp(s.paid_amount)}<div className="text-xs text-zinc-500">{t("{amount} remaining", { amount: egp(Math.abs(s.amount) - Number(s.paid_amount)) })}</div></Td>
            <Td><Badge tone={s.status === "paid" ? "paid" : s.status === "partially_paid" ? "pending" : "paused"}>{t(settlementLabel(s.status))}</Badge>{s.reference && <div className="font-mono text-xs text-zinc-500">{s.reference}</div>}</Td>
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
