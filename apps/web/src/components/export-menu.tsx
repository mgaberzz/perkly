"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { useT } from "./i18n";

export type ExportItem = { label: string; kind: string; params?: Record<string, string | undefined> };

/** "Export" button with a dropdown of downloads (Excel / CSV each), styled like the Filters button. */
export function ExportMenu({ items }: { items: ExportItem[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const href = (it: ExportItem, format: string) => {
    const p = new URLSearchParams({ format });
    for (const [k, v] of Object.entries(it.params ?? {})) if (v) p.set(k, v);
    return `/export/${it.kind}?${p}`;
  };
  const fmt = "rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:border-perk-purple hover:text-perk-purple";
  return (
    <div ref={box} className="relative inline-block">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className={`flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold shadow-sm transition ${open ? "border-perk-purple bg-perk-purple/5 text-perk-purple" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"}`}>
        <Icon name="download" size={16} />
        {t("Export")}
        <svg className={`transition ${open ? "rotate-180" : ""}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      <div className={`absolute start-0 top-full z-30 mt-2 w-72 sm:start-auto sm:end-0 max-w-[calc(100vw-2rem)] origin-top rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl transition ${open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"}`}>
        {items.map((it) => (
          <div key={it.label} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-zinc-50">
            <span className="text-sm font-medium">{it.label}</span>
            <span className="flex shrink-0 gap-1.5">
              <a href={href(it, "xlsx")} onClick={() => setOpen(false)} className={fmt}>{t("Excel")}</a>
              <a href={href(it, "csv")} onClick={() => setOpen(false)} className={fmt}>CSV</a>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
