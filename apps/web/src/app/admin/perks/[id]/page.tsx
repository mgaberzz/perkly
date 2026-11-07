import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { Badge, Card, Input, PageHeader } from "@/components/ui";
import { PerkForm } from "@/components/perk-form";
import { discountLabel } from "@/lib/format";
import type { Perk } from "@/lib/types";
import { adminUpdatePerk, reviewPerk } from "../../actions";

export const metadata = { title: "Perk" };

export default async function AdminPerkPage({ params }: PageProps<"/admin/perks/[id]">) {
  const { id } = await params;
  const { supabase, merchantScope } = await requireStaff("perks");
  const t = await getT();
  const { data: perk } = await supabase.from("perks").select("*, merchant:merchants(id, name)").eq("id", id)
    .maybeSingle<Perk & { merchant: { id: string; name: string } }>();
  if (!perk || (merchantScope && !merchantScope.includes(perk.merchant_id))) notFound();
  const { data: branches } = await supabase.from("merchant_branches").select("id,name").eq("merchant_id", perk.merchant_id).order("name");
  return (
    <>
      <PageHeader title={perk.title}
        subtitle={<span className="flex items-center gap-2"><Link href={`/admin/merchants/${perk.merchant.id}`} className="hover:underline">{perk.merchant.name}</Link> · {discountLabel(perk, t)} <Badge tone={perk.status}>{t(perk.status)}</Badge></span>} />
      {perk.status === "pending" && (
        <Card title={t("Review")} className="mb-6">
          <div id="review" className="flex flex-wrap items-end gap-3">
            <form action={reviewPerk}><input type="hidden" name="id" value={perk.id} /><input type="hidden" name="decision" value="approve" />
              <button className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">✓ {t("Approve & go live")}</button></form>
            <form action={reviewPerk} className="flex flex-1 gap-2">
              <input type="hidden" name="id" value={perk.id} /><input type="hidden" name="decision" value="reject" />
              <Input name="note" placeholder={t("Reason shown to merchant (e.g. lower to 30% or add a daily cap)")} className="min-w-64 flex-1" />
              <button className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white">{t("Reject")}</button>
            </form>
          </div>
        </Card>
      )}
      <Card title={t("Edit perk")}>
        <PerkForm action={adminUpdatePerk.bind(null, perk.id)} perk={perk} branches={branches ?? []} />
      </Card>
    </>
  );
}
