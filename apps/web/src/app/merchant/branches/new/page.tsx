import { redirect } from "next/navigation";
import { requireMerchant } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { BranchForm } from "@/components/branch-form";
import { createBranch } from "../../actions";

export const metadata = { title: "New branch" };

export default async function NewBranchPage() {
  const { supabase, canManage } = await requireMerchant();
  if (!canManage) redirect("/merchant/branches");
  const { data: campuses } = await supabase.from("campuses").select("id,name").order("name");
  return (
    <>
      <PageHeader title="New branch" subtitle="A cashier QR code is created automatically." />
      <Card><BranchForm action={createBranch} campuses={campuses ?? []} submitLabel="Create branch" /></Card>
    </>
  );
}
