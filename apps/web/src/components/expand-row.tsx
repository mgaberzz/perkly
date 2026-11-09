import type { ReactNode } from "react";

/** A row that opens in place to show its details (e.g. a merchant's transactions), and closes again. */
export function ExpandRow({ summary, children, openLabel, closeLabel }: { summary: ReactNode; children: ReactNode; openLabel: string; closeLabel: string }) {
  return (
    <details className="group rounded-2xl border border-zinc-200 bg-white shadow-sm open:shadow-md">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-6 gap-y-2 p-4 [&::-webkit-details-marker]:hidden">
        {summary}
        <span className="ms-auto inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-perk-purple group-hover:bg-perk-purple/5">
          <span className="group-open:hidden">{openLabel}</span>
          <span className="hidden group-open:inline">{closeLabel}</span>
          <svg className="transition group-open:rotate-180" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
        </span>
      </summary>
      <div className="border-t border-zinc-100 p-3">{children}</div>
    </details>
  );
}
