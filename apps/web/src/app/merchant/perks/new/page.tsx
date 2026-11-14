import { PageTabs } from "@/components/page-tabs";
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
      <PageHeader title={t("Perks")} subtitle={t("Every new perk goes live once the Perkly team approves it.")} />
      <PageTabs tabs={[{ href: "/merchant/perks", label: t("All perks") }, { href: "/merchant/perks/new", label: t("New perk") }]} />
      <Card><PerkForm action={createPerk} branches={branches ?? []} submitLabel={t("Create perk")} /></Card>
    </>
  );
}
