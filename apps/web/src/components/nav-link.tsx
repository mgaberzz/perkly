"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, label, icon, exact, count }: { href: string; label: string; icon: string; exact?: boolean; count?: number }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${
        active ? "bg-perk-purple/10 text-perk-purple" : "text-zinc-600 hover:bg-zinc-100"
      }`}
    >
      <span className="w-5 text-center">{icon}</span>
      <span className="flex-1">{label}</span>
      {!!count && <span className="rounded-full bg-perk-pink px-2 py-0.5 text-[11px] font-bold text-white">{count}</span>}
    </Link>
  );
}
