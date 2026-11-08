import { requireStaff } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { PageTabs } from "@/components/page-tabs";
import { PartnerForm } from "@/components/partner-form";
import { getT } from "@/lib/i18n/server";
import { createPartner } from "../../actions";

export const metadata = { title: "New partner" };

export default async function NewPartnerPage() {
  await requireStaff("partners_manage");
  const t = await getT();
  return (
    <>
      <PageHeader title={t("Partners")} subtitle={t("A Partner ID (6 digits, starts with 4) is created automatically. Link merchants on the partner's page after saving.")} />
      <PageTabs tabs={[{ href: "/admin/partners", label: t("All partners") }, { href: "/admin/partners/new", label: t("New partner") }]} />
      <Card className="max-w-xl"><PartnerForm action={createPartner} t={t} submit={t("Create partner")} /></Card>
    </>
  );
}
