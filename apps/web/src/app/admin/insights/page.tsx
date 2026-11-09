import Link from "next/link";
import { Icon } from "@/components/icons";
import { requireStaff, inScope } from "@/lib/auth";
import { Amount, Card, HBarList, PageHeader, Table, Td } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { ExportMenu } from "@/components/export-menu";
import { egpShort, short } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { AGE_LABEL } from "@/lib/tx-filters";
import { daysBetween, PERIOD_LABEL, PERIODS, resolvePeriod } from "@/lib/periods";
import { CATEGORIES } from "@/lib/types";
import { ComboChart, DonutChart, LineChart } from "@/components/charts";

export const metadata = { title: "Insights" };

type Row = { key: string; label: string; transactions: number; students: number; gmv: number; discount: number; paid: number;
  commission: number; vat: number; merchant_net: number; avg_ticket: number; margin_pct: number };
type Summary = { transactions: number; gmv: number; discount: number; paid: number; net_revenue: number; vat: number; students: number;
  new_students: number; active_merchants: number; avg_ticket: number; partner_cuts: number;
  prev: { transactions: number; gmv: number; net_revenue: number; students: number; active_merchants: number; avg_ticket: number } };
type Pt = { day: string; key: string; transactions: number; gmv: number; commission: number };

const DIMS = [
  { key: "sector", label: "Sector", icon: "tag", param: "category" },
  { key: "merchant", label: "Merchant", icon: "store", param: "merchant" },
  { key: "campus", label: "Campus", icon: "school", param: "campus" },
  { key: "location", label: "Location", icon: "pin", param: "city" },
  { key: "age", label: "Age range", icon: "cake", param: "age" },
] as const;

/** Change vs the previous period of the same length */
function Delta({ now, before, t }: { now: number; before: number; t: (s: string, v?: Record<string, string | number>) => string }) {
  if (!before && !now) return <span className="text-zinc-400">—</span>;
  if (!before) return <span className="font-semibold text-emerald-600">{t("new")}</span>;
  const pct = Math.round(((now - before) / before) * 100);
  const cls = pct > 0 ? "text-emerald-600" : pct < 0 ? "text-red-600" : "text-zinc-500";
  return <span className={`font-semibold ${cls}`}>{pct > 0 ? "▲" : pct < 0 ? "▼" : ""} {Math.abs(pct)}%</span>;
}

