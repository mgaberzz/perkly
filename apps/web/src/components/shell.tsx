import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./logo";
import { NavLink } from "./nav-link";

export type NavItem = { href: string; label: string; icon: string; exact?: boolean };

export function Shell({ nav, children, top, user, badge }: { nav: NavItem[]; children: ReactNode; top?: ReactNode; user: string; badge: string }) {
  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-zinc-200 bg-white p-4 md:flex">
        <Link href="/" className="mb-1 px-2"><Logo className="text-lg" /></Link>
        <span className="mb-6 px-2 text-xs font-bold uppercase tracking-widest text-perk-pink">{badge}</span>
        {top}
        <nav className="mt-2 flex flex-1 flex-col gap-1">
          {nav.map((n) => <NavLink key={n.href} {...n} />)}
        </nav>
        <div className="border-t border-zinc-200 pt-4">
          <div className="truncate px-2 text-sm font-semibold">{user}</div>
          <form action="/auth/signout" method="post">
            <button className="mt-2 w-full rounded-xl px-2 py-2 text-left text-sm text-zinc-500 hover:bg-zinc-100">Sign out</button>
          </form>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 md:hidden">
          <Logo />
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-xl border border-zinc-300 px-3 py-1.5 text-sm">Menu</summary>
            <div className="absolute right-0 z-20 mt-2 w-56 rounded-2xl border border-zinc-200 bg-white p-2 shadow-lg">
              {top}
              {nav.map((n) => <NavLink key={n.href} {...n} />)}
              <form action="/auth/signout" method="post"><button className="w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-500 hover:bg-zinc-100">Sign out</button></form>
            </div>
          </details>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
