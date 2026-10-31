import { redirect } from "next/navigation";
import { requireMerchant } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { PerkForm } from "@/components/perk-form";
import { createPerk } from "../../actions";

export const metadata = { title: "New perk" };

export default async function NewPerkPage() {
  const { supabase, merchant, canManage } = await requireMerchant();
  if (!canManage) redirect("/merchant/perks");
  const { data: branches } = await supabase.from("merchant_branches").select("id,name").eq("merchant_id", merchant.id).order("name");
  return (
    <>
      <PageHeader title="New perk" subtitle="Up to 30% goes live instantly. 35–40% Hero perks need Perkly approval." />
      <Card><PerkForm action={createPerk} branches={branches ?? []} submitLabel="Create perk" /></Card>
    </>
  );
}
