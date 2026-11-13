import { requireMerchantArea } from "@/lib/auth";
import { Card, PageHeader, Stat } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { dateTime } from "@/lib/format";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Reviews" };
type Review = { stars: number; comment: string | null; created_at: string; branch_id: string | null; branch_name: string | null; perk_title: string | null };
const Stars = ({ n }: { n: number }) => <span className="font-bold tracking-wide text-amber-500" aria-label={`${n}/5`}>{"★".repeat(n)}<span className="text-zinc-300">{"★".repeat(5 - n)}</span></span>;

export default async function ReviewsPage({ searchParams }: PageProps<"/merchant/reviews">) {
  const { supabase, merchant, branchScope } = await requireMerchantArea("reviews");
  const t = await getT();
  const sp = await searchParams;
  const show = typeof sp.show === "string" ? sp.show : "";
  const { data } = await supabase.rpc("merchant_reviews", { p_merchant_id: merchant.id, p_limit: 500 });
  const all = ((data ?? []) as Review[]).filter((r) => !branchScope || r.branch_id === branchScope.id);
  const rows = all.filter((r) => (show === "low" ? r.stars <= 3 : show === "comments" ? !!r.comment : true));
  const avg = all.length ? all.reduce((a, r) => a + r.stars, 0) / all.length : null;
  const dist = [5, 4, 3, 2, 1].map((s) => ({ s, n: all.filter((r) => r.stars === s).length }));
  return (
    <>
      <PageHeader title={t("Reviews")} subtitle={t("Students rate their visit after using a perk. You see the stars and comments, never who wrote them.")} />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat accent label={t("Average rating")} value={avg != null ? `★ ${avg.toFixed(1)}` : "—"} hint={t("{n} reviews", { n: all.length })} />
        <Stat label={t("3 stars or less")} value={all.filter((r) => r.stars <= 3).length} href="/merchant/reviews?show=low" />
        <Card>
          <div className="space-y-1">
            {dist.map(({ s, n }) => (
              <div key={s} className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="w-6 shrink-0">{s}★</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100"><span className="block h-full rounded-full bg-amber-400" style={{ width: `${all.length ? (n / all.length) * 100 : 0}%` }} /></span>
                <span className="w-6 shrink-0 text-end">{n}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <FilterBar path="/merchant/reviews" fields={[
        { name: "show", label: t("Show"), type: "select", value: show || undefined, all: t("All reviews"),
          options: [{ value: "low", label: t("3 stars or less") }, { value: "comments", label: t("With a comment") }] },
      ]} />
      {!rows.length && (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
          {all.length ? t("Nothing matches these filters.") : t("No reviews yet. Students can rate each visit in the app after they redeem.")}
        </div>
      )}
      <ul className="space-y-3">
        {rows.map((r, i) => (
          <li key={i} className={`rounded-2xl border bg-white p-4 shadow-sm ${r.stars <= 2 ? "border-red-200" : "border-zinc-200"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Stars n={r.stars} />
              <span className="text-xs text-zinc-500">{dateTime(r.created_at)}</span>
            </div>
            {r.comment && <p className="mt-2 text-sm text-zinc-700">“{r.comment}”</p>}
            <p className="mt-2 text-xs text-zinc-500">{r.branch_name ?? t("Online")}{r.perk_title ? ` · ${r.perk_title}` : ""}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
