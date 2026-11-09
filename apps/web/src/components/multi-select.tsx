"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "./i18n";
import type { SearchOption } from "./search-select";

/**
 * Pick several items from a long list: type to search (name or hidden keyword, e.g. an ID), tick as many as needed.
 * Each choice is sent as a repeated form field (`name`). Chosen items show as removable chips.
 */
export function MultiSelect({ name, options, placeholder, onChange, allLabel }: {
  name: string; options: (SearchOption & { hint?: string })[]; placeholder: string; onChange?: (values: string[]) => void; allLabel?: string;
}) {
  const t = useT();
  const [values, setValues] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  useEffect(() => {
    const form = box.current?.closest("form");
    const reset = () => { setValues([]); setQuery(""); onChange?.([]); };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [onChange]);
  const set = (v: string[]) => { setValues(v); onChange?.(v); };
  const toggle = (v: string) => set(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? options.filter((o) => o.label.toLowerCase().includes(q) || (o.keywords ?? "").toLowerCase().includes(q)) : options;
    return list.slice(0, 80);
  }, [options, query]);
  const byValue = new Map(options.map((o) => [o.value, o]));

  return (
    <div ref={box} className="relative">
      {values.map((v) => <input key={v} type="hidden" name={name} value={v} />)}
      <div className="relative">
        <svg className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-zinc-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input value={query} onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); if (e.key === "Enter") { e.preventDefault(); if (matches[0]) toggle(matches[0].value); } }}
          placeholder={placeholder}
          className="h-11 w-full rounded-xl border border-zinc-300 bg-white ps-9 pe-3 text-sm outline-none focus:border-perk-purple focus:ring-2 focus:ring-perk-purple/20" />
      </div>
      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 rounded-xl border border-zinc-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2 text-xs">
            <span className="text-zinc-500">{t("{n} selected", { n: values.length })}</span>
            <span className="flex gap-3">
              {query && matches.length > 0 && <button type="button" onClick={() => set([...new Set([...values, ...matches.map((m) => m.value)])])} className="font-semibold text-perk-purple">{t("Select all shown")}</button>}
              {values.length > 0 && <button type="button" onClick={() => set([])} className="font-semibold text-zinc-500">{t("Clear")}</button>}
              <button type="button" onClick={() => setOpen(false)} className="font-semibold text-zinc-700">{t("Done")}</button>
            </span>
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {matches.length === 0 && <li className="px-3 py-2 text-sm text-zinc-500">{t("No matches.")}</li>}
            {matches.map((o) => (
              <li key={o.value}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-perk-purple/5">
                  <input type="checkbox" checked={values.includes(o.value)} onChange={() => toggle(o.value)} className="h-4 w-4 accent-perk-purple" />
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.hint && <span className="shrink-0 text-xs text-zinc-400">{o.hint}</span>}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {values.length === 0 && allLabel && <span className="text-xs text-zinc-500">{allLabel}</span>}
        {values.map((v) => (
          <button key={v} type="button" onClick={() => toggle(v)} className="flex items-center gap-1 rounded-full bg-perk-purple/10 py-1 ps-3 pe-2 text-xs font-semibold text-perk-purple hover:bg-perk-purple/20">
            {byValue.get(v)?.label ?? v}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        ))}
      </div>
    </div>
  );
}
