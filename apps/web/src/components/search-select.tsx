"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "./i18n";

export type SearchOption = { value: string; label: string; keywords?: string };

/** A searchable dropdown for long lists: type part of a name (or a hidden keyword like an ID), pick from the list. */
export function SearchSelect({ name, options, placeholder, defaultValue = "", onChange }: {
  name: string; options: SearchOption[]; placeholder: string; defaultValue?: string; onChange?: (v: string) => void;
}) {
  const t = useT();
  const [value, setValue] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? options.filter((o) => o.label.toLowerCase().includes(q) || (o.keywords ?? "").toLowerCase().includes(q)) : options;
    return list.slice(0, 60);
  }, [options, query]);
  const pick = (v: string) => { setValue(v); setQuery(""); setOpen(false); onChange?.(v); };
  // Reset when the surrounding form is reset (after a successful save)
  useEffect(() => {
    const form = box.current?.closest("form");
    const reset = () => { setValue(defaultValue); setQuery(""); };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [defaultValue]);

  return (
    <div ref={box} className="relative">
      <input type="hidden" name={name} value={value} />
      <div className="relative">
        <svg className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-zinc-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input
          value={open ? query : selected?.label ?? ""}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter") { e.preventDefault(); if (matches[0]) pick(matches[0].value); }
          }}
          placeholder={selected ? selected.label : placeholder}
          className="h-11 w-full rounded-xl border border-zinc-300 bg-white ps-9 pe-9 text-sm outline-none focus:border-perk-purple focus:ring-2 focus:ring-perk-purple/20"
        />
        {value && (
          <button type="button" onClick={() => pick("")} aria-label={t("Clear")} className="absolute end-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        )}
      </div>
      {open && (
        <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-xl">
          {matches.length === 0 && <li className="px-3 py-2 text-sm text-zinc-500">{t("No matches.")}</li>}
          {matches.map((o) => (
            <li key={o.value}>
              <button type="button" onClick={() => pick(o.value)}
                className={`block w-full px-3 py-2 text-start text-sm hover:bg-perk-purple/5 ${o.value === value ? "font-semibold text-perk-purple" : ""}`}>
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
