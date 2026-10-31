import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Badge, Button, Input, LinkButton, PageHeader, Select, Table, Td } from "@/components/ui";
import { CATEGORIES, type Merchant } from "@/lib/types";

export const metadata = { title: "Merchants" };

export default async function MerchantsPage({ searchParams }: PageProps<"/admin/merchants">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const category = typeof sp.category === "string" ? sp.category : "";
  const { supabase } = await requireAdmin();
  let query = supabase.from("merchants").select("*, branches:merchant_branches(count), perks(count)").order("name").limit(500);
  if (q) query = query.ilike("name", `%${q}%`);
  if (status) query = query.eq("status", status);
  if (category) query = query.eq("category", category);
  const { data } = await query.returns<(Merchant & { branches: { count: number }[]; perks: { count: number }[] })[]>();
  return (
    <>
      <PageHeader title="Merchants" subtitle={`${data?.length ?? 0} shown`} actions={<LinkButton href="/admin/merchants/new">+ New merchant</LinkButton>} />
      <form className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={q} placeholder="Search name…" className="max-w-xs" />
        <Select name="status" defaultValue={status} className="w-40">
          <option value="">All statuses</option><option>pending</option><option>live</option><option>paused</option><option>churned</option>
        </Select>
        <Select name="category" defaultValue={category} className="w-44">
          <option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Button variant="secondary">Filter</Button>
      </form>
      <Table head={["Merchant", "Category", "Branches", "Perks", "Plan", "Commission", "Status"]}>
        {(data ?? []).map((m) => (
          <tr key={m.id}>
            <Td><Link href={`/admin/merchants/${m.id}`} className="font-semibold hover:text-perk-purple">{m.name}</Link></Td>
            <Td>{m.category}<div className="text-xs text-zinc-500">{m.subcategory}</div></Td>
            <Td>{m.branches[0]?.count ?? 0}</Td>
            <Td>{m.perks[0]?.count ?? 0}</Td>
            <Td className="capitalize">{m.plan}</Td>
            <Td>{m.commission_pct}%</Td>
            <Td><Badge>{m.status}</Badge></Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
