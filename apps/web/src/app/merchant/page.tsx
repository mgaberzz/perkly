import Link from "next/link";
import { requireMerchant } from "@/lib/auth";
import { BarChart, Button, Card, HBarList, LinkButton, PageHeader, Select, Stat } from "@/components/ui";
import { ExportButtons } from "@/components/export-buttons";
import { egp } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { Balance } from "@/lib/types";

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
  const { supabase, merchant, branchScope, canSeeMoney } = await requireMerchant();
  const t = await getT();
  const sp = await searchParams;
  const days = Number(sp.days) || 30;
  const branch = branchScope?.id ?? (typeof sp.branch === "string" && sp.branch ? sp.branch : null);
  const qr = typeof sp.qr === "string" && sp.qr ? sp.qr : null;

  const [{ data, error }, { data: branches }, { data: qrs }, { data: balance }] = await Promise.all([
    supabase.rpc("merchant_stats", { p_merchant_id: merchant.id, p_days: days, p_branch_id: branch, p_qr_id: qr }),
    supabase.from("merchant_branches").select("id, name").eq("merchant_id", merchant.id).order("name"),
    supabase.from("branch_qr_codes").select("id, label, cashier_name, branch_id, branch:merchant_branches!inner(merchant_id)")
      .eq("branch.merchant_id", merchant.id).eq("status", "approved").order("created_at")
      .returns<{ id: string; label: string; cashier_name: string | null; branch_id: string }[]>(),
    canSeeMoney ? supabase.rpc("merchant_balances", { p_merchant_id: merchant.id }).maybeSingle<Balance>() : Promise.resolve({ data: null }),
  ]);
  const s = (data ?? {}) as Stats;

  const now = new Date().getTime();
  const dayMap = new Map((s.by_day ?? []).map((d) => [d.day, d.count]));
  const n = Math.min(days, 30);
  const series = Array.from({ length: n }, (_, i) => {
    const d = new Date(now - (n - 1 - i) * 86400000).toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
    return { label: d.slice(8), value: dayMap.get(d) ?? 0 };
  });
  const hours = Array.from({ length: 24 }, (_, h) => ({ label: String(h), value: s.by_hour?.find((x) => x.hour === h)?.count ?? 0 }));
  const peak = hours.reduce((a, b) => (b.value > a.value ? b : a), hours[0]);
  const link = (d: number) => `/merchant?days=${d}${branch && !branchScope ? `&branch=${branch}` : ""}${qr ? `&qr=${qr}` : ""}`;
  const visibleQrs = (qrs ?? []).filter((q) => !branch || q.branch_id === branch);

  return (
    <>
      <PageHeader
        title={t("Hey {name} 👋", { name: merchant.name })}
        subtitle={branchScope ? t("{branch} · last {days} days", { branch: branchScope.name, days }) : t("Your student traffic for the last {days} days", { days })}
        actions={<>{[7, 30, 90].map((d) => <LinkButton key={d} href={link(d)} variant={d === days ? "primary" : "secondary"}>{d}d</LinkButton>)}</>}
      />
      <form className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-3">
        <input type="hidden" name="days" value={days} />
        {!branchScope && (
          <Select name="branch" defaultValue={branch ?? ""} className="w-48">
            <option value="">{t("All branches")}</option>
            {(branches ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        )}
        <Select name="qr" defaultValue={qr ?? ""} className="w-48">
          <option value="">{t("All cashiers")}</option>
          {visibleQrs.map((q) => <option key={q.id} value={q.id}>{q.cashier_name ?? q.label}</option>)}
        </Select>
        <Button variant="secondary">{t("Apply")}</Button>
        <div className="ms-auto"><ExportButtons kind="transactions" params={{ scope: "merchant", branch: branch ?? undefined, qr: qr ?? undefined }} /></div>
      </form>
      {error && <p className="mb-4 text-sm text-red-600">{error.message}</p>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat accent label={t("Redemptions")} value={s.redemptions ?? 0} hint={t("{n} flagged for review", { n: s.flagged ?? 0 })} />
        <Stat label={t("Unique students")} value={s.unique_students ?? 0} hint={t("{a} new · {b} recurring", { a: s.new_students ?? 0, b: s.recurring_students ?? 0 })} />
        <Stat label={t("New vs recurring customers")} value={`${s.new_customer_pct ?? 0}% / ${s.recurring_customer_pct ?? 0}%`} hint={t("Share of unique students in this period")} />
        <Stat label={t("Revenue after discount")} value={egp(s.revenue_after_discount)} hint={t("Discount given {amount}", { amount: egp(s.discount_given) })} />
      </div>

      {balance && (
        <Link href="/merchant/payouts" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-perk-purple/30 bg-perk-purple/5 p-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-perk-purple">{t("To be settled to your bank account")}</div>
            <div className="text-2xl font-extrabold">{egp(Number(balance.due_to_merchant) + Number(balance.pending_settlements))}</div>
            <div className="text-xs text-zinc-500">{t("All branches · from in-app payments, after Perkly commission")}</div>
          </div>
          <span className="text-sm font-semibold text-perk-purple">{t("Payouts")} →</span>
        </Link>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title={t("Redemptions per day")} className="lg:col-span-2"><BarChart data={series} empty={t("No data yet")} /></Card>
        <Card title={t("Top perks")}><HBarList data={(s.by_perk ?? []).slice(0, 6).map((p) => ({ label: p.perk, value: p.count }))} empty={t("No data yet")} /></Card>
        <Card title={t("Busiest hours (Cairo)")} className="lg:col-span-2" actions={peak.value ? <span className="text-sm text-zinc-500">{t("Peak")}: {peak.label}:00</span> : null}>
          <BarChart data={hours} empty={t("No data yet")} />
        </Card>
        <Card title={t("By cashier")}>
          <HBarList data={(s.by_cashier ?? []).map((c) => ({ label: branch ? c.cashier : `${c.cashier} · ${c.branch}`, value: c.count }))} empty={t("No data yet")} />
        </Card>
        {!branchScope && (
          <Card title={t("By branch")} className="lg:col-span-3">
            <HBarList data={(s.by_branch ?? []).map((b) => ({ label: `${b.branch} · ${egp(b.revenue)}`, value: b.count }))} empty={t("No data yet")} />
          </Card>
        )}
      </div>
      <p className="mt-6 text-sm text-zinc-500">{t("Average bill")}: <b>{egp(s.avg_ticket)}</b> · {t("“More redemptions = more youth visibility.” 💜")}</p>
    </>
  );
}
