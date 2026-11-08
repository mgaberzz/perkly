import { PageTabs } from "@/components/page-tabs";
import { redirect } from "next/navigation";
import { requireMerchantArea } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { BranchForm } from "@/components/branch-form";
import { createBranch } from "../../actions";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "New branch" };

export default async function NewBranchPage() {
  const { supabase, canManage } = await requireMerchantArea("branches");
  if (!canManage) redirect("/merchant/branches");
  const t = await getT();
  const { data: campuses } = await supabase.from("campuses").select("id,name").order("name");
  return (
    <>
      <PageHeader title={t("Branches & QR codes")} subtitle={t("A first cashier QR code is created automatically and goes live once Perkly approves it.")} />
      <PageTabs tabs={[{ href: "/merchant/branches", label: t("All branches") }, { href: "/merchant/branches/new", label: t("New branch") }]} />
      <Card><BranchForm action={createBranch} campuses={campuses ?? []} submitLabel={t("Create branch")} /></Card>
    </>
  );
}
