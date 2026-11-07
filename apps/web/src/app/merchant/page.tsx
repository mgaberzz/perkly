import { requireMerchant } from "@/lib/auth";
import { BarChart, Card, HBarList, LinkButton, PageHeader, Stat } from "@/components/ui";
import { egp } from "@/lib/format";

export const metadata = { title: "Dashboard" };

type Stats = {
  redemptions: number; unique_students: number; new_students: number; returning_redemptions: number;
  discount_given: number; revenue_after_discount: number; avg_ticket: number; flagged: number;
  by_day: { day: string; count: number }[]; by_hour: { hour: number; count: number }[];
  by_branch: { branch: string; count: number }[]; by_perk: { perk: string; count: number; discount: number }[];
};

export default async function MerchantDashboard({ searchParams }: PageProps<"/merchant">) {
  const { supabase, merchant } = await requireMerchant();
  const days = Number((await searchParams).days) || 30;
  const { data, error } = await supabase.rpc("merchant_stats", { p_merchant_id: merchant.id, p_days: days });
  const s = (data ?? {}) as Stats;

  const now = new Date().getTime();
  const dayMap = new Map((s.by_day ?? []).map((d) => [d.day, d.count]));
  const series = Array.from({ length: Math.min(days, 30) }, (_, i) => {
    const d = new Date(now - (Math.min(days, 30) - 1 - i) * 86400000).toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
    return { label: d.slice(8), value: dayMap.get(d) ?? 0 };
  });
  const hours = Array.from({ length: 24 }, (_, h) => ({ label: String(h), value: s.by_hour?.find((x) => x.hour === h)?.count ?? 0 }));
  const peak = hours.reduce((a, b) => (b.value > a.value ? b : a), hours[0]);
  const returningRate = s.redemptions ? Math.round((s.returning_redemptions / s.redemptions) * 100) : 0;

  return (
    <>
      <PageHeader
        title={`Hey ${merchant.name} 👋`}
        subtitle={`Your student traffic for the last ${days} days`}
        actions={[7, 30, 90].map((d) => (
          <LinkButton key={d} href={`/merchant?days=${d}`} variant={d === days ? "primary" : "secondary"}>{d}d</LinkButton>
        ))}
      />
      {error && <p className="mb-4 text-sm text-red-600">{error.message}</p>}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat accent label="Redemptions" value={s.redemptions ?? 0} hint={`${s.flagged ?? 0} flagged for review`} />
        <Stat label="Unique students" value={s.unique_students ?? 0} hint={`${s.new_students ?? 0} first-time visitors`} />
        <Stat label="Recurring customers" value={`${returningRate}%`} hint="of redemptions were repeat visits" />
        <Stat label="Revenue after discount" value={egp(s.revenue_after_discount)} hint={`Discount given ${egp(s.discount_given)}`} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Redemptions per day" className="lg:col-span-2"><BarChart data={series} /></Card>
        <Card title="Top perks"><HBarList data={(s.by_perk ?? []).slice(0, 6).map((p) => ({ label: p.perk, value: p.count }))} /></Card>
        <Card title="Busiest hours (Cairo)" className="lg:col-span-2" actions={peak.value ? <span className="text-sm text-zinc-500">Peak: {peak.label}:00</span> : null}>
          <BarChart data={hours} />
        </Card>
        <Card title="By branch"><HBarList data={(s.by_branch ?? []).map((b) => ({ label: b.branch, value: b.count }))} /></Card>
      </div>
      <p className="mt-6 text-sm text-zinc-500">Average bill: <b>{egp(s.avg_ticket)}</b> · “More redemptions = more youth visibility.” 💜</p>
    </>
  );
}
