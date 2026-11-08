import Link from "next/link";
import { inScope, requireStaff } from "@/lib/auth";
import { Amount, Badge, Button, Input, LinkButton, PageHeader, Select, Table, Td } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
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
      <PageHeader title={role === "account_manager" ? t("My merchants") : t("Merchants")} subtitle={t("{n} shown", { n: data?.length ?? 0 })}
        actions={can("merchants_create") && <LinkButton href="/admin/merchants/new">+ {t("New merchant")}</LinkButton>} />
      <form className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={q} placeholder={t("Search name or MER-…")} className="w-full sm:max-w-xs" />
        <Select name="status" defaultValue={status} className="w-36">
          <option value="">{t("All statuses")}</option>{["pending", "live", "paused", "churned"].map((x) => <option key={x} value={x}>{t(x)}</option>)}
        </Select>
        <Select name="brand" defaultValue={brand} className="w-40">
          <option value="">{t("All brand types")}</option>{BRAND_TYPES.map((b) => <option key={b} value={b}>{t(BRAND_TYPE_LABEL[b])}</option>)}
        </Select>
        <Select name="channel" defaultValue={channel} className="w-40">
          <option value="">{t("All channels")}</option>{Object.entries(CHANNEL_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
        </Select>
        <Select name="category" defaultValue={category} className="w-40">
          <option value="">{t("All categories")}</option>{CATEGORIES.map((c) => <option key={c} value={c}>{t(c)}</option>)}
        </Select>
        <label className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 text-sm font-semibold">
          <input type="checkbox" name="due" value="1" defaultChecked={!!due} className="accent-perk-purple" /> {t("With amounts due")}
        </label>
        <Button variant="secondary">{t("Filter")}</Button>
      </form>
      {due && <p className="mb-4 text-sm text-zinc-600">{t("To be paid to these merchants")}: <Link href="/admin/explain?metric=to_be_paid" className="font-bold hover:underline"><Amount v={totalOwedTo} /></Link></p>}
      <Table head={[t("Merchant"), t("ID"), t("Brand type"), t("Channel"), t("Branches"), t("Perks"), t("Commission"), t("To be paid to merchant"), t("Owed to Perkly"), t("Paid to merchant"), t("Status")]} empty={t("No merchants.")}>
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
