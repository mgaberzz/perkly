import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { BarChart, Card, HBarList, LinkButton, PageHeader, Stat } from "@/components/ui";
import { egp } from "@/lib/format";

export const metadata = { title: "Overview" };

type Overview = {
  students: number; new_students: number; active_students: number; live_merchants: number; pending_merchants: number;
  pending_perks: number; redemptions: number; flagged_redemptions: number; discount_given: number; est_commission: number;
  by_day: { day: string; count: number }[]; top_merchants: { name: string; count: number }[]; by_campus: { campus: string; students: number }[];
};

export default async function AdminOverview({ searchParams }: PageProps<"/admin">) {
  const { supabase } = await requireAdmin();
  const days = Number((await searchParams).days) || 30;
  const { data, error } = await supabase.rpc("admin_overview", { p_days: days });
  const o = (data ?? {}) as Overview;
  const now = new Date().getTime();
  const dayMap = new Map((o.by_day ?? []).map((d) => [d.day, d.count]));
  const n = Math.min(days, 30);
  const series = Array.from({ length: n }, (_, i) => {
    const d = new Date(now - (n - 1 - i) * 86400000).toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
    return { label: d.slice(8), value: dayMap.get(d) ?? 0 };
  });

  return (
    <>
      <PageHeader title="Perkly overview" subtitle={`Last ${days} days`}
        actions={[7, 30, 90].map((d) => <LinkButton key={d} href={`/admin?days=${d}`} variant={d === days ? "primary" : "secondary"}>{d}d</LinkButton>)} />
      {error && <p className="mb-4 text-sm text-red-600">{error.message}</p>}
      {(o.pending_perks > 0 || o.flagged_redemptions > 0 || o.pending_merchants > 0) && (
        <div className="mb-6 flex flex-wrap gap-3">
          {o.pending_perks > 0 && <Link href="/admin/perks?status=pending" className="rounded-xl bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">⏳ {o.pending_perks} perk(s) to approve</Link>}
          {o.flagged_redemptions > 0 && <Link href="/admin/redemptions?status=flagged" className="rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">🚩 {o.flagged_redemptions} flagged redemption(s)</Link>}
          {o.pending_merchants > 0 && <Link href="/admin/merchants?status=pending" className="rounded-xl bg-perk-blue/10 px-4 py-2 text-sm font-semibold text-perk-blue">🏪 {o.pending_merchants} merchant(s) not live yet</Link>}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat accent label="Redemptions" value={o.redemptions ?? 0} hint={`${o.active_students ?? 0} active students`} />
        <Stat label="Students" value={o.students ?? 0} hint={`+${o.new_students ?? 0} new`} />
        <Stat label="Live merchants" value={o.live_merchants ?? 0} />
        <Stat label="Est. commission" value={egp(o.est_commission)} hint={`Discounts given ${egp(o.discount_given)}`} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Redemptions per day" className="lg:col-span-2"><BarChart data={series} /></Card>
        <Card title="Top merchants"><HBarList data={(o.top_merchants ?? []).map((m) => ({ label: m.name, value: m.count }))} /></Card>
        <Card title="Students by campus" className="lg:col-span-3"><HBarList data={(o.by_campus ?? []).map((c) => ({ label: c.campus, value: c.students }))} /></Card>
      </div>
    </>
  );
}
