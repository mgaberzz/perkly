import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { Amount, Badge, PageHeader, Stat, Table, Td } from "@/components/ui";
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
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat accent label={t("Owed to partners")} value={<Amount v={sum("due")} />} hint={t("Earned minus paid")} href="#partners" />
        <Stat label={t("Partner cuts")} value={<Amount v={sum("earned")} />} hint={t("All time, from {n} transactions", { n: short(sum("transactions")) })} href="/admin/redemptions?partner=any" />
        <Stat label={t("Paid to partners")} value={<Amount v={sum("paid")} />} hint={t("All time")} href="#partners" />
        <Stat label={t("Merchants via partners")} value={short(sum("merchants"))} hint={t("{n} partners", { n: rows.length })} href="/admin/merchants?partner=any" />
      </div>
      <div id="partners" className="scroll-mt-20">
        <div>
          <Table head={[t("Partner"), t("Deal"), t("Merchants"), t("Transactions"), t("Commission from their merchants"), t("Earned"), t("Paid"), t("Due"), t("Status")]}
            empty={manage ? t("No partners yet. Add the first one under New partner.") : t("No partners yet.")}>
            {rows.map((p) => (
              <tr key={p.partner_id}>
                <Td><Link href={`/admin/partners/${p.partner_id}`} className="font-semibold hover:text-perk-purple">{p.name}</Link><div className="font-mono text-xs font-normal text-zinc-500">{p.partner_code}</div></Td>
                <Td phone="sum"><Badge tone="active" className="whitespace-nowrap">{dealLabel(p, t)}</Badge></Td>
                <Td>{p.merchants}</Td>
                <Td>{short(p.transactions)}</Td>
                <Td><Amount v={p.commission} /></Td>
                <Td><Amount v={p.earned} /></Td>
                <Td><Amount v={p.paid} /></Td>
                <Td phone="sum" className={Number(p.due) > 0 ? "font-bold text-perk-purple" : "text-zinc-400"}>{Number(p.due) > 0 ? <><Amount v={p.due} /> <span className="font-normal text-zinc-500 sm:hidden">{t("due")}</span></> : "—"}</Td>
                <Td phone="sum"><Badge tone={p.status}>{t(p.status)}</Badge></Td>
              </tr>
            ))}
          </Table>
        </div>
      </div>
    </>
  );
}
