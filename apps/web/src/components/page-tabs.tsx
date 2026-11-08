"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Tabs at the top of a section, e.g. All partners | New partner */
export function PageTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-zinc-200">
      {tabs.map((t) => {
        const on = path === t.href;
        return (
          <Link key={t.href} href={t.href}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition ${on ? "border-perk-purple text-perk-purple" : "border-transparent text-zinc-500 hover:text-zinc-800"}`}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
