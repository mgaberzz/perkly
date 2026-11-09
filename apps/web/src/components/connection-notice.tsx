"use client";
import { useEffect, useState } from "react";
import { useT } from "./i18n";

/** A small notice at the bottom while the browser is offline, and a short "back online" when it returns. */
export function ConnectionNotice() {
  const t = useT();
  const [state, setState] = useState<"online" | "offline" | "back">("online");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = () => setState("offline");
    const on = () => { setState("back"); timer = setTimeout(() => setState("online"), 2500); };
    if (!navigator.onLine) off();
    window.addEventListener("offline", off); window.addEventListener("online", on);
    return () => { window.removeEventListener("offline", off); window.removeEventListener("online", on); if (timer) clearTimeout(timer); };
  }, []);
  if (state === "online") return null;
  return (
    <div role="status" className={`no-print fixed inset-x-0 bottom-4 z-50 mx-auto w-fit max-w-[calc(100vw-2rem)] rounded-full px-4 py-2 text-center text-sm font-semibold text-white shadow-lg ${state === "back" ? "bg-emerald-600" : "bg-zinc-900"}`}>
      {state === "back" ? t("Back online") : t("You're offline. Changes won't be saved until the connection is back.")}
    </div>
  );
}
