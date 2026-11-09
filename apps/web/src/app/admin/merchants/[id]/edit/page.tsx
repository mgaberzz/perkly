import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { Badge, Card, Notice, PageHeader } from "@/components/ui";
import { MerchantAdminForm } from "@/components/merchant-admin-form";
import { PageTabs } from "@/components/page-tabs";
import { merchantTabs } from "@/lib/merchant-tabs";
import { getT } from "@/lib/i18n/server";
import type { Merchant } from "@/lib/types";
import { updateMerchant } from "../../../actions";

export const metadata = { title: "Edit merchant" };

/** Edit a merchant. Needs "edit merchants" (admin, operations, or the merchant's account manager);
 *  plan, commission and VAT only for admin / operations — the database enforces the same. */
export default async function EditMerchantPage({ params }: PageProps<"/admin/merchants/[id]/edit">) {
  const { id } = await params;
  const { supabase, can, merchantScope } = await requireStaff("merchants_edit");
  if (merchantScope && !merchantScope.includes(id)) notFound();
  const t = await getT();
  const { data: merchant } = await supabase.from("merchants").select("*").eq("id", id).maybeSingle<Merchant>();
  if (!merchant) notFound();
  const commercial = can("commercial_terms");
  return (
    <>
      <PageHeader title={merchant.name}
        subtitle={<span className="flex flex-wrap items-center gap-2"><span className="font-mono">{merchant.merchant_code}</span> <Badge tone={merchant.status}>{t(merchant.status)}</Badge></span>} />
      <PageTabs tabs={merchantTabs(id, true, t)} />
      {!commercial && <div className="mb-4 max-w-3xl"><Notice>{t("Plan, commission and VAT can only be changed by Operations or an Admin.")}</Notice></div>}
      <Card className="max-w-3xl">
        <MerchantAdminForm action={updateMerchant.bind(null, id)} merchant={merchant} commercial={commercial} submitLabel={t("Save changes")} />
      </Card>
    </>
  );
}
