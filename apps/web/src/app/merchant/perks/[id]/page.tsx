import { notFound } from "next/navigation";
import { requireMerchant } from "@/lib/auth";
import { Badge, Card, Notice, PageHeader } from "@/components/ui";
import { PerkForm } from "@/components/perk-form";
import { discountLabel } from "@/lib/format";
import type { Perk } from "@/lib/types";
import { updatePerk } from "../../actions";

export const metadata = { title: "Edit perk" };

export default async function EditPerkPage({ params, searchParams }: PageProps<"/merchant/perks/[id]">) {
  const { id } = await params;
  const { created } = await searchParams;
  const { supabase, merchant, canManage } = await requireMerchant();
  const { data: perk } = await supabase.from("perks").select("*").eq("id", id).eq("merchant_id", merchant.id).maybeSingle<Perk>();
  if (!perk) notFound();
  const { data: branches } = await supabase.from("merchant_branches").select("id,name").eq("merchant_id", merchant.id).order("name");
  return (
    <>
      <PageHeader title={perk.title} subtitle={<span className="flex items-center gap-2">{discountLabel(perk)} <Badge>{perk.status}</Badge></span>} />
      {created === "pending" && <div className="mb-4"><Notice>Created! Hero perks (above 30%) go live once the Perkly team approves them.</Notice></div>}
      {created === "active" && <div className="mb-4"><Notice tone="success">Created and live 🎉 Students can redeem it now.</Notice></div>}
      {perk.status === "rejected" && perk.review_note && <div className="mb-4"><Notice tone="error">Not approved: {perk.review_note}</Notice></div>}
      <Card>
        {canManage
          ? <PerkForm action={updatePerk.bind(null, perk.id)} perk={perk} branches={branches ?? []} />
          : <p className="text-sm text-zinc-500">Only owners and managers can edit perks.</p>}
      </Card>
    </>
  );
}
