import { requireMerchantArea } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { RefundCard } from "@/components/refund-card";
import { RefundDecide } from "@/components/refund-decide";
import { getT } from "@/lib/i18n/server";
import { REFUND_SELECT, type RefundRow } from "@/lib/refunds";
import { decideRefund } from "../actions";

export const metadata = { title: "Refunds" };

export default async function MerchantRefundsPage({ searchParams }: PageProps<"/merchant/refunds">) {
  const { supabase, merchant, branchScope } = await requireMerchantArea("refunds");
  const t = await getT();
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "pending";
  let q = supabase.from("refund_requests").select(REFUND_SELECT).eq("merchant_id", merchant.id).order("created_at", { ascending: false }).limit(200);
  if (branchScope) q = q.eq("branch_id", branchScope.id);
  if (status !== "all") q = q.eq("status", status);
  const { data } = await q.returns<RefundRow[]>();
  return (
    <>
      <PageHeader title={t("Refunds")} subtitle={t("Students ask for a refund in the app. Check the transaction, then approve or reject. Approving cancels the transaction, so you pay no commission on it.")} />
      <FilterBar path="/merchant/refunds" fields={[
        { name: "status", label: t("Status"), type: "select", value: status === "pending" ? undefined : status, all: t("Waiting"),
          options: [{ value: "approved", label: t("Approved") }, { value: "rejected", label: t("Rejected") }, { value: "all", label: t("All statuses") }] },
      ]} />
      {!data?.length && (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
          {status === "pending" ? t("No refund requests waiting.") : t("Nothing matches these filters.")}
        </div>
      )}
      <ul className="space-y-3">
        {(data ?? []).map((r) => (
          <RefundCard key={r.id} r={r} t={t}>{r.status === "pending" ? <RefundDecide id={r.id} action={decideRefund} t={t} /> : null}</RefundCard>
        ))}
      </ul>
    </>
  );
}
