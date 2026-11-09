"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useT } from "./i18n";
import { TxPeek } from "./tx-peek";

export type CardItem = {
  key: string;
  /** The card itself (rendered by the page) */
  card: ReactNode;
  /** Opens its transactions in place (Transactions page filters) … */
  tx?: Record<string, string | undefined>;
  /** … or, for cards that aren't about transactions, goes to this page */
  href?: string;
  title?: string;
};

/**
 * A grid of number cards. A card with `tx` opens its transactions in a panel under the grid
 * (click again or "Hide" to close); a card with only `href` opens that page.
 */
export function CardGrid({ items, className = "grid grid-cols-2 gap-3 lg:grid-cols-4", txPage = "/admin/redemptions", merchantColumn = true }: {
  items: CardItem[]; className?: string; txPage?: string; merchantColumn?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState<string | null>(null);
  const current = items.find((i) => i.key === open && i.tx);
  const qs = (p: Record<string, string | undefined>) => new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <div className="mb-6">
      <div className={className}>
        {items.map((i) => {
          const ring = open === i.key ? "ring-2 ring-perk-purple ring-offset-2 rounded-2xl" : "";
          if (i.tx) {
            return (
              <button key={i.key} type="button" onClick={() => setOpen(open === i.key ? null : i.key)} aria-expanded={open === i.key}
                className={`block min-w-0 text-start transition hover:-translate-y-0.5 ${ring}`}>{i.card}</button>
            );
          }
          return i.href ? <Link key={i.key} href={i.href} className="block min-w-0 transition hover:-translate-y-0.5">{i.card}</Link> : <div key={i.key} className="min-w-0">{i.card}</div>;
        })}
      </div>
      {current?.tx && (
        <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
          <div className="mb-1 flex items-center justify-between gap-3 px-1">
            <h3 className="text-sm font-bold">{current.title ?? t("Transactions")}</h3>
            <button type="button" onClick={() => setOpen(null)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-perk-purple hover:bg-perk-purple/5">
              {t("Hide transactions")}
              <svg className="rotate-180" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
            </button>
          </div>
          <TxPeek key={current.key} params={current.tx} moreHref={`${txPage}?${qs(current.tx)}`} merchantColumn={merchantColumn} />
        </div>
      )}
    </div>
  );
}
