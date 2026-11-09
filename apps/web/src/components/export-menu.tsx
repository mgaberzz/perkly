"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { useT } from "./i18n";

export type ExportItem = { label: string; kind: string; params?: Record<string, string | undefined> };

const selectCls = "h-11 w-full appearance-none rounded-xl border border-zinc-200 bg-zinc-50 bg-[length:12px] bg-[position:right_0.9rem_center] bg-no-repeat px-3 pe-8 text-sm font-medium outline-none focus:border-perk-purple focus:bg-white rtl:bg-[position:left_0.9rem_center]";
const chevron = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='3'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" };

/** "Export" button: a panel with two dropdowns (what to export, Excel or CSV) and a Download button. */
export function ExportMenu({ items }: { items: ExportItem[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [which, setWhich] = useState(0);
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const it = items[Math.min(which, items.length - 1)];
  const p = new URLSearchParams({ format });
  for (const [k, v] of Object.entries(it?.params ?? {})) if (v) p.set(k, v);
  const href = it ? `/export/${it.kind}?${p}` : "#";

  return (
    <div ref={box} className="relative inline-block">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className={`flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold shadow-sm transition ${open ? "border-perk-purple bg-perk-purple/5 text-perk-purple" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"}`}>
        <Icon name="download" size={16} />
        {t("Export")}
        <svg className={`transition ${open ? "rotate-180" : ""}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="absolute start-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl sm:start-auto sm:end-0">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">{t("What to export")}</span>
            <select value={which} onChange={(e) => setWhich(Number(e.target.value))} disabled={items.length < 2} className={selectCls} style={chevron}>
              {items.map((x, i) => <option key={x.label} value={i}>{x.label}</option>)}
            </select>
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">{t("Format")}</span>
            <select value={format} onChange={(e) => setFormat(e.target.value as "xlsx" | "csv")} className={selectCls} style={chevron}>
              <option value="xlsx">{t("Excel (.xlsx)")}</option>
              <option value="csv">{t("CSV (.csv)")}</option>
            </select>
          </label>
          <a href={href} onClick={() => setOpen(false)} className="perk-gradient mt-4 flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-sm active:scale-95">
            <Icon name="download" size={16} />{t("Download")}
          </a>
        </div>
      )}
    </div>
  );
}
