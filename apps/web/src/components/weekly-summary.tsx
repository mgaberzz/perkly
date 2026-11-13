import Link from "next/link";
import { egp } from "@/lib/format";
import type { TFn } from "@/lib/i18n";
import { change, summarize, type WeekRow } from "@/lib/weekly";

type Review = { stars: number; created_at: string };

/** "Your week with Perkly": last Monday–Sunday against the week before. Shown at the top of the merchant dashboard. */
export function WeeklySummary({ t, rows, reviews, range }: {
  t: TFn; rows: WeekRow[]; reviews: Review[]; range: { from: string; lastDay: string; fromISO: string; toISO: string };
}) {
  const cur = summarize(rows.filter((r) => r.created_at >= range.fromISO && r.created_at < range.toISO));
  const prev = summarize(rows.filter((r) => r.created_at < range.fromISO));
  const wk = reviews.filter((r) => r.created_at >= range.fromISO && r.created_at < range.toISO);
  const avg = wk.length ? wk.reduce((a, r) => a + r.stars, 0) / wk.length : null;
  const short = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const delta = (now: number, before: number) => {
    const c = change(now, before);
    if (!c) return null;
    const up = c === "new" || c.startsWith("+");
    return <span className={`ms-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${c === "0%" ? "bg-white/20" : up ? "bg-emerald-400/30" : "bg-black/20"}`}>{c === "new" ? t("New") : c} {c !== "new" && t("vs the week before")}</span>;
  };
  const items: [string, React.ReactNode, React.ReactNode][] = [
    [t("Students who visited"), cur.students, delta(cur.students, prev.students)],
    [t("Sales through Perkly"), egp(cur.sales), delta(cur.sales, prev.sales)],
    [t("New customers"), cur.newCustomers, delta(cur.newCustomers, prev.newCustomers)],
  ];
  return (
    <section className="perk-gradient mb-6 rounded-2xl p-5 text-white shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-extrabold">{t("Your week with Perkly")}</h2>
        <span className="text-sm text-white/80">{short(range.from)} – {short(range.lastDay)}</span>
      </div>
      {cur.transactions === 0 ? (
        <p className="mt-3 text-sm text-white/90">
          {t("No student visits last week.")} {prev.transactions > 0 ? t("The week before you had {n}.", { n: prev.transactions }) : ""}{" "}
          <Link href="/merchant/perks" className="font-bold underline">{t("Check that your perks are active")}</Link>
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {items.map(([label, value, d]) => (
              <div key={label}>
                <div className="text-xs text-white/80">{label}</div>
                <div className="text-2xl font-extrabold">{value}</div>
                <div className="mt-1 -ms-2">{d}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-white/90">
            {t("{n} transactions · students saved {d}", { n: cur.transactions, d: egp(cur.discount) })}
            {cur.topPerk && <> · {t("most used: {perk}", { perk: cur.topPerk })}</>}
            {cur.bestDay && <> · {t("busiest day: {day}", { day: t(cur.bestDay) })}</>}
            {avg != null && <> · {t("rating {r} from {n} reviews", { r: `★ ${avg.toFixed(1)}`, n: wk.length })}</>}
          </p>
        </>
      )}
    </section>
  );
}
