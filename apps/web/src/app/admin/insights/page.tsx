import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { Amount, Card, HBarList, LinkButton, PageHeader, Stat, Table, Td } from "@/components/ui";
import { ExportButtons } from "@/components/export-buttons";
import { egpShort, periodStart, short } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { AGE_LABEL } from "@/lib/tx-filters";

export const metadata = { title: "Insights" };

type Row = { key: string; label: string; transactions: number; students: number; gmv: number; discount: number; paid: number;
  commission: number; vat: number; merchant_net: number; avg_ticket: number; margin_pct: number };
type Summary = { transactions: number; gmv: number; discount: number; paid: number; net_revenue: number; vat: number; merchant_net: number;
  paid_to_merchants: number; to_be_paid_to_merchants: number };

const DIMS = [
  { key: "sector", label: "Sector", icon: "🏷️", param: "category" },
  { key: "location", label: "Location", icon: "📍", param: "city" },
  { key: "campus", label: "Campus", icon: "🎓", param: "campus" },
  { key: "age", label: "Age range", icon: "🎂", param: "age" },
  { key: "merchant", label: "Merchant", icon: "🏪", param: "merchant" },
] as const;

export default async function InsightsPage({ searchParams }: PageProps<"/admin/insights">) {
  const { supabase } = await requireStaff("insights");
  const t = await getT();
  const sp = await searchParams;
  const dim = DIMS.find((d) => d.key === sp.dim) ?? DIMS[0];
  const days = Number(sp.days) || 30;
  const from = periodStart(days);
  const [{ data, error }, { data: sum }] = await Promise.all([
    supabase.rpc("insights", { p_dimension: dim.key, p_days: days }),
    supabase.rpc("finance_summary", { p_days: days }),
  ]);
  const rows = (data ?? []) as Row[];
  const s = (sum ?? {}) as Summary;
  const label = (r: Row) => (dim.key === "age" ? t(AGE_LABEL[r.key] ?? r.label) : dim.key === "sector" ? t(r.label) : t(r.label));
  // Drill-down: the matching transactions, same period
  const drill = (r: Row) => `/admin/redemptions?${dim.param}=${encodeURIComponent(r.key)}&from=${from}`;
  const link = (k: string, d: number) => `/admin/insights?dim=${k}&days=${d}`;
  const total = rows.reduce((a, r) => a + Number(r.commission), 0);

  return (
    <>
      <PageHeader title={t("Insights")} subtitle={t("Profitability for the last {days} days. Click any row or bar to see its transactions.", { days })}
        actions={<>{[7, 30, 90, 365].map((d) => <LinkButton key={d} href={link(dim.key, d)} variant={d === days ? "primary" : "secondary"}>{d === 365 ? t("1y") : `${d}d`}</LinkButton>)}</>} />
      {error && <p className="mb-4 text-sm text-red-600">{error.message}</p>}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Link href={`/admin/redemptions?from=${from}`}><Stat accent label={t("Total GMV")} value={<Amount v={s.gmv} />} hint={t("{n} transactions", { n: short(s.transactions) })} /></Link>
        <Link href={`/admin/redemptions?from=${from}`}><Stat label={t("Net revenue")} value={<Amount v={s.net_revenue} />} hint={t("Perkly commission, excl. VAT")} /></Link>
        <Stat label={t("VAT on commission")} value={<Amount v={s.vat} />} />
        <Link href="/admin/finance"><Stat label={t("Paid to merchants")} value={<Amount v={s.paid_to_merchants} />} hint={t("All time")} /></Link>
        <Link href="/admin/finance"><Stat label={t("To be paid to merchants")} value={<Amount v={s.to_be_paid_to_merchants} />} hint={t("Open dues now")} /></Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {DIMS.map((d) => (
          <Link key={d.key} href={link(d.key, days)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${d.key === dim.key ? "bg-perk-ink text-white" : "bg-white ring-1 ring-zinc-200 hover:bg-zinc-50"}`}>
            {d.icon} {t(`By ${d.label.toLowerCase()}`)}
          </Link>
        ))}
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card title={t("Net revenue by {dim}", { dim: t(dim.label.toLowerCase()) })}>
          <HBarList data={rows.slice(0, 12).map((r) => ({ label: label(r), value: Number(r.commission), href: drill(r) }))} format={egpShort} empty={t("No data yet")} />
        </Card>
        <Card title={t("Total GMV by {dim}", { dim: t(dim.label.toLowerCase()) })}>
          <HBarList data={[...rows].sort((a, b) => b.gmv - a.gmv).slice(0, 12).map((r) => ({ label: label(r), value: Number(r.gmv), href: drill(r) }))} format={egpShort} empty={t("No data yet")} />
        </Card>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">{t("Details by {dim}", { dim: t(dim.label.toLowerCase()) })}</h2>
        <ExportButtons kind="transactions" params={{ from }} />
      </div>
      <Table head={[t(dim.label), t("Transactions"), t("Students"), t("Total GMV"), t("Paid after discount"), t("Net revenue"), t("VAT"), t("Margin"), t("Share of revenue"), t("Avg. GMV")]} empty={t("No data yet")}>
        {rows.map((r) => (
          <tr key={r.key} className="hover:bg-zinc-50">
            <Td>
              <Link href={drill(r)} className="font-semibold hover:text-perk-purple hover:underline">{label(r)}</Link>
              {dim.key === "merchant" && <Link href={`/admin/merchants/${r.key}`} className="ms-2 text-xs text-zinc-500 hover:underline">{t("profile")} →</Link>}
            </Td>
            <Td><Link href={drill(r)} className="hover:underline">{short(r.transactions)}</Link></Td>
            <Td>{short(r.students)}</Td>
            <Td><Amount v={r.gmv} /></Td>
            <Td><Amount v={r.paid} /></Td>
            <Td className="font-semibold text-perk-purple"><Amount v={r.commission} /></Td>
            <Td><Amount v={r.vat} /></Td>
            <Td>{r.margin_pct}%</Td>
            <Td>{total ? `${Math.round((100 * Number(r.commission)) / total)}%` : "—"}</Td>
            <Td><Amount v={r.avg_ticket} /></Td>
          </tr>
        ))}
      </Table>
      <p className="mt-3 text-xs text-zinc-500">{t("Net revenue = Perkly commission (excluding VAT, which is passed on to the tax authority). Margin = commission ÷ amount paid. Location uses the branch city; Campus uses the branch's nearest campus; Age range uses the student's date of birth.")}</p>
    </>
  );
}