export default async function InsightsPage({ searchParams }: PageProps<"/admin/insights">) {
  const { supabase, merchantScope } = await requireStaff("insights");
  const t = await getT();
  const sp = await searchParams;
  const g = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const dim = DIMS.find((d) => d.key === g("dim")) ?? DIMS[0];
  const { period, from, to } = resolvePeriod(g("period") || (g("from") ? "custom" : ""), g("from"), g("to"));
  const f = { merchant: g("merchant"), category: g("category"), city: g("city"), campus: /^[0-9a-f-]{36}$/.test(g("campus")) ? g("campus") : "", payment: g("payment") };
  const args = { p_from: from, p_to: to, p_merchant_id: f.merchant || null, p_category: f.category || null, p_city: f.city || null, p_campus_id: f.campus || null, p_payment: f.payment || null };

  const [{ data: sum, error }, { data: dimRows }, { data: series }, { data: merchants }, { data: branches }, { data: campuses }] = await Promise.all([
    supabase.rpc("insights_range_summary", args),
    supabase.rpc("insights_range", { p_dimension: dim.key, ...args }),
    supabase.rpc("insights_range_series", { p_dimension: dim.key, ...args }),
    inScope(supabase.from("merchants").select("id, name").order("name").limit(1000), merchantScope, "id"),
    supabase.from("merchant_branches").select("city").not("city", "is", null).limit(2000),
    supabase.from("campuses").select("id, name, short_name").order("name"),
  ]);
  const s = (sum ?? { prev: {} }) as Summary;
  const rows = (dimRows ?? []) as Row[];
  const pts = (series ?? []) as Pt[];
  const cities = [...new Set((branches ?? []).map((b) => b.city as string))].sort();
  const label = (r: Row) => (dim.key === "age" ? t(AGE_LABEL[r.key] ?? r.label) : t(r.label));
  const keep = Object.fromEntries(Object.entries({ ...f, period: period === "mtd" ? "" : period, from: period === "custom" ? from : "", to: period === "custom" ? to : "" }).filter(([, v]) => v));
  const qs = (over: Record<string, string>) => new URLSearchParams({ ...keep, ...over }).toString();
  const txFilters = Object.fromEntries(Object.entries({ ...f, from, to }).filter(([, v]) => v));
  const drill = (r: Row) => `/admin/redemptions?${new URLSearchParams({ ...txFilters, [dim.param]: r.key })}`;
  const total = rows.reduce((a, r) => a + Number(r.commission), 0);

  // ── Trend: daily up to ~3 months, weekly beyond ──
  const allDays = daysBetween(from, to);
  const weekly = allDays.length > 92;
  const bucketOf = (d: string) => {
    if (!weekly) return d;
    const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10);
  };
  const buckets: string[] = [];
  for (const d of allDays) { const b = bucketOf(d); if (buckets[buckets.length - 1] !== b) buckets.push(b); }
  const bucketEnd = (b: string) => { if (!weekly) return b; const x = new Date(`${b}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + 6); const e = x.toISOString().slice(0, 10); return e > to ? to : e; };
  const fmt = (b: string) => `${b.slice(8)}/${b.slice(5, 7)}`;
  const byBucket = new Map<string, { gmv: number; rev: number; n: number }>();
  for (const p of pts) { const b = bucketOf(p.day); const v = byBucket.get(b) ?? { gmv: 0, rev: 0, n: 0 }; v.gmv += Number(p.gmv); v.rev += Number(p.commission); v.n += Number(p.transactions); byBucket.set(b, v); }
  const trend = buckets.map((b) => {
    const v = byBucket.get(b) ?? { gmv: 0, rev: 0, n: 0 };
    return { label: fmt(b), bar: v.gmv, line: v.rev, href: `/admin/redemptions?${new URLSearchParams({ ...txFilters, from: b < from ? from : b, to: bucketEnd(b) })}`,
      title: `${weekly ? t("Week of {date}", { date: fmt(b) }) : fmt(b)}\n${t("Total GMV")}: ${egpShort(v.gmv)}\n${t("Net revenue")}: ${egpShort(v.rev)}\n${t("{n} transactions", { n: v.n })}` };
  });
  const top5 = rows.slice(0, 5);
  const lines = top5.map((r) => ({ label: label(r), href: drill(r),
    values: buckets.map((b) => pts.filter((p) => p.key === r.key && bucketOf(p.day) === b).reduce((a, p) => a + Number(p.commission), 0)) }));

  const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const range = from === to ? fmtDate(to) : `${fmtDate(from)} – ${fmtDate(to)}`;
  const kpis: { label: string; value: React.ReactNode; now: number; before: number; href?: string; strong?: boolean; hint?: string }[] = [
    { label: t("Total GMV"), value: <Amount v={s.gmv} />, now: Number(s.gmv), before: Number(s.prev?.gmv), href: `/admin/redemptions?${new URLSearchParams(txFilters)}`, strong: true },
    { label: t("Net revenue"), value: <Amount v={s.net_revenue} />, now: Number(s.net_revenue), before: Number(s.prev?.net_revenue), hint: t("Excl. VAT {vat}", { vat: short(s.vat) }), href: `/admin/insights?${qs({ dim: "merchant" })}#details` },
    { label: t("Transactions"), value: short(s.transactions), now: Number(s.transactions), before: Number(s.prev?.transactions), href: `/admin/redemptions?${new URLSearchParams(txFilters)}` },
    { label: t("Students"), value: short(s.students), now: Number(s.students), before: Number(s.prev?.students), hint: t("{n} new", { n: short(s.new_students) }), href: `/admin/insights?${qs({ dim: "campus" })}#details` },
    { label: t("Avg. GMV per transaction"), value: <Amount v={s.avg_ticket} />, now: Number(s.avg_ticket), before: Number(s.prev?.avg_ticket), href: `/admin/insights?${qs({ dim: "sector" })}#details` },
    { label: t("Active merchants"), value: short(s.active_merchants), now: Number(s.active_merchants), before: Number(s.prev?.active_merchants), href: `/admin/insights?${qs({ dim: "merchant" })}#details` },
  ];

  return (
    <>
      <PageHeader title={t("Insights")} subtitle={`${t(PERIOD_LABEL[period])} · ${range}`}
        actions={<ExportMenu items={[{ label: t("Transactions"), kind: "transactions", params: txFilters }]} />} />

      <FilterBar path="/admin/insights" keep={{ dim: dim.key }} fields={[
        { name: "period", label: t("Period"), type: "select", value: period === "mtd" ? "" : period, all: t("This month (MTD)"),
          options: PERIODS.filter((p) => p !== "mtd").map((p) => ({ value: p, label: t(PERIOD_LABEL[p]) })) },
        { name: "from", label: t("From (custom)"), type: "date", value: period === "custom" ? from : undefined },
        { name: "to", label: t("To (custom)"), type: "date", value: period === "custom" ? to : undefined },
        { name: "merchant", label: t("Merchant"), type: "select", value: f.merchant, all: t("All merchants"), options: (merchants ?? []).map((m) => ({ value: m.id, label: m.name })) },
        { name: "category", label: t("Sector"), type: "select", value: f.category, all: t("All sectors"), options: CATEGORIES.map((c) => ({ value: c, label: t(c) })) },
        { name: "city", label: t("Location"), type: "select", value: f.city, all: t("All locations"), options: [...cities.map((c) => ({ value: c, label: c })), { value: "online", label: t("Online") }] },
        { name: "campus", label: t("Campus"), type: "select", value: f.campus, all: t("All campuses"), options: (campuses ?? []).map((c) => ({ value: c.id, label: c.short_name ?? c.name })) },
        { name: "payment", label: t("Payment"), type: "select", value: f.payment, all: t("All payments"), options: [{ value: "merchant", label: t("Paid at cashier") }, { value: "in_app", label: t("Paid in app") }] },
      ]} />
      {error && <p className="mb-4 text-sm text-red-600">{error.message}</p>}

      {/* Headline numbers with change vs the previous period of the same length */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => {
          const body = (
            <div className={`h-full rounded-2xl border p-4 shadow-sm ${k.strong ? "perk-gradient border-transparent text-white" : "border-zinc-200 bg-white"}`}>
              <div className={`text-xs font-semibold uppercase tracking-wide ${k.strong ? "text-white/80" : "text-zinc-500"}`}>{k.label}</div>
              <div className="mt-1 truncate text-xl font-extrabold">{k.value}</div>
              <div className={`mt-1 flex flex-wrap gap-x-2 text-xs ${k.strong ? "text-white/90 [&_span]:!text-white" : "text-zinc-500"}`}>
                <Delta now={k.now} before={k.before} t={t} /><span className={k.strong ? "text-white/80" : "text-zinc-400"}>{t("vs previous")}</span>
              </div>
              {k.hint && <div className={`mt-0.5 text-xs ${k.strong ? "text-white/80" : "text-zinc-500"}`}>{k.hint}</div>}
            </div>
          );
          return k.href ? <Link key={k.label} href={k.href} className="block min-w-0 transition hover:-translate-y-0.5">{body}</Link> : <div key={k.label} className="min-w-0">{body}</div>;
        })}
      </div>

      <Card title={weekly ? t("Weekly trend: total GMV and net revenue") : t("Daily trend: total GMV and net revenue")} className="mb-6"
        actions={<span className="hidden text-xs text-zinc-500 sm:inline">{t("Click a bar to see its transactions")}</span>}>
        <ComboChart days={trend} barLabel={t("Total GMV")} lineLabel={t("Net revenue")} empty={t("No data yet")} />
      </Card>

      {/* Breakdown tabs: scroll sideways on phones */}
      <div className="-mx-4 mb-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="flex w-max gap-2">
          {DIMS.map((d) => (
            <Link key={d.key} href={`/admin/insights?${qs({ dim: d.key })}`}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${d.key === dim.key ? "bg-perk-ink text-white" : "bg-white ring-1 ring-zinc-200 hover:bg-zinc-50"}`}>
              <Icon name={d.icon} size={14} className="me-1 inline-block align-[-2px]" />{t(`By ${d.label.toLowerCase()}`)}
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-6 grid min-w-0 gap-6 lg:grid-cols-2">
        <Card title={t("Share of net revenue by {dim}", { dim: t(dim.label.toLowerCase()) })} className="min-w-0">
          <DonutChart slices={rows.map((r) => ({ label: label(r), value: Number(r.commission), href: drill(r) }))} empty={t("No data yet")} otherLabel={t("Other")} />
        </Card>
        <Card title={t("Total GMV by {dim}", { dim: t(dim.label.toLowerCase()) })} className="min-w-0">
          <HBarList data={[...rows].sort((a, b) => b.gmv - a.gmv).slice(0, 8).map((r) => ({ label: label(r), value: Number(r.gmv), href: drill(r) }))} format={egpShort} empty={t("No data yet")} />
        </Card>
      </div>
      {top5.length > 1 && (
        <Card title={t("Net revenue trend — top {n} by {dim}", { n: top5.length, dim: t(dim.label.toLowerCase()) })} className="mb-6 min-w-0">
          <LineChart labels={buckets.map(fmt)} series={lines} empty={t("No data yet")} />
        </Card>
      )}

      <h2 id="details" className="mb-3 scroll-mt-20 font-bold">{t("Details by {dim}", { dim: t(dim.label.toLowerCase()) })}</h2>
      <Table head={[t(dim.label), t("Transactions"), t("Students"), t("Total GMV"), t("Net revenue"), t("Margin"), t("Share of revenue"), t("Avg. GMV")]} empty={t("No data yet")}>
        {rows.map((r) => (
          <tr key={r.key} className="hover:bg-zinc-50">
            <Td>
              <Link href={drill(r)} className="font-semibold hover:text-perk-purple hover:underline">{label(r)}</Link>
              {dim.key === "merchant" && <Link href={`/admin/merchants/${r.key}`} className="ms-2 text-xs text-zinc-500 hover:underline">{t("profile")} →</Link>}
            </Td>
            <Td><Link href={drill(r)} className="hover:underline">{short(r.transactions)}</Link></Td>
            <Td>{short(r.students)}</Td>
            <Td><Amount v={r.gmv} /></Td>
            <Td phone="sum" className="font-semibold text-perk-purple"><Amount v={r.commission} /></Td>
            <Td>{r.margin_pct}%</Td>
            <Td phone="sum">{total ? `${Math.round((100 * Number(r.commission)) / total)}%` : "—"}</Td>
            <Td><Amount v={r.avg_ticket} /></Td>
          </tr>
        ))}
      </Table>
      <p className="mt-3 text-xs text-zinc-500">{t("Net revenue = Perkly commission (excluding VAT, which is passed on to the tax authority). Margin = commission ÷ amount paid. Location uses the branch city; Campus uses the branch's nearest campus; Age range uses the student's date of birth.")}</p>
    </>
  );
}
