import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { BarChart, Card, HBarList, LinkButton, Notice, PageHeader, Stat } from "@/components/ui";
import { egp } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { ROLE_LABEL } from "@/lib/labels";

export const metadata = { title: "Overview" };

type Overview = {
  students: number; new_students: number; active_students: number; live_merchants: number; pending_merchants: number;
  pending_perks: number; pending_requests: number; redemptions: number; flagged_redemptions: number; discount_given: number; est_commission: number;
  by_day: { day: string; count: number }[]; top_merchants: { name: string; count: number }[]; by_campus: { campus: string; students: number }[];
};

export default async function AdminOverview({ searchParams }: PageProps<"/admin">) {
  const { supabase, role, can, profile } = await requireStaff();
  const t = await getT();
  const sp = await searchParams;
  const days = Number(sp.days) || 30;
  const { data, error } = await supabase.rpc("admin_overview", { p_days: days });
  const o = (data ?? {}) as Overview;
  const now = new Date().getTime();
  const dayMap = new Map((o.by_day ?? []).map((d) => [d.day, d.count]));
  const n = Math.min(days, 30);
  const series = Array.from({ length: n }, (_, i) => {
    const d = new Date(now - (n - 1 - i) * 86400000).toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
    return { label: d.slice(8), value: dayMap.get(d) ?? 0 };
  });
  const scope = role === "account_manager" ? t("Your assigned merchants and campuses") : t("All of Perkly");

  return (
    <>
      <PageHeader title={t("Hi {name} 👋", { name: profile.full_name?.split(" ")[0] ?? "" })}
        subtitle={`${t(ROLE_LABEL[role])} · ${scope} · ${t("Last {days} days", { days })}`}
        actions={[7, 30, 90].map((d) => <LinkButton key={d} href={`/admin?days=${d}`} variant={d === days ? "primary" : "secondary"}>{d}d</LinkButton>)} />
      {sp.denied && <div className="mb-4"><Notice tone="error">{t("Your role doesn't have access to that page.")}</Notice></div>}
      {error && <p className="mb-4 text-sm text-red-600">{error.message}</p>}
      <div className="mb-6 flex flex-wrap gap-3">
        {o.pending_requests > 0 && <Link href="/admin/notifications" className="rounded-xl bg-perk-pink/10 px-4 py-2 text-sm font-semibold text-perk-pink">🔔 {t("{n} request(s) waiting", { n: o.pending_requests })}</Link>}
        {can("perks") && o.pending_perks > 0 && <Link href="/admin/perks?status=pending" className="rounded-xl bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">⏳ {t("{n} perk(s) to approve", { n: o.pending_perks })}</Link>}
        {can("redemptions_review") && o.flagged_redemptions > 0 && <Link href="/admin/redemptions?status=flagged" className="rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">🚩 {t("{n} flagged transaction(s)", { n: o.flagged_redemptions })}</Link>}
        {o.pending_merchants > 0 && <Link href="/admin/merchants?status=pending" className="rounded-xl bg-perk-blue/10 px-4 py-2 text-sm font-semibold text-perk-blue">🏪 {t("{n} merchant(s) not live yet", { n: o.pending_merchants })}</Link>}
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat accent label={t("Redemptions")} value={o.redemptions ?? 0} hint={t("{n} active students", { n: o.active_students ?? 0 })} />
        <Stat label={t("Students")} value={o.students ?? 0} hint={t("+{n} new", { n: o.new_students ?? 0 })} />
        <Stat label={t("Live merchants")} value={o.live_merchants ?? 0} />
        <Stat label={t("Est. commission")} value={egp(o.est_commission)} hint={t("Discounts given {amount}", { amount: egp(o.discount_given) })} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title={t("Redemptions per day")} className="lg:col-span-2"><BarChart data={series} empty={t("No data yet")} /></Card>
        <Card title={t("Top merchants")}><HBarList data={(o.top_merchants ?? []).map((m) => ({ label: m.name, value: m.count }))} empty={t("No data yet")} /></Card>
        <Card title={t("Students by campus")} className="lg:col-span-3"><HBarList data={(o.by_campus ?? []).map((c) => ({ label: c.campus, value: c.students }))} empty={t("No data yet")} /></Card>
      </div>
    </>
  );
}
