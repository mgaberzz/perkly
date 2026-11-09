import { requirePartner } from "@/lib/auth";
import { Amount, PageHeader, Stat, Table, Td } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { date, dateTime } from "@/lib/format";
import type { PartnerBalance } from "@/lib/types";

export const metadata = { title: "Payments" };

export default async function PartnerPayments() {
  const { supabase, partner } = await requirePartner();
  const t = await getT();
  const [{ data: bal }, { data: payouts }] = await Promise.all([
    supabase.rpc("partner_balances", { p_partner_id: partner.id }),
    supabase.from("partner_payouts").select("id, amount, reference, note, paid_at").eq("partner_id", partner.id).order("paid_at", { ascending: false }),
  ]);
  const b = ((bal ?? []) as PartnerBalance[])[0];
  return (
    <>
      <PageHeader title={t("Payments")} subtitle={t("What Perkly has paid you, and what is still due.")} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat accent label={t("Due to you")} value={<Amount v={b?.due ?? 0} />} hint={t("Earned minus paid")} href="/partner/transactions" />
        <Stat label={t("You earned")} value={<Amount v={b?.earned ?? 0} />} hint={t("All time")} href="/partner/transactions" />
        <Stat label={t("Paid to you")} value={<Amount v={b?.paid ?? 0} />} hint={b?.last_paid_at ? t("Last paid {date}", { date: date(b.last_paid_at) }) : t("Nothing paid yet")} href="#list" />
      </div>
      <div id="list" className="scroll-mt-20" />
      <Table head={[t("Paid at"), t("Bank reference"), t("Note"), t("Amount")]} empty={t("No payments yet.")}>
        {(payouts ?? []).map((p) => (
          <tr key={p.id}><Td>{dateTime(p.paid_at)}</Td><Td className="font-mono">{p.reference}</Td><Td>{p.note ?? "—"}</Td><Td phone="sum" className="font-semibold"><Amount v={p.amount} /></Td></tr>
        ))}
      </Table>
    </>
  );
}
