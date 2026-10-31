import { requireAdmin } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { MerchantAdminForm } from "@/components/merchant-admin-form";
import { createMerchant } from "../../actions";

export const metadata = { title: "New merchant" };

export default async function NewMerchantPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="New merchant" subtitle="Add the owner's email to send them a portal invite." />
      <Card><MerchantAdminForm action={createMerchant} withOwner submitLabel="Create merchant" /></Card>
    </>
  );
}
