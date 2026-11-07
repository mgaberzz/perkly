import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { Amount, Card, HBarList, LinkButton, PageHeader, Stat, Table, Td } from "@/components/ui";
import { ExportButtons } from "@/components/export-buttons";
import { egpShort, periodStart, short } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { AGE_LABEL } from "@/lib/tx-filters";
import { ComboChart, DonutChart, LineChart } from "@/components/charts";

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
  const [{ data, error }, { data: sum }, { data: seriesRows }] = await Promise.all([
    supabase.rpc("insights", { p_dimension: dim.key, p_days: days }),
    supabase.rpc("finance_summary", { p_days: days }),
    supabase.rpc("insights_series", { p_dimension: dim.key, p_days: days }),
  ]);
  type Pt = { day: string; key: string; transactions: number; gmv: number; commission: number };
  const pts = (seriesRows ?? []) as Pt[];
  const rows = (data ?? []) as Row[];
  const s = (sum ?? {}) as Summary;
  const label = (r: Row) => (dim.key === "age" ? t(AGE_LABEL[r.key] ?? r.label) : dim.key === "sector" ? t(r.label) : t(r.label));
  // Drill-down: the matching transactions, same period
  const drill = (r: Row) => `/admin/redemptions?${dim.param}=${encodeURIComponent(r.key)}&from=${from}`;
  const link = (k: string, d: number) => `/admin/insights?dim=${k}&days=${d}`;
  const total = rows.reduce((a, r) => a + Number(r.commission), 0);

  // ── Chart buckets: days (≤ 90 days) or weeks (longer periods) ──
  const weekly = days > 90;
  const bucketOf = (d: string) => {
    if (!weekly) return d;
    const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
    return x.toISOString().slice(0, 10);
  };
  const buckets: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(`${from}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + i);
    const b = bucketOf(d.toISOString().slice(0, 10));
    if (buckets[buckets.length - 1] !== b) buckets.push(b);
  }
  const bucketEnd = (b: string) => {
    if (!weekly) return b;
    const x = new Date(`${b}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + 6); return x.toISOString().slice(0, 10);
  };
  const fmt = (b: string) => `${b.slice(8)}/${b.slice(5, 7)}`;
  const byBucket = new Map<string, { gmv: number; rev: number; n: number }>();
  for (const p of pts) {
    const b = bucketOf(p.day); const v = byBucket.get(b) ?? { gmv: 0, rev: 0, n: 0 };
    v.gmv += Number(p.gmv); v.rev += Number(p.commission); v.n += Number(p.transactions); byBucket.set(b, v);
  }
  const trend = buckets.map((b) => {
    const v = byBucket.get(b) ?? { gmv: 0, rev: 0, n: 0 };
    return { label: fmt(b), bar: v.gmv, line: v.rev, href: `/admin/redemptions?from=${b}&to=${bucketEnd(b)}`,
      title: `${weekly ? t("Week of {date}", { date: fmt(b) }) : fmt(b)}\n${t("Total GMV")}: ${egpShort(v.gmv)}\n${t("Net revenue")}: ${egpShort(v.rev)}\n${t("{n} transactions", { n: v.n })}` };
  });
  const top5 = rows.slice(0, 5);
  const lines = top5.map((r) => ({
    label: label(r), href: drill(r),
    values: buckets.map((b) => pts.filter((p) => p.key === r.key && bucketOf(p.day) === b).reduce((a, p) => a + Number(p.commission), 0)),
  }));

  return (
    <>
      <PageHeader title={t("Insights")} subtitle={t("Profitability for the last {days} days. Click any row or bar to see its transactions.", { days })}
        actions={<>{[7, 30, 90, 365].map((d) => <LinkButton key={d} href={link(dim.key, d)} variant={d === days ? "primary" : "secondary"}>{d === 365 ? t("1y") : `${d}d`}</LinkButton>)}</>} />
      {error && <p className="mb-4 text-sm text-red-600">{error.message}</p>}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Link href={`/admin/explain?metric=gmv&days=${days}`}><Stat accent label={t("Total GMV")} value={<Amount v={s.gmv} />} hint={t("{n} transactions", { n: short(s.transactions) })} /></Link>
        <Link href={`/admin/explain?metric=net_revenue&days=${days}`}><Stat label={t("Net revenue")} value={<Amount v={s.net_revenue} />} hint={t("Perkly commission, excl. VAT")} /></Link>
        <Link href={`/admin/explain?metric=vat&days=${days}`}><Stat label={t("VAT on commission")} value={<Amount v={s.vat} />} /></Link>
        <Link href="/admin/explain?metric=paid_to_merchants"><Stat label={t("Paid to merchants")} value={<Amount v={s.paid_to_merchants} />} hint={t("All time")} /></Link>
        <Link href="/admin/explain?metric=to_be_paid"><Stat label={t("To be paid to merchants")} value={<Amount v={s.to_be_paid_to_merchants} />} hint={t("Open dues now")} /></Link>
      </div>

      <Card title={weekly ? t("Weekly trend: total GMV and net revenue") : t("Daily trend: total GMV and net revenue")} className="mb-6"
        actions={<span className="text-xs text-zinc-500">{t("Click a bar to see its transactions")}</span>}>
        <ComboChart days={trend} barLabel={t("Total GMV")} lineLabel={t("Net revenue")} empty={t("No data yet")} />
      </Card>

      <div className="mb-4 flex flex-wrap gap-2">
        {DIMS.map((d) => (
          <Link key={d.key} href={link(d.key, days)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${d.key === dim.key ? "bg-perk-ink text-white" : "bg-white ring-1 ring-zinc-200 hover:bg-zinc-50"}`}>
            {d.icon} {t(`By ${d.label.toLowerCase()}`)}
          </Link>
        ))}
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card title={t("Share of net revenue by {dim}", { dim: t(dim.label.toLowerCase()) })}>
          <DonutChart slices={rows.map((r) => ({ label: label(r), value: Number(r.commission), href: drill(r) }))} empty={t("No data yet")} otherLabel={t("Other")} />
        </Card>
        <Card title={t("Margin by {dim}", { dim: t(dim.label.toLowerCase()) })}>
          <HBarList data={rows.slice(0, 12).map((r) => ({ label: label(r), value: Number(r.margin_pct), href: drill(r) }))} format={(n) => `${Number(n.toFixed(1))}%`} empty={t("No data yet")} />
        </Card>
      </div>
      <Card title={t("Net revenue trend — top {n} by {dim}", { n: top5.length, dim: t(dim.label.toLowerCase()) })} className="mb-6">
        <LineChart labels={buckets.map(fmt)} series={lines} empty={t("No data yet")} />
      </Card>

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
