import { CardGrid, type CardItem } from "@/components/card-grid";
import { Icon } from "@/components/icons";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { Amount, BarChart, Card, HBarList, Notice, PageHeader, Stat } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { inScope } from "@/lib/auth";
import { applyTxFilters, txSelect, type TxFilters } from "@/lib/tx-filters";
import { daysBetween, PERIOD_LABEL, PERIODS, resolvePeriod } from "@/lib/periods";
import { CATEGORIES } from "@/lib/types";
import { getT } from "@/lib/i18n/server";
import { ROLE_LABEL } from "@/lib/labels";
import type { Balance } from "@/lib/types";

export const metadata = { title: "Overview" };

type Overview = {
  scope: "all" | "mine"; students: number; new_students: number; active_students: number; merchants: number; live_merchants: number;
  pending_merchants: number; pending_perks: number; pending_requests: number; redemptions: number; flagged_redemptions: number;
  discount_given: number; sales: number; est_commission: number;
  by_day: { day: string; count: number }[]; top_merchants: { id: string; name: string; count: number }[]; by_campus: { campus: string; students: number }[];
};

export default async function AdminOverview({ searchParams }: PageProps<"/admin">) {
  const { supabase, role, can, profile, merchantScope } = await requireStaff();
  const t = await getT();
  const sp = await searchParams;
  const g = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const { period, from, to } = resolvePeriod(g("period") || (g("from") ? "custom" : ""), g("from"), g("to"));
  // Filters (same rules as the Transactions page, so every number can be opened there)
  const f: TxFilters = { from, to };
  for (const k of ["merchant", "category", "city", "campus", "payment", "channel"] as const) if (g(k)) f[k] = g(k);

  // Period numbers come from the database (dashboard_stats). If that function isn't installed yet,
  // fall back to adding up the transactions here (fine up to ~30k per period).
  type Stats = { transactions: number; gmv: number; commission: number; students: number; active_merchants: number;
    by_day: { day: string; count: number }[]; top_merchants: { id: string; name: string; count: number }[] };
  const campusOk = f.campus && /^[0-9a-f-]{36}$/.test(f.campus) ? f.campus : null;
  const { data: dbStats, error: statsErr } = await supabase.rpc("dashboard_stats", {
    p_from: from, p_to: to, p_merchant_id: f.merchant || null, p_category: f.category || null, p_city: f.city || null,
    p_campus_id: campusOk, p_payment: f.payment || null,
  });
  let st = dbStats as Stats | null;
  if (statsErr || !st) {
    const select = txSelect("created_at, user_id, merchant_id, original_amount, commission_amount, status, merchant:merchants(name), branch:merchant_branches(city)", f);
    type Row = { created_at: string; user_id: string; merchant_id: string; original_amount: number | null; commission_amount: number | null; merchant: { name: string } | null };
    const rows: Row[] = [];
    for (let page = 0; page < 30; page++) {
      const { data: chunk } = await applyTxFilters(inScope(supabase.from("redemptions").select(select).neq("status", "reversed"), merchantScope), f)
        .order("created_at").range(page * 1000, page * 1000 + 999).returns<Row[]>();
      rows.push(...(chunk ?? []));
      if (!chunk || chunk.length < 1000) break;
    }
    const byDay = new Map<string, number>(), top = new Map<string, { name: string; count: number }>();
    for (const r of rows) {
      const d = new Date(r.created_at).toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
      const x = top.get(r.merchant_id) ?? { name: r.merchant?.name ?? "—", count: 0 }; x.count += 1; top.set(r.merchant_id, x);
    }
    st = {
      transactions: rows.length,
      gmv: rows.reduce((a2, r) => a2 + Number(r.original_amount ?? 0), 0),
      commission: rows.reduce((a2, r) => a2 + Number(r.commission_amount ?? 0), 0),
      students: new Set(rows.map((r) => r.user_id)).size,
      active_merchants: new Set(rows.map((r) => r.merchant_id)).size,
      by_day: [...byDay].map(([day, count]) => ({ day, count })),
      top_merchants: [...top].map(([id, m]) => ({ id, ...m })).sort((x, y) => y.count - x.count).slice(0, 5),
    };
  }
  const [{ data, error }, { data: bal }, { data: merchants }, { data: branches }, { data: campuses }] = await Promise.all([
    supabase.rpc("admin_overview", { p_days: 30 }),
    role === "finance" ? supabase.rpc("merchant_balances") : Promise.resolve({ data: null }),
    inScope(supabase.from("merchants").select("id, name").order("name").limit(1000), merchantScope, "id"),
    supabase.from("merchant_branches").select("city").not("city", "is", null).limit(2000),
    supabase.from("campuses").select("id, name, short_name").order("name"),
  ]);
  const o = (data ?? {}) as Overview;

  // Totals for the period
  const gmv = Number(st.gmv), commission = Number(st.commission), buyers = Number(st.students), activeMerchants = Number(st.active_merchants);
  const txCount = Number(st.transactions);
  const days = daysBetween(from, to);
  const monthly = days.length > 92;
  const bucket = (iso: string) => (monthly ? iso.slice(0, 7) : iso);
  const counts = new Map<string, number>();
  for (const d of st.by_day) { const k = bucket(String(d.day).slice(0, 10)); counts.set(k, (counts.get(k) ?? 0) + Number(d.count)); }
  const keys = [...new Set(days.map(bucket))];
  const series = keys.map((k) => ({ label: monthly ? k.slice(5) : k.slice(8), value: counts.get(k) ?? 0, href: `/admin/redemptions?${new URLSearchParams({ ...(f as Record<string, string>), from: monthly ? `${k}-01` : k, to: monthly ? days.filter((d) => d.startsWith(k)).at(-1)! : k })}` }));
  const topList = st.top_merchants.map((m) => [m.id, { name: m.name, n: Number(m.count) }] as const);
  const txLink = (extra: Record<string, string> = {}) => `/admin/redemptions?${new URLSearchParams({ ...(f as Record<string, string>), ...extra })}`;

  const first = profile.full_name?.split(" ")[0] ?? "";
  const subtitle = { admin: t("All of Perkly"), operations: t("All of Perkly"), account_manager: t("Your assigned merchants and campuses"), finance: t("Money & settlements") }[role];
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: from.slice(0, 4) === to.slice(0, 4) && d === from ? undefined : "numeric" });
  const range = from === to ? fmt(to) : `${fmt(from)} – ${fmt(to)}`;
  const cities = [...new Set((branches ?? []).map((b) => b.city as string))].sort();

  const alerts = (
    <div className="mb-6 flex flex-wrap gap-3">
      {sp.denied && <div className="w-full"><Notice tone="error">{t("Your role doesn't have access to that page.")}</Notice></div>}
      {o.pending_requests > 0 && <Link href="/admin/notifications" className="rounded-xl bg-perk-pink/10 px-4 py-2 text-sm font-semibold text-perk-pink"><Icon name="bell" size={14} className="me-1 inline-block align-[-2px]" />{t("{n} request(s) waiting", { n: o.pending_requests })}</Link>}
      {can("perks") && o.pending_perks > 0 && <Link href="/admin/perks?status=pending" className="rounded-xl bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">⏳ {t("{n} perk(s) to approve", { n: o.pending_perks })}</Link>}
      {can("redemptions_review") && o.flagged_redemptions > 0 && <Link href="/admin/redemptions?status=flagged" className="rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700"><Icon name="flag" size={14} className="me-1 inline-block align-[-2px]" />{t("{n} flagged transaction(s)", { n: o.flagged_redemptions })}</Link>}
      {can("merchants_edit") && o.pending_merchants > 0 && <Link href="/admin/merchants?status=pending" className="rounded-xl bg-perk-blue/10 px-4 py-2 text-sm font-semibold text-perk-blue"><Icon name="store" size={14} className="me-1 inline-block align-[-2px]" />{t("{n} merchant(s) not live yet", { n: o.pending_merchants })}</Link>}
    </div>
  );

  // One simple layout for every role: 4 key numbers, the chart, and the top merchants — all for the chosen period and filters
  const b = (bal ?? []) as Balance[];
  const sumB = (k: keyof Balance) => b.reduce((a, x) => a + Number(x[k] ?? 0), 0);
  const txf = f as Record<string, string>;
  const stats: CardItem[] = role === "finance" ? [
    { key: "g", title: t("Total GMV"), tx: txf, card: <Stat accent label={t("Total GMV")} value={<Amount v={gmv} />} hint={t("{n} transactions", { n: txCount })} /> },
    { key: "r", title: t("Net revenue"), tx: txf, card: <Stat label={t("Net revenue")} value={<Amount v={commission} />} hint={t("Perkly commission")} /> },
    { key: "n", title: t("Not yet in a settlement"), tx: { unsettled: "1" }, card: <Stat label={t("Net to settle")} value={<Amount v={sumB("net_to_settle")} />} hint={t("Right now, all time")} /> },
    { key: "o", href: "/admin/finance?tab=settlements", card: <Stat label={t("Open settlements")} value={<Amount v={sumB("pending_settlements")} />} hint={t("Right now, all time")} /> },
  ] : role === "account_manager" ? [
    { key: "t", title: t("Transactions"), tx: txf, card: <Stat accent label={t("Transactions")} value={txCount} hint={t("{n} students", { n: buyers })} /> },
    { key: "g", title: t("Total GMV"), tx: txf, card: <Stat label={t("Total GMV")} value={<Amount v={gmv} />} /> },
    { key: "m", href: "/admin/merchants", card: <Stat label={t("Active merchants")} value={`${activeMerchants} / ${o.merchants ?? 0}`} hint={t("with transactions / assigned")} /> },
    { key: "c", title: t("Net revenue"), tx: txf, card: <Stat label={t("Net revenue")} value={<Amount v={commission} />} hint={t("Perkly commission")} /> },
  ] : [
    { key: "g", title: t("Total GMV"), tx: txf, card: <Stat accent label={t("Total GMV")} value={<Amount v={gmv} />} hint={t("{n} transactions", { n: txCount })} /> },
    { key: "r", title: t("Net revenue"), tx: txf, card: <Stat label={t("Net revenue")} value={<Amount v={commission} />} hint={t("Perkly commission")} /> },
    { key: "s", title: t("Students"), tx: txf, card: <Stat label={t("Students")} value={buyers} hint={t("Used Perkly in this period")} /> },
    { key: "m", href: "/admin/merchants?status=live", card: <Stat label={t("Active merchants")} value={activeMerchants} hint={t("{n} live in total", { n: o.live_merchants ?? 0 })} /> },
  ];
  const roleName = role === "account_manager" ? t("Account manager") : t(ROLE_LABEL[role]);

  return (
    <>
      <PageHeader title={t("Hi {name}", { name: first })} subtitle={`${roleName} · ${subtitle} · ${t(PERIOD_LABEL[period])}: ${range}`} />
      <FilterBar path="/admin" fields={[
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
      {alerts}
      {role === "account_manager" && o.merchants === 0 && <div className="mb-6"><Notice>{t("No merchants are assigned to you yet. Ask an admin to assign them under Team & assignments.")}</Notice></div>}
      <CardGrid items={stats} className="grid grid-cols-2 gap-4 lg:grid-cols-4" />
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title={monthly ? t("Transactions per month") : t("Transactions per day")} className="lg:col-span-2"><BarChart data={series} empty={t("No data yet")} /></Card>
        <Card title={role === "account_manager" ? t("My merchants") : t("Top merchants")}>
          <HBarList data={topList.map(([id, m]) => ({ label: m.name, value: m.n, href: txLink({ merchant: id }) }))} empty={t("No data yet")} />
        </Card>
      </div>
      <p className="mt-6 text-sm text-zinc-500">
        {t("More detail:")} <Link href="/admin/insights" className="font-semibold text-perk-purple hover:underline">{t("Insights")}</Link>
        {can("finance") && <> · <Link href="/admin/finance" className="font-semibold text-perk-purple hover:underline">{t("Finance")}</Link></>}
      </p>
    </>
  );
}
