"use client";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, label, exact, count }: { href: string; label: string; icon?: string; exact?: boolean; count?: number }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${
        active ? "bg-perk-purple/10 text-perk-purple" : "text-zinc-600 hover:bg-zinc-100"
      }`}
    >
      <span className="flex-1">{label}</span>
      <Pending />
      {!!count && <span className="rounded-full bg-perk-pink px-2 py-0.5 text-[11px] font-bold text-white">{count}</span>}
    </Link>
  );
}

/** Small spinner while the page this link opens is loading */
function Pending() {
  const { pending } = useLinkStatus();
  return pending ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-perk-purple/30 border-t-perk-purple" /> : null;
}
