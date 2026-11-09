import { requireStaff } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { MerchantAdminForm } from "@/components/merchant-admin-form";
import { getT } from "@/lib/i18n/server";
import { PageTabs } from "@/components/page-tabs";
import { merchantListTabs } from "@/lib/merchant-tabs";
import { createMerchant } from "../../actions";

export const metadata = { title: "New merchant" };

export default async function NewMerchantPage() {
  const { supabase } = await requireStaff("merchants_create");
  const { count } = await supabase.from("merchant_applications").select("*", { count: "exact", head: true }).eq("status", "pending");
  const t = await getT();
  return (
    <>
      <PageHeader title={t("Merchants")} subtitle={t("Add the owner's email to send them a portal invite. A Merchant ID (6 digits, starts with 3) is created automatically.")} />
      <PageTabs tabs={merchantListTabs(t, count ?? 0)} />
      <Card className="max-w-3xl"><MerchantAdminForm action={createMerchant} withOwner commercial submitLabel={t("Create merchant")} /></Card>
    </>
  );
}
