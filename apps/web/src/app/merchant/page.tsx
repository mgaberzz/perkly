import { CardGrid } from "@/components/card-grid";
import Link from "next/link";
import { requireMerchantArea } from "@/lib/auth";
import { Amount, BarChart, Card, HBarList, PageHeader, Stat } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { daysBetween, PERIOD_LABEL, PERIODS, resolvePeriod } from "@/lib/periods";
import { ExportButtons } from "@/components/export-buttons";
import { egp } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { Balance } from "@/lib/types";
import { WeeklySummary } from "@/components/weekly-summary";
import { lastWeek, type WeekRow } from "@/lib/weekly";

export const metadata = { title: "Dashboard" };

type Stats = {
  redemptions: number; unique_students: number; new_students: number; recurring_students: number;
  new_customer_pct: number; recurring_customer_pct: number; returning_redemptions: number;
  discount_given: number; revenue_after_discount: number; avg_ticket: number; flagged: number;
  by_day: { day: string; count: number }[]; by_hour: { hour: number; count: number }[];
  by_branch: { branch_id: string; branch: string; count: number; revenue: number }[];
  by_cashier: { qr_id: string; cashier: string; branch: string; count: number; discount: number }[];
  by_perk: { perk: string; count: number; discount: number }[];
};

export default async function MerchantDashboard({ searchParams }: PageProps<"/merchant">) {
  const { supabase, merchant, branchScope, canSeeMoney } = await requireMerchantArea("dashboard");
  const t = await getT();
  const sp = await searchParams;
  const g = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  // Month to date by default, same periods as the Perkly team portal
  const { period, from, to } = resolvePeriod(g("period") || (g("from") ? "custom" : ""), g("from"), g("to"));
  const branch = branchScope?.id ?? (typeof sp.branch === "string" && sp.branch ? sp.branch : null);
  const qr = typeof sp.qr === "string" && sp.qr ? sp.qr : null;
  // Every number opens /merchant/explain with the same branch / cashier filters
  const filt = `&from=${from}&to=${to}${branch && !branchScope ? `&branch=${branch}` : ""}${qr ? `&qr=${qr}` : ""}`;

  const week = lastWeek();
  let weekQ = supabase.from("redemptions").select("user_id, original_amount, final_amount, discount_amount, first_time_at_merchant, created_at, perk:perks(title)")
    .eq("merchant_id", merchant.id).neq("status", "reversed").gte("created_at", week.prevFromISO).lt("created_at", week.toISO).limit(10000);
  if (branch) weekQ = weekQ.eq("branch_id", branch);
  const [{ data, error }, { data: branches }, { data: qrs }, { data: balance }, { data: weekRows }, { data: reviews }] = await Promise.all([
    supabase.rpc("merchant_stats", { p_merchant_id: merchant.id, p_branch_id: branch, p_qr_id: qr, p_from: from, p_to: to }),
    supabase.from("merchant_branches").select("id, name").eq("merchant_id", merchant.id).order("name"),
    supabase.from("branch_qr_codes").select("id, label, cashier_name, branch_id, branch:merchant_branches!inner(merchant_id)")
      .eq("branch.merchant_id", merchant.id).eq("status", "approved").order("created_at")
      .returns<{ id: string; label: string; cashier_name: string | null; branch_id: string }[]>(),
    canSeeMoney ? supabase.rpc("merchant_balances", { p_merchant_id: merchant.id }).maybeSingle<Balance>() : Promise.resolve({ data: null }),
    weekQ.returns<WeekRow[]>(),
    supabase.rpc("merchant_reviews", { p_merchant_id: merchant.id, p_limit: 500 }),
  ]);
  const weekReviews = ((reviews ?? []) as { stars: number; created_at: string; branch_id: string | null }[]).filter((r) => !branch || r.branch_id === branch);
  const s = (data ?? {}) as Stats;

  const dayMap = new Map((s.by_day ?? []).map((d) => [String(d.day).slice(0, 10), Number(d.count)]));
  const days = daysBetween(from, to);
  const monthly = days.length > 92;
  const bucket = (d: string) => (monthly ? d.slice(0, 7) : d);
  const counts = new Map<string, number>();
  for (const [d, c] of dayMap) counts.set(bucket(d), (counts.get(bucket(d)) ?? 0) + c);
  const series = [...new Set(days.map(bucket))].map((k) => {
    const f = monthly ? `${k}-01` : k, l = monthly ? days.filter((d) => d.startsWith(k)).at(-1)! : k;
    return { label: monthly ? k.slice(5) : k.slice(8), value: counts.get(k) ?? 0,
      href: `/merchant/explain?metric=transactions&from=${f}&to=${l}${branch && !branchScope ? `&branch=${branch}` : ""}${qr ? `&qr=${qr}` : ""}` };
  });
  const hours = Array.from({ length: 24 }, (_, h) => ({ label: String(h), value: s.by_hour?.find((x) => x.hour === h)?.count ?? 0 }));
  const peak = hours.reduce((a, b) => (b.value > a.value ? b : a), hours[0]);
  const mtx = { scope: "merchant", from, to, branch: branch ?? undefined, qr: qr ?? undefined };
  const tx = (extra = "") => `/merchant/explain?metric=transactions${filt}${extra}`;
  const visibleQrs = (qrs ?? []).filter((q) => !branch || q.branch_id === branch);
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: from.slice(0, 4) === to.slice(0, 4) && d === from ? undefined : "numeric" });
  const range = `${t(PERIOD_LABEL[period])}: ${from === to ? fmt(to) : `${fmt(from)} – ${fmt(to)}`}`;

  return (
    <>
      <PageHeader
        title={t("Hey {name}", { name: merchant.name })}
        subtitle={branchScope ? `${branchScope.name} · ${range}` : range}
        actions={<ExportButtons kind="transactions" params={{ scope: "merchant", from, to, branch: branch ?? undefined, qr: qr ?? undefined }} />}
      />
      {!qr && <WeeklySummary t={t} rows={weekRows ?? []} reviews={weekReviews} range={week} />}
      <FilterBar path="/merchant" fields={[
        { name: "period", label: t("Period"), type: "select", value: period === "mtd" ? "" : period, all: t("This month (MTD)"),
          options: PERIODS.filter((p) => p !== "mtd").map((p) => ({ value: p, label: t(PERIOD_LABEL[p]) })) },
        { name: "from", label: t("From (custom)"), type: "date", value: period === "custom" ? from : undefined },
        { name: "to", label: t("To (custom)"), type: "date", value: period === "custom" ? to : undefined },
        ...(branchScope ? [] : [{ name: "branch", label: t("Branch"), type: "select" as const, value: branch ?? undefined, all: t("All branches"), options: (branches ?? []).map((b) => ({ value: b.id, label: b.name })) }]),
        { name: "qr", label: t("Cashier"), type: "select", value: qr ?? undefined, all: t("All cashiers"), options: visibleQrs.map((q) => ({ value: q.id, label: q.cashier_name ?? q.label })) },
      ]} />
      {error && <p className="mb-4 text-sm text-red-600">{error.message}</p>}

      <CardGrid txPage="/merchant/redemptions" merchantColumn={false} className="grid grid-cols-2 gap-4 lg:grid-cols-4" items={[
        { key: "r", title: t("Redemptions"), tx: mtx, card: <Stat accent label={t("Redemptions")} value={s.redemptions ?? 0} hint={t("{n} flagged for review", { n: s.flagged ?? 0 })} /> },
        { key: "s", title: t("Unique students"), tx: mtx, card: <Stat label={t("Unique students")} value={s.unique_students ?? 0} hint={t("{a} new · {b} recurring", { a: s.new_students ?? 0, b: s.recurring_students ?? 0 })} /> },
        { key: "n", title: t("New customers"), tx: { ...mtx, customer: "new" }, card: <Stat label={t("New vs recurring customers")} value={`${s.new_customer_pct ?? 0}% / ${s.recurring_customer_pct ?? 0}%`} hint={t("Opens new customers")} /> },
        { key: "v", title: t("Revenue after discount"), tx: mtx, card: <Stat label={t("Revenue after discount")} value={<Amount v={s.revenue_after_discount} />} hint={t("Discount given {amount}", { amount: egp(s.discount_given) })} /> },
      ]} />

      {balance && (
        <Link href="/merchant/explain?metric=to_settle" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-perk-purple/30 bg-perk-purple/5 p-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-perk-purple">{t("To be settled to your bank account")}</div>
            <div className="text-2xl font-extrabold">{egp(Number(balance.net_to_settle) + Number(balance.pending_settlements))}</div>
            <div className="text-xs text-zinc-500">{t("All branches · in-app payments minus Perkly commission (negative = commission you owe Perkly)")}</div>
          </div>
          <span className="text-sm font-semibold text-perk-purple">{t("Payouts")} →</span>
        </Link>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title={t("Redemptions per day")} className="lg:col-span-2"><BarChart data={series} empty={t("No data yet")} /></Card>
        <Card title={t("Top perks")}><HBarList data={(s.by_perk ?? []).slice(0, 6).map((p) => ({ label: p.perk, value: p.count, href: tx(`&perk=${encodeURIComponent(p.perk)}`) }))} empty={t("No data yet")} /></Card>
        <Card title={t("Busiest hours (Cairo)")} className="lg:col-span-2" actions={peak.value ? <span className="text-sm text-zinc-500">{t("Peak")}: {peak.label}:00</span> : null}>
          <BarChart data={hours} empty={t("No data yet")} />
        </Card>
        <Card title={t("By cashier")}>
          <HBarList data={(s.by_cashier ?? []).map((c) => ({ label: branch ? c.cashier : `${c.cashier} · ${c.branch}`, value: c.count, href: `/merchant/explain?metric=transactions&from=${from}&to=${to}&qr=${c.qr_id}` }))} empty={t("No data yet")} />
        </Card>
        {!branchScope && (
          <Card title={t("By branch")} className="lg:col-span-3">
            <HBarList data={(s.by_branch ?? []).map((b) => ({ label: `${b.branch} · ${egp(b.revenue)}`, value: b.count, href: `/merchant/explain?metric=transactions&from=${from}&to=${to}&branch=${b.branch_id}` }))} empty={t("No data yet")} />
          </Card>
        )}
      </div>
      <p className="mt-6 text-sm text-zinc-500">{t("Average bill")}: <b>{egp(s.avg_ticket)}</b> · {t("“More redemptions = more youth visibility.”")}</p>
    </>
  );
}
