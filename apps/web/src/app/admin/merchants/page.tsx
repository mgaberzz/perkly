import Link from "next/link";
import { inScope, requireStaff } from "@/lib/auth";
import { Amount, Badge, PageHeader, Table, Td } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { FilterBar } from "@/components/filter-bar";
import { PageTabs } from "@/components/page-tabs";
import { Avatar, DetailRow, ExpandItem, ExpandList } from "@/components/expand-list";
import { BRAND_TYPE_LABEL, CHANNEL_LABEL } from "@/lib/labels";
import { BRAND_TYPES, CATEGORIES, type Balance, type Merchant } from "@/lib/types";

export const metadata = { title: "Merchants" };

export default async function MerchantsPage({ searchParams }: PageProps<"/admin/merchants">) {
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const [q, status, category, brand, channel, due] = ["q", "status", "category", "brand", "channel", "due"].map(s);
  const { supabase, can, merchantScope, role } = await requireStaff("merchants_view");
  const t = await getT();
  let query = inScope(supabase.from("merchants").select("*, branches:merchant_branches(count), perks(count)").order("name").limit(500), merchantScope, "id");
  if (q) {
    const clean = q.replace(/[,()%]/g, "");
    query = query.or(`name.ilike.%${clean}%,merchant_code.ilike.%${clean}%`);
  }
  if (status) query = query.eq("status", status);
  if (category) query = query.eq("category", category);
  if (brand) query = query.eq("brand_type", brand);
  if (channel) query = query.eq("channel", channel);
  const [{ data: list }, { data: bal }] = await Promise.all([
    query.returns<(Merchant & { branches: { count: number }[]; perks: { count: number }[] })[]>(),
    supabase.rpc("merchant_balances"),
  ]);
  // Dues per merchant: what Perkly must pay them, and what they owe Perkly (commission + VAT)
  const balances = new Map(((bal ?? []) as Balance[]).map((b) => [b.merchant_id, b]));
  const owedTo = (id: string) => { const b = balances.get(id); return b ? Math.max(Number(b.net_to_settle), 0) + Math.max(Number(b.pending_settlements), 0) : 0; };
  const owedBy = (id: string) => { const b = balances.get(id); return b ? -Math.min(Number(b.net_to_settle), 0) - Math.min(Number(b.pending_settlements), 0) : 0; };
  let data = list ?? [];
  if (due) data = data.filter((m) => owedTo(m.id) > 0 || owedBy(m.id) > 0).sort((a, b) => owedTo(b.id) - owedTo(a.id) || owedBy(b.id) - owedBy(a.id));
  const totalOwedTo = data.reduce((a, m) => a + owedTo(m.id), 0);
  return (
    <>
      <PageHeader title={role === "account_manager" ? t("My merchants") : t("Merchants")} subtitle={t("{n} shown", { n: data?.length ?? 0 })} />
      {can("merchants_create") && <PageTabs tabs={[{ href: "/admin/merchants", label: t("All merchants") }, { href: "/admin/merchants/new", label: t("New merchant") }]} />}
      <FilterBar path="/admin/merchants" search={{ name: "q", value: q, placeholder: t("Search name or Merchant ID") }} fields={[
        { name: "status", label: t("Status"), type: "select", value: status, all: t("All statuses"), options: ["pending", "live", "paused", "churned"].map((x) => ({ value: x, label: t(x) })) },
        { name: "brand", label: t("Brand type"), type: "select", value: brand, all: t("All brand types"), options: BRAND_TYPES.map((b) => ({ value: b, label: t(BRAND_TYPE_LABEL[b]) })) },
        { name: "channel", label: t("Channel"), type: "select", value: channel, all: t("All channels"), options: Object.entries(CHANNEL_LABEL).map(([k, v]) => ({ value: k, label: t(v) })) },
        { name: "category", label: t("Category"), type: "select", value: category, all: t("All categories"), options: CATEGORIES.map((c) => ({ value: c, label: t(c) })) },
        { name: "due", label: t("With amounts due"), type: "toggle", value: due },
      ]} />
      {due && <p className="mb-4 text-sm text-zinc-600">{t("To be paid to these merchants")}: <Link href="/admin/explain?metric=to_be_paid" className="font-bold hover:underline"><Amount v={totalOwedTo} /></Link></p>}
      <ExpandList empty={t("No merchants.")}>
        {data.map((m) => {
          const to = owedTo(m.id), by = owedBy(m.id), paid = Number(balances.get(m.id)?.paid_out ?? 0);
          return (
            <ExpandItem key={m.id} accent={to > 0 ? "purple" : by > 0 ? "amber" : undefined} summary={
              <div className="flex items-center gap-3">
                <Avatar name={m.name} src={m.logo_url} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="truncate font-bold">{m.name}</span><Badge tone={m.status} className="shrink-0 !px-2 !text-[10px]">{t(m.status)}</Badge></div>
                  <div className="truncate text-xs text-zinc-500">{t(m.category)} · {t(BRAND_TYPE_LABEL[m.brand_type] ?? m.brand_type)} · <span className="font-mono">{m.merchant_code}</span></div>
                  {to > 0 ? <div className="mt-1 text-xs font-bold text-perk-purple">{t("To be paid to merchant")}: <Amount v={to} /></div>
                    : by > 0 ? <div className="mt-1 text-xs font-bold text-amber-700">{t("Owed to Perkly")}: <Amount v={by} /></div> : null}
                </div>
              </div>}>
              <DetailRow label={t("Channel")}>{t(CHANNEL_LABEL[m.channel])}</DetailRow>
              <DetailRow label={t("Branches")}>{m.branches[0]?.count ?? 0}</DetailRow>
              <DetailRow label={t("Perks")}>{m.perks[0]?.count ?? 0}</DetailRow>
              <DetailRow label={t("Commission")}>{m.commission_pct}%</DetailRow>
              <DetailRow label={t("To be paid to merchant")}>{to > 0 ? <Link href={`/admin/explain?metric=net_to_settle&merchant=${m.id}`} className="text-perk-purple underline"><Amount v={to} /></Link> : "—"}</DetailRow>
              <DetailRow label={t("Owed to Perkly")}>{by > 0 ? <Link href={`/admin/explain?metric=net_to_settle&merchant=${m.id}`} className="text-amber-700 underline"><Amount v={by} /></Link> : "—"}</DetailRow>
              <DetailRow label={t("Paid to merchant")}>{paid > 0 ? <Link href={`/admin/explain?metric=paid_to_merchants&merchant=${m.id}`} className="underline"><Amount v={paid} /></Link> : "—"}</DetailRow>
              <Link href={`/admin/merchants/${m.id}`} className="perk-gradient my-2 flex items-center justify-center rounded-xl py-2.5 text-sm font-semibold text-white">{t("Open merchant")} →</Link>
            </ExpandItem>
          );
        })}
      </ExpandList>
      <Table className="hidden sm:block" head={[t("Merchant"), t("ID"), t("Brand type"), t("Channel"), t("Branches"), t("Perks"), t("Commission"), t("To be paid to merchant"), t("Owed to Perkly"), t("Paid to merchant"), t("Status")]} empty={t("No merchants.")}>
        {(data ?? []).map((m) => (
          <tr key={m.id}>
            <Td><Link href={`/admin/merchants/${m.id}`} className="font-semibold hover:text-perk-purple">{m.name}</Link><div className="text-xs text-zinc-500">{t(m.category)}{m.subcategory && ` · ${m.subcategory}`}</div></Td>
            <Td phone="hide" className="font-mono text-xs">{m.merchant_code}</Td>
            <Td>{t(BRAND_TYPE_LABEL[m.brand_type] ?? m.brand_type)}</Td>
            <Td phone="hide">{t(CHANNEL_LABEL[m.channel])}</Td>
            <Td phone="hide">{m.branches[0]?.count ?? 0}</Td>
            <Td phone="hide">{m.perks[0]?.count ?? 0}</Td>
            <Td phone="hide">{m.commission_pct}%</Td>
            <Td className={owedTo(m.id) > 0 ? "font-bold text-perk-purple" : "text-zinc-400"}>{owedTo(m.id) > 0 ? <Link href={`/admin/explain?metric=net_to_settle&merchant=${m.id}`} className="hover:underline"><Amount v={owedTo(m.id)} /></Link> : "—"}</Td>
            <Td className={owedBy(m.id) > 0 ? "font-semibold text-amber-700" : "text-zinc-400"}>{owedBy(m.id) > 0 ? <Link href={`/admin/explain?metric=net_to_settle&merchant=${m.id}`} className="hover:underline"><Amount v={owedBy(m.id)} /></Link> : "—"}</Td>
            <Td phone="hide">{Number(balances.get(m.id)?.paid_out ?? 0) > 0 ? <Link href={`/admin/explain?metric=paid_to_merchants&merchant=${m.id}`} className="hover:underline"><Amount v={balances.get(m.id)?.paid_out} /></Link> : <span className="text-zinc-400">—</span>}</Td>
            <Td><Badge tone={m.status}>{t(m.status)}</Badge></Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
