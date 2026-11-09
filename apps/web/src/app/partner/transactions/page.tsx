import { requirePartner } from "@/lib/auth";
import { Amount, Badge, PageHeader, Stat, Table, Td } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { dealLabel } from "@/components/partner-form";
import { getT } from "@/lib/i18n/server";
import { dateTime, short } from "@/lib/format";

export const metadata = { title: "Transactions" };
type Tx = { tx_code: string; created_at: string; merchant_id: string; merchant_name: string; branch_name: string; gmv: number | null;
  discount: number | null; commission: number; cut_type: string; cut_value: number; cut: number; status: string };

export default async function PartnerTransactions({ searchParams }: PageProps<"/partner/transactions">) {
  const { supabase, partner } = await requirePartner();
  const t = await getT();
  const sp = await searchParams;
  const g = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const days = ["7", "30", "90", "365"].includes(g("days")) ? Number(g("days")) : 90;
  const merchant = g("merchant");
  const [{ data }, { data: ms }] = await Promise.all([
    supabase.rpc("partner_transactions", { p_partner_id: partner.id, p_days: days, p_merchant_id: merchant || null }),
    supabase.rpc("partner_merchants", { p_partner_id: partner.id }),
  ]);
  const rows = (data ?? []) as Tx[];
  const ok = rows.filter((r) => r.status !== "reversed");
  const sum = (k: keyof Tx) => ok.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  return (
    <>
      <PageHeader title={t("Transactions")} subtitle={t("Every transaction at your merchants and what you earned from it. Student details are never shown.")} />
      <FilterBar path="/partner/transactions" fields={[
        { name: "merchant", label: t("Merchant"), type: "select", value: merchant, all: t("All my merchants"), options: ((ms ?? []) as { merchant_id: string; name: string }[]).map((m) => ({ value: m.merchant_id, label: m.name })) },
        { name: "days", label: t("Period"), type: "select", value: g("days"), all: t("Last 90 days"), options: [{ value: "7", label: t("Last 7 days") }, { value: "30", label: t("Last 30 days") }, { value: "365", label: t("Last 12 months") }] },
      ]} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat accent label={t("You earned")} value={<Amount v={sum("cut")} />} hint={t("Last {days} days", { days })} href="#list" />
        <Stat label={t("Transactions")} value={short(ok.length)} href="#list" />
        <Stat label={t("Total GMV")} value={<Amount v={sum("gmv")} />} href="#list" />
        <Stat label={t("Perkly commission")} value={<Amount v={sum("commission")} />} hint={t("Your cut is calculated from this")} href="#list" />
      </div>
      <div id="list" className="scroll-mt-20" />
      <Table head={[t("Time / ID"), t("Merchant"), t("Branch"), t("Total GMV"), t("Perkly commission"), t("Deal"), t("You earned"), t("Status")]} empty={t("No transactions in this period.")}>
        {rows.map((r) => (
          <tr key={r.tx_code}>
            <Td className="whitespace-nowrap">{dateTime(r.created_at)}<div className="font-mono text-xs font-semibold text-zinc-600">{r.tx_code}</div></Td>
            <Td phone="lead">{r.merchant_name}</Td>
            <Td>{r.branch_name === "Online" ? t("Online") : r.branch_name}</Td>
            <Td><Amount v={r.gmv} /></Td>
            <Td><Amount v={r.commission} /></Td>
            <Td>{dealLabel(r, t)}</Td>
            <Td phone="sum" className={r.status === "reversed" ? "text-zinc-400 line-through" : "font-semibold text-perk-purple"}><Amount v={r.cut} /></Td>
            <Td phone="sum"><Badge tone={r.status}>{t(r.status)}</Badge></Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
