import { redirect } from "next/navigation";
import { requireMerchantArea } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { PerkForm } from "@/components/perk-form";
import { createPerk } from "../../actions";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "New perk" };

export default async function NewPerkPage() {
  const { supabase, merchant, canManage } = await requireMerchantArea("perks");
  if (!canManage) redirect("/merchant/perks");
  const t = await getT();
  const { data: branches } = await supabase.from("merchant_branches").select("id,name").eq("merchant_id", merchant.id).order("name");
  return (
    <>
      <PageHeader title={t("New perk")} subtitle={t("Up to 30% goes live instantly. 35–40% Hero perks need Perkly approval.")} />
      <Card><PerkForm action={createPerk} branches={branches ?? []} submitLabel={t("Create perk")} /></Card>
    </>
  );
}
