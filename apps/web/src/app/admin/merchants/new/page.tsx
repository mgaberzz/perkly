import { requireStaff } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { MerchantAdminForm } from "@/components/merchant-admin-form";
import { getT } from "@/lib/i18n/server";
import { createMerchant } from "../../actions";

export const metadata = { title: "New merchant" };

export default async function NewMerchantPage() {
  await requireStaff("merchants_create");
  const t = await getT();
  return (
    <>
      <PageHeader title={t("New merchant")} subtitle={t("Add the owner's email to send them a portal invite. A merchant ID (MER-…) is created automatically.")} />
      <Card><MerchantAdminForm action={createMerchant} withOwner commercial submitLabel={t("Create merchant")} /></Card>
    </>
  );
}
