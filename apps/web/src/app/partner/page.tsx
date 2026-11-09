import Link from "next/link";
import { requirePartner } from "@/lib/auth";
import { Amount, BarChart, Card, HBarList, Notice, PageHeader, Stat } from "@/components/ui";
import { dealLabel } from "@/components/partner-form";
import { getT } from "@/lib/i18n/server";
import { date, short } from "@/lib/format";
import type { PartnerBalance } from "@/lib/types";

export const metadata = { title: "Partner dashboard" };
type Tx = { created_at: string; cut: number; status: string };
type M = { merchant_id: string; name: string; status: string; earned: number };

export default async function PartnerHome() {
  const { supabase, partner, profile } = await requirePartner();
  const t = await getT();
  const [{ data: bal }, { data: tx }, { data: ms }] = await Promise.all([
    supabase.rpc("partner_balances", { p_partner_id: partner.id }),
    supabase.rpc("partner_transactions", { p_partner_id: partner.id, p_days: 30 }),
    supabase.rpc("partner_merchants", { p_partner_id: partner.id }),
  ]);
  const b = ((bal ?? []) as PartnerBalance[])[0];
  const merchants = (ms ?? []) as M[];
  const byDay = new Map<string, number>();
  for (const r of (tx ?? []) as Tx[]) {
    const d = new Date(r.created_at).toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
    byDay.set(d, (byDay.get(d) ?? 0) + Number(r.cut));
  }
  // eslint-disable-next-line react-hooks/purity -- server component, rendered per request
  const now = Date.now();
  const series = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now - (29 - i) * 86400000).toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
    return { label: d.slice(8), value: Math.round((byDay.get(d) ?? 0) * 100) / 100 };
  });
  const first = profile?.full_name?.split(" ")[0] ?? "";
  return (
    <>
      <PageHeader title={t("Hi {name}", { name: first })} subtitle={`${partner.name} · ${dealLabel(partner, t)}`} />
      {merchants.length === 0 && <div className="mb-6"><Notice>{t("No merchants are linked to you yet. Once Perkly links the merchants you onboarded, their transactions and your earnings show here.")}</Notice></div>}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Link href="/partner/payments" className="block transition hover:-translate-y-0.5"><Stat accent label={t("Due to you")} value={<Amount v={b?.due ?? 0} />} hint={t("Earned minus paid")} /></Link>
        <Link href="/partner/transactions" className="block transition hover:-translate-y-0.5"><Stat label={t("You earned")} value={<Amount v={b?.earned ?? 0} />} hint={t("{n} transactions, all time", { n: short(b?.transactions ?? 0) })} /></Link>
        <Link href="/partner/payments" className="block transition hover:-translate-y-0.5"><Stat label={t("Paid to you")} value={<Amount v={b?.paid ?? 0} />} hint={b?.last_paid_at ? t("Last paid {date}", { date: date(b.last_paid_at) }) : t("Nothing paid yet")} /></Link>
        <Link href="/partner/merchants" className="block transition hover:-translate-y-0.5"><Stat label={t("My merchants")} value={`${merchants.filter((m) => m.status === "live").length} / ${merchants.length}`} hint={t("live / onboarded")} /></Link>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title={t("Your earnings per day (EGP)")} className="lg:col-span-2"><BarChart data={series} empty={t("No data yet")} /></Card>
        <Card title={t("Top merchants")}>
          <HBarList data={merchants.filter((m) => Number(m.earned) > 0).slice(0, 5).map((m) => ({ label: m.name, value: Number(m.earned), href: `/partner/transactions?merchant=${m.merchant_id}` }))}
            format={(n) => `${short(n)} EGP`} empty={t("No data yet")} />
        </Card>
      </div>
    </>
  );
}
