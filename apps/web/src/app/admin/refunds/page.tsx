import { requireStaff } from "@/lib/auth";
import { PageHeader, Stat } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { RefundCard } from "@/components/refund-card";
import { RefundDecide, RefundPay } from "@/components/refund-decide";
import { egp } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { REFUND_SELECT, type RefundRow } from "@/lib/refunds";
import { adminDecideRefund, markRefundPaid } from "../actions";

export const metadata = { title: "Refunds" };

export default async function AdminRefundsPage({ searchParams }: PageProps<"/admin/refunds">) {
  const { supabase, can } = await requireStaff("refunds");
  const t = await getT();
  const sp = await searchParams;
  const view = typeof sp.view === "string" ? sp.view : can("finance") && !can("redemptions_review") ? "due" : "pending";
  const search = typeof sp.q === "string" ? sp.q.trim().replace(/[^0-9]/g, "") : "";
  let q = supabase.from("refund_requests").select(REFUND_SELECT).order("created_at", { ascending: false }).limit(200);
  if (view === "pending") q = q.eq("status", "pending");
  else if (view === "due") q = q.eq("payout_status", "due");
  else if (view === "approved" || view === "rejected") q = q.eq("status", view);
  if (search) q = q.eq("refund_code", search);
  const [{ data }, { data: all }] = await Promise.all([
    q.returns<RefundRow[]>(),
    supabase.from("refund_requests").select("status, payout_status, amount, created_at").limit(5000),
  ]);
  const rows = all ?? [];
  const waiting = rows.filter((r) => r.status === "pending");
  const due = rows.filter((r) => r.payout_status === "due");
  const old = olderThanDays(waiting, 3);
  const href = (v: string) => `/admin/refunds?view=${v}`;
  return (
    <>
      <PageHeader title={t("Refunds")} subtitle={t("Students ask in the app and the merchant decides. Step in when a merchant doesn't answer. Finance returns the money for payments made in the app.")} />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label={t("Waiting for the merchant")} value={waiting.length} hint={old ? t("{n} waiting more than 3 days", { n: old }) : undefined} href={href("pending")} />
        <Stat label={t("Perkly must return")} value={egp(due.reduce((a, r) => a + Number(r.amount), 0))} hint={t("{n} refunds", { n: due.length })} href={href("due")} accent={due.length > 0} />
        <Stat label={t("Approved (all time)")} value={rows.filter((r) => r.status === "approved").length} href={href("approved")} />
      </div>
      <FilterBar path="/admin/refunds" search={{ name: "q", value: search, placeholder: t("Search Refund ID") }} fields={[
        { name: "view", label: t("Show"), type: "select", value: view === "pending" ? undefined : view, all: t("Pending"),
          options: [{ value: "due", label: t("Refund due") }, { value: "approved", label: t("Approved") }, { value: "rejected", label: t("Rejected") }, { value: "all", label: t("All statuses") }] },
      ]} />
      {!data?.length && <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">{t("Nothing here.")}</div>}
      <ul className="space-y-3">
        {(data ?? []).map((r) => (
          <RefundCard key={r.id} r={r} t={t} showMerchant>
            {r.status === "pending" && can("redemptions_review") ? <RefundDecide id={r.id} action={adminDecideRefund} t={t} />
              : r.payout_status === "due" && can("finance") ? <RefundPay id={r.id} action={markRefundPaid} t={t} /> : null}
          </RefundCard>
        ))}
      </ul>
    </>
  );
}

function olderThanDays(rows: { created_at: string }[], days: number) {
  const cutoff = Date.now() - days * 86400_000;
  return rows.filter((r) => new Date(r.created_at).getTime() < cutoff).length;
}
