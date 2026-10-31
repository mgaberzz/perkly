import Link from "next/link";
import { requireMerchant } from "@/lib/auth";
import { Badge, LinkButton, PageHeader, Table, Td } from "@/components/ui";

export const metadata = { title: "Branches & QR" };

export default async function BranchesPage() {
  const { supabase, merchant, canManage } = await requireMerchant();
  const { data } = await supabase.from("merchant_branches")
    .select("id, name, address, city, is_active, lat, campus:campuses(name), qr:branch_qr_codes(id, is_active)")
    .eq("merchant_id", merchant.id).order("name")
    .returns<{ id: string; name: string; address: string | null; city: string | null; is_active: boolean; lat: number | null; campus: { name: string } | null; qr: { id: string; is_active: boolean }[] }[]>();
  return (
    <>
      <PageHeader title="Branches & QR codes" subtitle="Each branch has a QR for the cashier table. Students scan it to redeem."
        actions={canManage && <LinkButton href="/merchant/branches/new">+ New branch</LinkButton>} />
      <Table head={["Branch", "Campus", "City", "Active QR codes", "Location", "Status"]} empty="Add your first branch to get a QR code.">
        {(data ?? []).map((b) => (
          <tr key={b.id}>
            <Td><Link href={`/merchant/branches/${b.id}`} className="font-semibold hover:text-perk-purple">{b.name}</Link><div className="text-xs text-zinc-500">{b.address}</div></Td>
            <Td>{b.campus?.name ?? "—"}</Td>
            <Td>{b.city ?? "—"}</Td>
            <Td>{b.qr.filter((q) => q.is_active).length}</Td>
            <Td>{b.lat != null ? "✅ Set" : <span className="text-amber-600">Missing</span>}</Td>
            <Td><Badge tone={b.is_active ? "active" : "paused"}>{b.is_active ? "open" : "closed"}</Badge></Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
