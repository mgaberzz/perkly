import Link from "next/link";
import { requirePartner } from "@/lib/auth";
import { Amount, Badge, PageHeader, Table, Td } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { date, short } from "@/lib/format";

export const metadata = { title: "My merchants" };
type M = { merchant_id: string; merchant_code: string; name: string; category: string; status: string; city: string | null;
  transactions: number; gmv: number; commission: number; earned: number; last_transaction_at: string | null };

export default async function PartnerMerchants() {
  const { supabase, partner } = await requirePartner();
  const t = await getT();
  const { data } = await supabase.rpc("partner_merchants", { p_partner_id: partner.id });
  const rows = (data ?? []) as M[];
  return (
    <>
      <PageHeader title={t("My merchants")} subtitle={t("{n} merchants you onboarded to Perkly", { n: rows.length })} />
      <Table head={[t("Merchant"), t("Category"), t("City"), t("Status"), t("Transactions"), t("Total GMV"), t("Perkly commission"), t("You earned"), t("Last transaction")]}
        empty={t("No merchants are linked to you yet.")}>
        {rows.map((m) => (
          <tr key={m.merchant_id}>
            <Td><Link href={`/partner/transactions?merchant=${m.merchant_id}`} className="font-semibold hover:text-perk-purple">{m.name}</Link><div className="font-mono text-xs font-normal text-zinc-500">{m.merchant_code}</div></Td>
            <Td>{t(m.category)}</Td>
            <Td>{m.city ?? "—"}</Td>
            <Td phone="sum"><Badge tone={m.status}>{t(m.status)}</Badge></Td>
            <Td>{short(m.transactions)}</Td>
            <Td><Amount v={m.gmv} /></Td>
            <Td><Amount v={m.commission} /></Td>
            <Td phone="sum" className="font-semibold text-perk-purple"><Amount v={m.earned} /></Td>
            <Td>{m.last_transaction_at ? date(m.last_transaction_at) : "—"}</Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
