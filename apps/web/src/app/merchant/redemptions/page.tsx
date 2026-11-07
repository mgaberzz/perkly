import { requireMerchantArea } from "@/lib/auth";
import { Button, Input, PageHeader, Select } from "@/components/ui";
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
  const from = g("from"), to = g("to");
  let q = supabase.from("redemptions").select(FEED_SELECT).eq("merchant_id", merchant.id).order("created_at", { ascending: false }).limit(200);
  if (branch) q = q.eq("branch_id", branch);
  if (from) q = q.gte("created_at", `${from}T00:00:00+02:00`);
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
      <form className="mb-4 flex flex-wrap items-end gap-2">
        {!branchScope && (
          <Select name="branch" defaultValue={branch} className="w-48">
            <option value="">{t("All branches")}</option>
            {(branches ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        )}
        <label className="text-xs text-zinc-500">{t("From")}<Input type="date" name="from" defaultValue={from} className="w-40" /></label>
        <label className="text-xs text-zinc-500">{t("To")}<Input type="date" name="to" defaultValue={to} className="w-40" /></label>
        <Button variant="secondary">{t("Filter")}</Button>
      </form>
      <LiveRedemptions key={`${branch}-${from}-${to}`} merchantId={merchant.id} branchId={branch || null} initial={data ?? []} />
    </>
  );
}
