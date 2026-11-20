import Link from "next/link";
import { requireMerchantArea } from "@/lib/auth";
import { PageHeader, Table, Td } from "@/components/ui";
import { egp } from "@/lib/format";
import { getLang, getT } from "@/lib/i18n/server";
import { monthLabel, recentMonths, type Statement } from "@/components/statement-view";

export const metadata = { title: "Statements" };

export default async function StatementsPage() {
  const { supabase, merchant } = await requireMerchantArea("statements");
  const [t, lang] = [await getT(), await getLang()];
  const { data: m } = await supabase.from("merchants").select("created_at").eq("id", merchant.id).maybeSingle<{ created_at: string }>();
  const months = recentMonths(12, m?.created_at);
  const rows = await Promise.all(months.map(async (mm) => {
    const { data } = await supabase.rpc("merchant_statement", { p_merchant_id: merchant.id, p_month: `${mm}-01` });
    return { month: mm, s: data as Statement | null };
  }));
  return (
    <>
      <PageHeader title={t("Reports & statements")} subtitle={t("A statement for every month: transactions, discounts, Perkly commission and payouts. Open one to print or save it as PDF.")} />
      <Table head={[t("Month"), t("Transactions"), t("Bills"), t("Discounts given"), t("Net"), ""]} empty={t("No statements yet.")}>
        {rows.map(({ month, s }) => (
          <tr key={month}>
            <Td className="font-semibold"><Link href={`/merchant/statements/${month}`} className="hover:text-perk-purple">{monthLabel(month, lang)}</Link></Td>
            <Td>{s?.transactions ?? 0}</Td>
            <Td>{egp(s?.bills ?? 0)}</Td>
            <Td>{egp(s?.discounts ?? 0)}</Td>
            <Td>{egp(Math.abs(Number(s?.net ?? 0)))}<div className="text-xs text-zinc-500">{Number(s?.net ?? 0) < 0 ? t("You owe Perkly") : t("Perkly pays you")}</div></Td>
            <Td className="text-end"><Link href={`/merchant/statements/${month}`} className="text-sm font-semibold text-perk-purple hover:underline">{t("Open")} →</Link></Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
