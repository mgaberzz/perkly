"use client";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useT } from "./i18n";

/** Phone menu: slides in, closes when you tap a link, the backdrop, ✕, or Escape. */
export function MobileMenu({ head, children }: { head: ReactNode; children: ReactNode }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) { setLastPath(path); setOpen(false); } // route changed → close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={t("Menu")} aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 active:scale-95">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      {mounted && createPortal(<>
      <div onClick={() => setOpen(false)} aria-hidden
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} />
      <aside role="dialog" aria-modal="true"
        // a tap on any link inside closes the drawer straight away (the page skeleton shows while it loads)
        onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}
        className={`fixed inset-y-0 end-0 z-50 flex w-[82%] max-w-xs flex-col bg-white shadow-2xl transition-transform duration-200 ease-out ${open ? "translate-x-0" : "ltr:translate-x-full rtl:-translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          {head}
          <button onClick={() => setOpen(false)} aria-label={t("Close")} className="flex h-9 w-9 items-center justify-center rounded-xl text-xl text-zinc-500 hover:bg-zinc-100">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">{children}</div>
      </aside>
      </>, document.body)}
    </>
  );
}
