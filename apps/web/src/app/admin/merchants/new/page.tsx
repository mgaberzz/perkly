import { requireStaff } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { MerchantAdminForm } from "@/components/merchant-admin-form";
import { getT } from "@/lib/i18n/server";
import { PageTabs } from "@/components/page-tabs";
import { createMerchant } from "../../actions";

export const metadata = { title: "New merchant" };

export default async function NewMerchantPage() {
  await requireStaff("merchants_create");
  const t = await getT();
  return (
    <>
      <PageHeader title={t("Merchants")} subtitle={t("Add the owner's email to send them a portal invite. A Merchant ID (6 digits, starts with 3) is created automatically.")} />
      <PageTabs tabs={[{ href: "/admin/merchants", label: t("All merchants") }, { href: "/admin/merchants/new", label: t("New merchant") }]} />
      <Card className="max-w-3xl"><MerchantAdminForm action={createMerchant} withOwner commercial submitLabel={t("Create merchant")} /></Card>
    </>
  );
}
