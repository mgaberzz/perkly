import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { Amount, BarChart, Card, HBarList, LinkButton, Notice, PageHeader, Stat } from "@/components/ui";
import { MoneySummary } from "@/components/money-summary";
import { ExportButtons } from "@/components/export-buttons";
import { egp, periodStart } from "@/lib/format";
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
  const { supabase, role, can, profile } = await requireStaff();
  const t = await getT();
  const sp = await searchParams;
  const days = Number(sp.days) || 30;
  const [{ data, error }, { data: bal }] = await Promise.all([
    supabase.rpc("admin_overview", { p_days: days }),
    role === "finance" ? supabase.rpc("merchant_balances") : Promise.resolve({ data: null }),
  ]);
  const o = (data ?? {}) as Overview;
  const now = new Date().getTime();
  const dayMap = new Map((o.by_day ?? []).map((d) => [d.day, d.count]));
  const n = Math.min(days, 30);
  const series = Array.from({ length: n }, (_, i) => {
    const d = new Date(now - (n - 1 - i) * 86400000).toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
    return { label: d.slice(8), value: dayMap.get(d) ?? 0 };
  });
  const first = profile.full_name?.split(" ")[0] ?? "";
  const subtitle = { admin: t("All of Perkly"), operations: t("All of Perkly"), account_manager: t("Your assigned merchants and campuses"), finance: t("Money & settlements") }[role];
  const periods = [7, 30, 90].map((d) => <LinkButton key={d} href={`/admin?days=${d}`} variant={d === days ? "primary" : "secondary"}>{d}d</LinkButton>);

  const alerts = (
    <div className="mb-6 flex flex-wrap gap-3">
      {sp.denied && <div className="w-full"><Notice tone="error">{t("Your role doesn't have access to that page.")}</Notice></div>}
      {o.pending_requests > 0 && <Link href="/admin/notifications" className="rounded-xl bg-perk-pink/10 px-4 py-2 text-sm font-semibold text-perk-pink">🔔 {t("{n} request(s) waiting", { n: o.pending_requests })}</Link>}
      {can("perks") && o.pending_perks > 0 && <Link href="/admin/perks?status=pending" className="rounded-xl bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">⏳ {t("{n} perk(s) to approve", { n: o.pending_perks })}</Link>}
      {can("redemptions_review") && o.flagged_redemptions > 0 && <Link href="/admin/redemptions?status=flagged" className="rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">🚩 {t("{n} flagged transaction(s)", { n: o.flagged_redemptions })}</Link>}
      {can("merchants_edit") && o.pending_merchants > 0 && <Link href="/admin/merchants?status=pending" className="rounded-xl bg-perk-blue/10 px-4 py-2 text-sm font-semibold text-perk-blue">🏪 {t("{n} merchant(s) not live yet", { n: o.pending_merchants })}</Link>}
    </div>
  );

  // ── Finance: money first ──
  if (role === "finance") {
    const b = (bal ?? []) as Balance[];
    const sum = (k: keyof Balance) => b.reduce((a, x) => a + Number(x[k] ?? 0), 0);
    return (
      <>
        <PageHeader title={t("Hi {name} 👋", { name: first })} subtitle={`${t("Finance")} · ${subtitle} · ${t("Last {days} days", { days })}`} actions={periods} />
        {alerts}
        <MoneySummary days={days} />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Link href="/admin/explain?metric=net_to_settle"><Stat label={t("Net to settle")} value={<Amount v={sum("net_to_settle")} />} hint={t("Not yet in a settlement")} /></Link>
          <Link href="/admin/explain?metric=open_settlements"><Stat label={t("Open settlements")} value={<Amount v={sum("pending_settlements")} />} /></Link>
          <Link href="/admin/explain?metric=paid_to_merchants"><Stat label={t("Paid to merchants")} value={<Amount v={sum("paid_out")} />} /></Link>
          <Link href="/admin/explain?metric=received_from_merchants"><Stat label={t("Received from merchants")} value={<Amount v={sum("received_from_merchant")} />} hint={t("Commission collected")} /></Link>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Card title={t("Transactions per day")} className="lg:col-span-2"><BarChart data={series} empty={t("No data yet")} /></Card>
          <Card title={t("This period")}>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-zinc-500">{t("Transactions")}</dt><dd className="font-semibold">{o.redemptions ?? 0}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">{t("Sales after discount")}</dt><dd className="font-semibold">{egp(o.sales)}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">{t("Discount given")}</dt><dd className="font-semibold">{egp(o.discount_given)}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">{t("Est. commission")}</dt><dd className="font-semibold">{egp(o.est_commission)}</dd></div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <LinkButton href="/admin/finance">{t("Settlements")}</LinkButton>
              <ExportButtons kind="transactions" />
            </div>
          </Card>
        </div>
      </>
    );
  }

  // ── Account manager: my merchants only ──
  if (role === "account_manager") {
    return (
      <>
        <PageHeader title={t("Hi {name} 👋", { name: first })} subtitle={`${t("Account manager")} · ${subtitle} · ${t("Last {days} days", { days })}`} actions={periods} />
        {error && <p className="mb-4 text-sm text-red-600">{error.message}</p>}
        {alerts}
        {o.merchants === 0 && <div className="mb-6"><Notice>{t("No merchants are assigned to you yet. Ask an admin to assign them under Team & assignments.")}</Notice></div>}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Link href={`/admin/redemptions?from=${periodStart(days)}`} className="block transition hover:-translate-y-0.5"><Stat accent label={t("Redemptions")} value={o.redemptions ?? 0} hint={t("{n} active students", { n: o.active_students ?? 0 })} /></Link>
          <Link href={`/admin/merchants`} className="block transition hover:-translate-y-0.5"><Stat label={t("My merchants")} value={`${o.live_merchants ?? 0} / ${o.merchants ?? 0}`} hint={t("live / assigned")} /></Link>
          <Link href={`/admin/redemptions`} className="block transition hover:-translate-y-0.5"><Stat label={t("My customers")} value={o.students ?? 0} hint={t("Students who used my merchants")} /></Link>
          <Link href={`/admin/explain?metric=gmv&days=${days}`} className="block transition hover:-translate-y-0.5"><Stat label={t("Sales after discount")} value={<Amount v={o.sales} />} hint={t("Discounts given {amount}", { amount: egp(o.discount_given) })} /></Link>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Card title={t("Redemptions per day")} className="lg:col-span-2"><BarChart data={series} empty={t("No data yet")} /></Card>
          <Card title={t("My merchants")} actions={<Link href="/admin/merchants" className="text-sm font-semibold text-perk-purple">{t("See all")}</Link>}>
            <HBarList data={(o.top_merchants ?? []).map((m) => ({ label: m.name, value: m.count, href: `/admin/redemptions?merchant=${m.id}` }))} empty={t("No redemptions yet")} />
          </Card>
          <Card title={t("My customers by campus")} className="lg:col-span-3"><HBarList data={(o.by_campus ?? []).map((c) => ({ label: c.campus, value: c.students }))} empty={t("No data yet")} /></Card>
        </div>
      </>
    );
  }

  // ── Admin & operations: all of Perkly ──
  return (
    <>
      <PageHeader title={t("Hi {name} 👋", { name: first })} subtitle={`${t(ROLE_LABEL[role])} · ${subtitle} · ${t("Last {days} days", { days })}`} actions={periods} />
      {error && <p className="mb-4 text-sm text-red-600">{error.message}</p>}
      {alerts}
      {role === "admin" && <MoneySummary days={days} />}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Link href={`/admin/redemptions?from=${periodStart(days)}`} className="block transition hover:-translate-y-0.5"><Stat accent label={t("Redemptions")} value={o.redemptions ?? 0} hint={t("{n} active students", { n: o.active_students ?? 0 })} /></Link>
        <Link href={`/admin/users?role=student`} className="block transition hover:-translate-y-0.5"><Stat label={t("Students")} value={o.students ?? 0} hint={t("+{n} new", { n: o.new_students ?? 0 })} /></Link>
        <Link href={`/admin/merchants?status=live`} className="block transition hover:-translate-y-0.5"><Stat label={t("Live merchants")} value={o.live_merchants ?? 0} /></Link>
        <Link href={`/admin/explain?metric=net_revenue&days=${days}`} className="block transition hover:-translate-y-0.5"><Stat label={t("Est. commission")} value={<Amount v={o.est_commission} />} hint={t("Discounts given {amount}", { amount: egp(o.discount_given) })} /></Link>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title={t("Redemptions per day")} className="lg:col-span-2"><BarChart data={series} empty={t("No data yet")} /></Card>
        <Card title={t("Top merchants")}><HBarList data={(o.top_merchants ?? []).map((m) => ({ label: m.name, value: m.count, href: `/admin/redemptions?merchant=${m.id}` }))} empty={t("No data yet")} /></Card>
        <Card title={t("Students by campus")} className="lg:col-span-3"><HBarList data={(o.by_campus ?? []).map((c) => ({ label: c.campus, value: c.students }))} empty={t("No data yet")} /></Card>
      </div>
    </>
  );
}
