"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "./i18n";

export type FilterField =
  | { name: string; label: string; type: "select"; value?: string; options: { value: string; label: string }[]; all: string }
  | { name: string; label: string; type: "date"; value?: string }
  | { name: string; label: string; type: "toggle"; value?: string };

/**
 * Search box + "Filters" dropdown + removable chips for the active filters.
 * `keep` = other query params to carry along (e.g. drill-downs from Insights).
 */
export function FilterBar({ path, fields, search, keep = {} }: {
  path: string; fields: FilterField[]; search?: { name: string; value?: string; placeholder: string }; keep?: Record<string, string>;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const current: Record<string, string> = { ...keep };
  if (search?.value) current[search.name] = search.value;
  for (const f of fields) if (f.value) current[f.name] = f.value;
  const url = (p: Record<string, string>) => { const q = new URLSearchParams(Object.entries(p).filter(([, v]) => v)); const s = q.toString(); return s ? `${path}?${s}` : path; };
  const go = (p: Record<string, string>) => start(() => router.push(url(p)));
  const active = fields.filter((f) => f.value);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const p: Record<string, string> = { ...keep };
    new FormData(e.currentTarget).forEach((v, k) => { if (typeof v === "string" && v.trim()) p[k] = v.trim(); });
    setOpen(false);
    go(p);
  }
  const chipText = (f: FilterField) => {
    if (f.type === "select") return `${f.label}: ${f.options.find((o) => o.value === f.value)?.label ?? f.value}`;
    if (f.type === "toggle") return f.label;
    return `${f.label}: ${f.value}`;
  };
  const without = (k: string) => { const p = { ...current }; delete p[k]; return url(p); };

  return (
    <div ref={box} className="relative mb-4">
      <form onSubmit={submit} className="flex gap-2">
        {search && (
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <svg className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-zinc-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input name={search.name} defaultValue={search.value} placeholder={search.placeholder} enterKeyHint="search"
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white ps-9 pe-3 text-sm shadow-sm outline-none focus:border-perk-purple focus:ring-2 focus:ring-perk-purple/20" />
          </div>
        )}
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          className={`flex h-11 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-semibold shadow-sm transition ${open || active.length ? "border-perk-purple bg-perk-purple/5 text-perk-purple" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
          {t("Filters")}
          {active.length > 0 && <span className="rounded-full bg-perk-purple px-1.5 text-[11px] font-bold leading-5 text-white">{active.length}</span>}
          <svg className={`transition ${open ? "rotate-180" : ""}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        {pending && <span className="h-5 w-5 self-center animate-spin rounded-full border-2 border-perk-purple/30 border-t-perk-purple" />}

        <div className={`absolute inset-x-0 top-full z-30 mt-2 origin-top rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl transition sm:inset-x-auto sm:start-0 sm:w-[34rem] ${open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"}`}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <label key={f.name} className={`block ${f.type === "toggle" ? "sm:col-span-2" : ""}`}>
                {f.type !== "toggle" && <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">{f.label}</span>}
                {f.type === "select" ? (
                  <select name={f.name} defaultValue={f.value ?? ""} className="h-11 w-full appearance-none rounded-xl border border-zinc-200 bg-zinc-50 bg-[length:12px] bg-[position:right_0.9rem_center] bg-no-repeat px-3 pe-8 text-sm font-medium outline-none focus:border-perk-purple focus:bg-white rtl:bg-[position:left_0.9rem_center]"
                    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='3'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}>
                    <option value="">{f.all}</option>
                    {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : f.type === "date" ? (
                  <input type="date" name={f.name} defaultValue={f.value ?? ""} className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none focus:border-perk-purple focus:bg-white" />
                ) : (
                  <span className="flex h-11 items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold">
                    {f.label}
                    <input type="checkbox" name={f.name} value="1" defaultChecked={!!f.value} className="peer sr-only" />
                    <span className="relative h-6 w-10 rounded-full bg-zinc-300 transition peer-checked:bg-perk-purple after:absolute after:start-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4 rtl:peer-checked:after:-translate-x-4" />
                  </span>
                )}
              </label>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-zinc-100 pt-3">
            <Link href={url({ ...keep, ...(search?.value ? { [search.name]: search.value } : {}) })} onClick={() => setOpen(false)} className="rounded-xl px-3 py-2 text-sm font-semibold text-zinc-500 hover:bg-zinc-100">{t("Clear all")}</Link>
            <button className="perk-gradient rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-sm active:scale-95">{t("Show results")}</button>
          </div>
        </div>
      </form>
      {active.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {active.map((f) => (
            <Link key={f.name} href={without(f.name)} className="flex items-center gap-1.5 rounded-full bg-perk-purple/10 py-1 ps-3 pe-2 text-xs font-semibold text-perk-purple hover:bg-perk-purple/20">
              {chipText(f)} <span className="flex h-4 w-4 items-center justify-center rounded-full bg-perk-purple/20 text-[10px]">✕</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
