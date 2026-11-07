import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { Badge, Button, Input, LinkButton, PageHeader, Select, Table, Td } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { BRAND_TYPE_LABEL, CHANNEL_LABEL } from "@/lib/labels";
import { BRAND_TYPES, CATEGORIES, type Merchant } from "@/lib/types";

export const metadata = { title: "Merchants" };

export default async function MerchantsPage({ searchParams }: PageProps<"/admin/merchants">) {
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const [q, status, category, brand, channel] = ["q", "status", "category", "brand", "channel"].map(s);
  const { supabase, can } = await requireStaff("merchants_view");
  const t = await getT();
  let query = supabase.from("merchants").select("*, branches:merchant_branches(count), perks(count)").order("name").limit(500);
  if (q) {
    const clean = q.replace(/[,()%]/g, "");
    query = query.or(`name.ilike.%${clean}%,merchant_code.ilike.%${clean}%`);
  }
  if (status) query = query.eq("status", status);
  if (category) query = query.eq("category", category);
  if (brand) query = query.eq("brand_type", brand);
  if (channel) query = query.eq("channel", channel);
  const { data } = await query.returns<(Merchant & { branches: { count: number }[]; perks: { count: number }[] })[]>();
  return (
    <>
      <PageHeader title={t("Merchants")} subtitle={t("{n} shown", { n: data?.length ?? 0 })}
        actions={can("merchants_create") && <LinkButton href="/admin/merchants/new">+ {t("New merchant")}</LinkButton>} />
      <form className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={q} placeholder={t("Search name or MER-…")} className="max-w-xs" />
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
        <Button variant="secondary">{t("Filter")}</Button>
      </form>
      <Table head={[t("Merchant"), t("ID"), t("Brand type"), t("Channel"), t("Branches"), t("Perks"), t("Commission"), t("Status")]} empty={t("No merchants.")}>
        {(data ?? []).map((m) => (
          <tr key={m.id}>
            <Td><Link href={`/admin/merchants/${m.id}`} className="font-semibold hover:text-perk-purple">{m.name}</Link><div className="text-xs text-zinc-500">{t(m.category)}{m.subcategory && ` · ${m.subcategory}`}</div></Td>
            <Td className="font-mono text-xs">{m.merchant_code}</Td>
            <Td>{t(BRAND_TYPE_LABEL[m.brand_type] ?? m.brand_type)}</Td>
            <Td>{t(CHANNEL_LABEL[m.channel])}</Td>
            <Td>{m.branches[0]?.count ?? 0}</Td>
            <Td>{m.perks[0]?.count ?? 0}</Td>
            <Td>{m.commission_pct}%</Td>
            <Td><Badge tone={m.status}>{t(m.status)}</Badge></Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
