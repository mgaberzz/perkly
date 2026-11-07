import { redirect } from "next/navigation";
import { requireMerchantArea } from "@/lib/auth";
import { Badge, Card, Field, Input, PageHeader, Select, Stat, Table, Td } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ExportButtons } from "@/components/export-buttons";
import { date, egp } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { settlementLabel, type Balance, type Settlement } from "@/lib/types";
import { saveBankAccount } from "../actions";

export const metadata = { title: "Payouts" };

export default async function PayoutsPage() {
  const { supabase, merchant, canSeeMoney, memberRole } = await requireMerchantArea("payouts");
  if (!canSeeMoney) redirect("/merchant");
  const t = await getT();
  const [{ data: b }, { data: settlements }, { data: bank }] = await Promise.all([
    supabase.rpc("merchant_balances", { p_merchant_id: merchant.id }).maybeSingle<Balance>(),
    supabase.from("settlements").select("*").eq("merchant_id", merchant.id).order("created_at", { ascending: false }).limit(50).returns<Settlement[]>(),
    supabase.from("merchant_bank_accounts").select("*").eq("merchant_id", merchant.id).maybeSingle<{ bank_name: string | null; account_name: string | null; iban: string | null; payout_schedule: string }>(),
  ]);
  const toSettle = Number(b?.net_to_settle ?? 0) + Number(b?.pending_settlements ?? 0);
  return (
    <>
      <PageHeader title={t("Payouts")} subtitle={t("Merchant level — all branches together. When students pay in the Perkly app, Perkly collects the money and transfers it to your bank account minus commission.")}
        actions={<ExportButtons kind="settlements" params={{ scope: "merchant" }} />} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat accent label={toSettle >= 0 ? t("Total to be settled to you") : t("Commission you owe Perkly")} value={egp(Math.abs(toSettle))} hint={t("In-app payments minus commission on cashier sales, incl. open settlements")} />
        <Stat label={t("In-app sales (unsettled)")} value={egp(b?.in_app_gross)} hint={t("Perkly commission {amount}", { amount: egp(b?.in_app_commission) })} />
        <Stat label={t("Paid to you so far")} value={egp(b?.paid_out)} hint={b?.last_paid_at ? t("Last transfer {date}", { date: date(b.last_paid_at) }) : undefined} />
        <Stat label={t("Commission on cashier sales")} value={egp(b?.commission_owed)} hint={t("Deducted in your next settlement")} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 font-bold">{t("Settlements")}</h2>
          <Table head={[t("Created"), t("Period"), t("Transactions"), t("Net amount"), t("Paid"), t("Status")]} empty={t("No payouts yet. They appear here once students pay in the app.")}>
            {(settlements ?? []).map((s) => (
              <tr key={s.id}>
                <Td>{date(s.created_at)}</Td>
                <Td className="text-xs">{s.period_start} → {s.period_end}</Td>
                <Td>{s.lines}</Td>
                <Td className="font-bold">{egp(Math.abs(s.amount))}<div className="text-xs font-normal text-zinc-500">{s.amount >= 0 ? t("Perkly pays you") : t("You pay Perkly commission")}</div></Td>
                <Td>{egp(s.paid_amount)}<div className="text-xs text-zinc-500">{t("{amount} remaining", { amount: egp(Math.abs(s.amount) - Number(s.paid_amount)) })}</div></Td>
                <Td><Badge tone={s.status === "paid" ? "paid" : s.status === "partially_paid" ? "pending" : "paused"}>{t(settlementLabel(s.status))}</Badge>{s.reference && <div className="font-mono text-xs text-zinc-500">{s.reference}</div>}</Td>
              </tr>
            ))}
          </Table>
        </div>
        <Card title={t("Bank account")}>
          {memberRole === "owner" ? (
            <ActionForm action={saveBankAccount} className="space-y-3">
              <Field label={t("Bank")}><Input name="bank_name" defaultValue={bank?.bank_name ?? ""} placeholder="CIB, NBE, QNB…" /></Field>
              <Field label={t("Account holder")}><Input name="account_name" defaultValue={bank?.account_name ?? ""} /></Field>
              <Field label="IBAN"><Input name="iban" defaultValue={bank?.iban ?? ""} placeholder="EG…" dir="ltr" /></Field>
              <Field label={t("Payout schedule")}>
                <Select name="payout_schedule" defaultValue={bank?.payout_schedule ?? "weekly"}>
                  {["weekly", "biweekly", "monthly"].map((s) => <option key={s} value={s}>{t(s)}</option>)}
                </Select>
              </Field>
              <SubmitButton className="w-full">{t("Save bank details")}</SubmitButton>
            </ActionForm>
          ) : (
            <dl className="space-y-2 text-sm">
              <div>{bank?.bank_name ?? "—"}</div><div className="font-mono text-xs">{bank?.iban ?? t("No bank account yet")}</div>
              <p className="text-xs text-zinc-500">{t("Only the owner can change bank details.")}</p>
            </dl>
          )}
        </Card>
      </div>
    </>
  );
}
