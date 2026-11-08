import { requireMerchantArea } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { ExportButtons } from "@/components/export-buttons";
import { LiveRedemptions, FEED_SELECT, type FeedRow } from "@/components/live-redemptions";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Transactions" };

export default async function RedemptionsPage({ searchParams }: PageProps<"/merchant/redemptions">) {
  const { supabase, merchant, branchScope } = await requireMerchantArea("transactions");
  const t = await getT();
  const sp = await searchParams;
  const g = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const branch = branchScope?.id ?? g("branch");
  const from = g("from"), to = g("to"), search = g("q").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  let q = supabase.from("redemptions").select(FEED_SELECT).eq("merchant_id", merchant.id).order("created_at", { ascending: false }).limit(200);
  if (branch) q = q.eq("branch_id", branch);
  if (from) q = q.gte("created_at", `${from}T00:00:00+02:00`);
  if (search) q = q.or(`tx_code.ilike.%${search}%,verification_code.eq.${search}`);
  if (to) q = q.lte("created_at", `${to}T23:59:59+02:00`);
  const [{ data }, { data: branches }] = await Promise.all([
    q.returns<FeedRow[]>(),
    supabase.from("merchant_branches").select("id, name").eq("merchant_id", merchant.id).order("name"),
  ]);
  return (
    <>
      <PageHeader
        title={t("Transactions")}
        subtitle={t("Live feed. Match the 4-character code on the student's screen with the newest row before applying the discount.")}
        actions={<ExportButtons kind="transactions" params={{ scope: "merchant", branch: branch || undefined, from: from || undefined, to: to || undefined }} />}
      />
      <FilterBar path="/merchant/redemptions" search={{ name: "q", value: g("q"), placeholder: t("Search transaction ID or code") }} fields={[
        ...(branchScope ? [] : [{ name: "branch", label: t("Branch"), type: "select" as const, value: branch, all: t("All branches"), options: (branches ?? []).map((b) => ({ value: b.id, label: b.name })) }]),
        { name: "from", label: t("From"), type: "date", value: from },
        { name: "to", label: t("To"), type: "date", value: to },
      ]} />
      <LiveRedemptions key={`${branch}-${from}-${to}-${search}`} merchantId={merchant.id} branchId={branch || null} initial={data ?? []} />
    </>
  );
}
