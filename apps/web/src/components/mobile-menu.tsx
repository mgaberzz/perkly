"use client";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";
import { useT } from "./i18n";

/**
 * Phone menu, styled like Supabase's: a sheet that slides up from the bottom with grouped items,
 * plus a floating bar of round quick buttons and a ✕ above it. Closes on link tap, backdrop, ✕ or Escape.
 */
export function MobileMenu({ quick, children }: { quick?: ReactNode; children: ReactNode }) {
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
  const closeOnLink = (e: React.MouseEvent) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); };
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={t("Menu")} aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 active:scale-95">
        <Icon name="menu" />
      </button>
      {mounted && createPortal(<>
        <div onClick={() => setOpen(false)} aria-hidden
          className={`fixed inset-0 z-40 bg-zinc-900/20 backdrop-blur-sm transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} />
        <div role="dialog" aria-modal="true" onClick={closeOnLink}
          className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col transition-transform duration-300 ease-out ${open ? "translate-y-0" : "pointer-events-none translate-y-full"}`}>
          {/* floating quick bar + close */}
          <div className="mb-3 flex items-center justify-center gap-3 px-4">
            <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white/95 p-2 shadow-lg">{quick}</div>
            <button onClick={() => setOpen(false)} aria-label={t("Close")}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-lg active:scale-95">
              <Icon name="x" />
            </button>
          </div>
          {/* sheet */}
          <div className="min-h-0 flex-1 overflow-y-auto rounded-t-3xl border-t border-zinc-200 bg-white px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl">
            {children}
          </div>
        </div>
      </>, document.body)}
    </>
  );
}
