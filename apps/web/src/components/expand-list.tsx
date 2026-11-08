import type { ReactNode } from "react";

/** Phone list: each item is a card that drops down to show its details. Hidden from 640px up (the table shows there). */
export function ExpandList({ children, empty }: { children: ReactNode; empty?: ReactNode }) {
  const has = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <ul className="space-y-2.5 sm:hidden">
      {has ? children : <li className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">{empty}</li>}
    </ul>
  );
}

export function ExpandItem({ summary, children, accent }: { summary: ReactNode; children: ReactNode; accent?: "purple" | "amber" | "red" }) {
  const bar = accent ? { purple: "before:bg-perk-purple", amber: "before:bg-amber-400", red: "before:bg-red-500" }[accent] : "before:bg-transparent";
  return (
    <li>
      <details className={`group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition open:shadow-md before:absolute before:inset-y-0 before:start-0 before:w-1 ${bar}`}>
        <summary className="flex cursor-pointer list-none items-center gap-3 p-3.5 active:bg-zinc-50 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">{summary}</div>
          <svg className="shrink-0 text-zinc-400 transition group-open:rotate-180" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
        </summary>
        <div className="border-t border-zinc-100 bg-zinc-50/60 px-4 py-2 text-sm">{children}</div>
      </details>
    </li>
  );
}

export function DetailRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-100 py-2 last:border-0">
      <span className="shrink-0 text-xs font-medium text-zinc-500">{label}</span>
      <span className="min-w-0 text-end font-semibold [overflow-wrap:anywhere]">{children}</span>
    </div>
  );
}

/** Round initial badge (merchant / student) */
export function Avatar({ name, src }: { name: string; src?: string | null }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img src={src} alt="" className="h-11 w-11 shrink-0 rounded-xl border border-zinc-100 object-cover" />;
  return <span className="perk-gradient flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-extrabold text-white">{(name.trim()[0] ?? "?").toUpperCase()}</span>;
}
