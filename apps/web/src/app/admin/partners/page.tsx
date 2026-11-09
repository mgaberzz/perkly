import { CardGrid } from "@/components/card-grid";
import { TxPeek } from "@/components/tx-peek";
import { ExpandRow } from "@/components/expand-row";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { Amount, PageHeader, Stat } from "@/components/ui";
import { ExportMenu } from "@/components/export-menu";
import { dealLabel } from "@/components/partner-form";
import { PageTabs } from "@/components/page-tabs";
import { getT } from "@/lib/i18n/server";
import { short } from "@/lib/format";
import type { PartnerBalance } from "@/lib/types";

export const metadata = { title: "Partners" };

export default async function PartnersPage() {
  const { supabase, can } = await requireStaff("partners_view");
  const t = await getT();
  const { data } = await supabase.rpc("partner_balances");
  const rows = (data ?? []) as PartnerBalance[];
  const sum = (k: keyof PartnerBalance) => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const manage = can("partners_manage");
  return (
    <>
      <PageHeader title={t("Partners")} subtitle={t("Partners onboard merchants for Perkly and earn a cut of Perkly's commission on every transaction at their merchants.")}
        actions={<ExportMenu items={[{ label: t("Partner balances"), kind: "partners" }, { label: t("Partner payments"), kind: "partner_payouts" }, { label: t("Transactions"), kind: "transactions" }]} />} />
      {manage && <PageTabs tabs={[{ href: "/admin/partners", label: t("All partners") }, { href: "/admin/partners/new", label: t("New partner") }]} />}
        <CardGrid className="grid grid-cols-2 gap-4 lg:grid-cols-4" items={[
          { key: "o", href: "#partners", card: <Stat accent label={t("Owed to partners")} value={<Amount v={sum("due")} />} hint={t("Earned minus paid")} /> },
          { key: "c", title: t("Partner cuts"), tx: { partner: "any" }, card: <Stat label={t("Partner cuts")} value={<Amount v={sum("earned")} />} hint={t("All time, from {n} transactions", { n: short(sum("transactions")) })} /> },
          { key: "p", href: "#partners", card: <Stat label={t("Paid to partners")} value={<Amount v={sum("paid")} />} hint={t("All time")} /> },
          { key: "m", href: "/admin/merchants?partner=any", card: <Stat label={t("Merchants via partners")} value={short(sum("merchants"))} hint={t("{n} partners", { n: rows.length })} /> },
        ]} />
      <div id="partners" className="scroll-mt-20">
        <div>
          {rows.length === 0 ? <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">{manage ? t("No partners yet. Add the first one under New partner.") : t("No partners yet.")}</div> : (
            <div className="space-y-3">
              {rows.map((p) => (
                <ExpandRow key={p.partner_id} openLabel={t("View transactions")} closeLabel={t("Hide transactions")} summary={<>
                  <div className="min-w-0 basis-48"><div className="truncate font-semibold">{p.name}</div><div className="font-mono text-xs text-zinc-500">{p.partner_code} · {dealLabel(p, t)}</div></div>
                  <div className="text-sm"><div className="text-xs text-zinc-500">{t("Merchants")}</div>{p.merchants}</div>
                  <div className="text-sm"><div className="text-xs text-zinc-500">{t("Earned")}</div><Amount v={p.earned} /></div>
                  <div className="text-sm"><div className="text-xs text-zinc-500">{t("Due")}</div><b className={Number(p.due) > 0 ? "text-perk-purple" : "text-zinc-400"}><Amount v={p.due} /></b></div>
                  <div className={`text-xs font-semibold ${p.status === "active" ? "text-emerald-700" : "text-zinc-500"}`}>{t(p.status)}</div>
                </>}>
                  <dl className="mb-3 grid grid-cols-2 gap-x-6 gap-y-1 px-1 text-sm sm:grid-cols-4">
                    <div><dt className="text-xs text-zinc-500">{t("Transactions")}</dt><dd>{short(p.transactions)}</dd></div>
                    <div><dt className="text-xs text-zinc-500">{t("Commission from their merchants")}</dt><dd><Amount v={p.commission} /></dd></div>
                    <div><dt className="text-xs text-zinc-500">{t("Paid")}</dt><dd><Amount v={p.paid} /></dd></div>
                    <div><dt className="text-xs text-zinc-500">{t("Last paid")}</dt><dd>{p.last_paid_at ? new Date(p.last_paid_at).toLocaleDateString("en-GB") : "—"}</dd></div>
                  </dl>
                  <TxPeek params={{ partner: p.partner_id }} moreHref={`/admin/redemptions?partner=${p.partner_id}`} />
                  <div className="mt-2 px-1 text-sm"><Link href={`/admin/partners/${p.partner_id}`} className="font-semibold text-perk-purple hover:underline">{t("Open partner")} →</Link></div>
                </ExpandRow>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
