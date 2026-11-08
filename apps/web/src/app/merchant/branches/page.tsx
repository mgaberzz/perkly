import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMerchantArea } from "@/lib/auth";
import { Badge, LinkButton, PageHeader, Table, Td } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Branches & QR" };

export default async function BranchesPage() {
  const { supabase, merchant, canManage, branchScope } = await requireMerchantArea("branches");
  if (branchScope) redirect(`/merchant/branches/${branchScope.id}`);
  const t = await getT();
  const { data } = await supabase.from("merchant_branches")
    .select("id, name, address, city, is_active, lat, campus:campuses(name), qr:branch_qr_codes(id, is_active, status)")
    .eq("merchant_id", merchant.id).order("name")
    .returns<{ id: string; name: string; address: string | null; city: string | null; is_active: boolean; lat: number | null; campus: { name: string } | null; qr: { id: string; is_active: boolean; status: string }[] }[]>();
  return (
    <>
      <PageHeader title={t("Branches & QR codes")} subtitle={t("Each cashier gets their own QR so you can see who served which student. New QR codes are approved by Perkly.")}
        actions={canManage && <LinkButton href="/merchant/branches/new">+ {t("New branch")}</LinkButton>} />
      <Table head={[t("Branch"), t("Campus"), t("City"), t("Cashier QR codes"), t("Location"), t("Status")]} empty={t("Add your first branch to get a QR code.")}>
        {(data ?? []).map((b) => {
          const live = b.qr.filter((q) => q.is_active && q.status === "approved").length;
          const pending = b.qr.filter((q) => q.status === "pending").length;
          return (
            <tr key={b.id}>
              <Td><Link href={`/merchant/branches/${b.id}`} className="font-semibold hover:text-perk-purple">{b.name}</Link><div className="text-xs text-zinc-500">{b.address}</div></Td>
              <Td>{b.campus?.name ?? "—"}</Td>
              <Td phone="sum">{b.city ?? "—"}</Td>
              <Td>{live} {pending > 0 && <Badge tone="pending" className="ms-1">{t("{n} pending", { n: pending })}</Badge>}</Td>
              <Td>{b.lat != null ? `✅ ${t("Set")}` : <span className="text-amber-600">{t("Missing")}</span>}</Td>
              <Td phone="sum"><Badge tone={b.is_active ? "active" : "paused"}>{b.is_active ? t("open") : t("closed")}</Badge></Td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
