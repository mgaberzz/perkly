import { requireMerchant } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { LiveRedemptions, type FeedRow } from "@/components/live-redemptions";

export const metadata = { title: "Redemptions" };

export default async function RedemptionsPage() {
  const { supabase, merchant } = await requireMerchant();
  const { data } = await supabase
    .from("redemptions")
    .select("id, created_at, verification_code, original_amount, discount_amount, final_amount, status, first_time_at_merchant, perk:perks(title), branch:merchant_branches(name)")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<FeedRow[]>();
  return (
    <>
      <PageHeader
        title="Redemptions"
        subtitle="Live feed. Match the 4-character code on the student's screen with the newest row before applying the discount."
      />
      <LiveRedemptions merchantId={merchant.id} initial={data ?? []} />
    </>
  );
}
