import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { PageHeader, Table, Td } from "@/components/ui";
import { PageTabs } from "@/components/page-tabs";
import { egp } from "@/lib/format";
import { getLang, getT } from "@/lib/i18n/server";
import { merchantTabs } from "@/lib/merchant-tabs";
import { monthLabel, recentMonths, type Statement } from "@/components/statement-view";

export const metadata = { title: "Statements" };

export default async function AdminStatements({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, can, merchantScope } = await requireStaff("merchants_view");
  if (merchantScope && !merchantScope.includes(id)) notFound();
  const [t, lang] = [await getT(), await getLang()];
  const { data: m } = await supabase.from("merchants").select("name, merchant_code, created_at").eq("id", id).maybeSingle<{ name: string; merchant_code: string; created_at: string }>();
  if (!m) notFound();
  const months = recentMonths(12, m.created_at);
  const rows = await Promise.all(months.map(async (mm) => ({ month: mm, s: (await supabase.rpc("merchant_statement", { p_merchant_id: id, p_month: `${mm}-01` })).data as Statement | null })));
  return (
    <>
      <PageHeader title={m.name} subtitle={<span className="font-mono">{m.merchant_code}</span>} />
      <PageTabs tabs={merchantTabs(id, can("merchants_edit"), t)} />
      <Table head={[t("Month"), t("Transactions"), t("Bills"), t("Discounts given"), t("Net"), ""]} empty={t("No statements yet.")}>
        {rows.map(({ month, s }) => (
          <tr key={month}>
            <Td className="font-semibold"><Link href={`/admin/merchants/${id}/statements/${month}`} className="hover:text-perk-purple">{monthLabel(month, lang)}</Link></Td>
            <Td>{s?.transactions ?? 0}</Td>
            <Td>{egp(s?.bills ?? 0)}</Td>
            <Td>{egp(s?.discounts ?? 0)}</Td>
            <Td>{egp(Math.abs(Number(s?.net ?? 0)))}<div className="text-xs text-zinc-500">{Number(s?.net ?? 0) < 0 ? t("Merchant owes Perkly") : t("Perkly pays merchant")}</div></Td>
            <Td className="text-end"><Link href={`/admin/merchants/${id}/statements/${month}`} className="text-sm font-semibold text-perk-purple hover:underline">{t("Open")} →</Link></Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
