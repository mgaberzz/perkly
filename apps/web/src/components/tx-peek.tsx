"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useT } from "./i18n";
import { Icon } from "./icons";
import { ExportMenu } from "./export-menu";

type Row = {
  id: string; created_at: string; tx_code: string; verification_code: string; receipt_ref: string | null; status: string; payment_method: string;
  original_amount: number | null; final_amount: number | null; commission_amount: number | null; settle_amount: number | null;
  merchant: { id: string; name: string } | null; perk: { title: string } | null; branch: { name: string } | null;
  settlement: { id: string; status: string; settlement_code: string } | null;
};

const money = (n: number | null | undefined) => (n == null ? "—" : `${Number(n).toLocaleString("en-EG", { maximumFractionDigits: 2 })} EGP`);
const when = (s: string) => new Date(s).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Cairo" });

/**
 * Transactions for a set of filters, loaded when first shown (inside an open card panel or an opened row).
 * `params` are the Transactions page filters; `moreHref` opens the full list.
 */
export function TxPeek({ params, moreHref, merchantColumn = true }: { params: Record<string, string | undefined>; moreHref?: string; merchantColumn?: boolean }) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<{ rows: Row[]; count: number } | null>(null);
  const [error, setError] = useState(false);
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();

  useEffect(() => {
    let done = false;
    const load = () => {
      if (done) return; done = true;
      fetch(`/api/tx?${qs}`).then((r) => (r.ok ? r.json() : Promise.reject())).then(setData).catch(() => setError(true));
    };
    // Inside a closed <details>, wait until it is opened
    const details = box.current?.closest("details");
    if (details && !details.open) {
      const onToggle = () => { if (details.open) load(); };
      details.addEventListener("toggle", onToggle);
      return () => details.removeEventListener("toggle", onToggle);
    }
    load();
  }, [qs]);

  return (
    <div ref={box}>
      {!data && !error && <div className="space-y-2 p-1">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-zinc-100" />)}</div>}
      {error && <p className="p-3 text-sm text-red-600">{t("Could not load the transactions.")}</p>}
      {data && data.rows.length === 0 && <p className="p-4 text-center text-sm text-zinc-500">{t("No transactions.")}</p>}
      {data && data.rows.length > 0 && (
        <ul className="divide-y divide-zinc-100">
          {data.rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-1 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  {merchantColumn && r.merchant && <span className="truncate font-semibold">{r.merchant.name}</span>}
                  <span className="truncate text-zinc-600">{r.perk?.title}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-zinc-500">
                  <span className="font-mono text-zinc-600">{r.tx_code}</span>
                  <span>{when(r.created_at)}</span>
                  <span>{r.payment_method === "in_app" ? t("In app") : t("Cashier")}</span>
                  {r.branch ? <span>{r.branch.name}</span> : <span><Icon name="globe" size={12} className="me-0.5 inline-block align-[-2px]" />{t("Online")}</span>}
                  {r.receipt_ref && <span className="font-mono">#{r.receipt_ref}</span>}
                </div>
              </div>
              <div className="shrink-0 text-end">
                <div className="font-semibold">{money(r.original_amount)}</div>
                <div className={`text-xs ${r.status === "reversed" ? "text-red-600" : r.settlement?.status === "paid" ? "text-emerald-700" : r.settlement ? "text-amber-700" : "text-zinc-500"}`}>
                  {r.status === "reversed" ? t("reversed") : r.settlement ? `${t(r.settlement.status === "paid" ? "Settled" : "In settlement")} ${r.settlement.settlement_code}` : r.settle_amount != null ? `${t("To settle")} ${money(r.settle_amount)}` : t("Not settled yet")}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-1 pt-2.5 text-xs text-zinc-500">
          <span>{data.count > data.rows.length ? t("Showing the latest {n} of {total}", { n: data.rows.length, total: data.count }) : t("{n} transactions", { n: data.count })}</span>
          <span className="flex flex-wrap items-center gap-3">
            {data.count > 0 && <ExportMenu items={[{ label: t("These transactions ({n})", { n: data.count }), kind: "transactions", params }]} />}
            {moreHref && <Link href={moreHref} className="font-semibold text-perk-purple hover:underline">{t("Open all in Transactions")} →</Link>}
          </span>
        </div>
      )}
    </div>
  );
}
