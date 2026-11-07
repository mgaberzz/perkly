import { getT } from "@/lib/i18n/server";

/** "Export: Excel · CSV" links for a /export/<kind> route, keeping the current filters. */
export async function ExportButtons({ kind, params = {} }: { kind: string; params?: Record<string, string | undefined> }) {
  const t = await getT();
  const qs = (format: string) => {
    const p = new URLSearchParams({ format });
    for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
    return `/export/${kind}?${p}`;
  };
  const cls = "inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50";
  return (
    <div className="flex gap-2">
      <a href={qs("xlsx")} className={cls}>⬇ {t("Excel")}</a>
      <a href={qs("csv")} className={cls}>⬇ CSV</a>
    </div>
  );
}
