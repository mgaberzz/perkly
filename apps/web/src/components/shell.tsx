import Link from "next/link";
import type { ReactNode } from "react";
import { getT } from "@/lib/i18n/server";
import { LangSwitch } from "./lang-switch";
import { Logo } from "./logo";
import { NavLink } from "./nav-link";

export type NavItem = { href: string; label: string; icon: string; exact?: boolean; count?: number };

export async function Shell({ nav, children, top, user, badge }: { nav: NavItem[]; children: ReactNode; top?: ReactNode; user: string; badge: string }) {
  const t = await getT();
  const signOut = (cls: string) => (
    <form action="/auth/signout" method="post"><button className={cls}>{t("Sign out")}</button></form>
  );
  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-e border-zinc-200 bg-white p-4 md:flex">
        <Link href="/" className="mb-1 px-2"><Logo className="text-lg" /></Link>
        <span className="mb-6 px-2 text-xs font-bold uppercase tracking-widest text-perk-pink">{badge}</span>
        {top}
        <nav className="mt-2 flex flex-1 flex-col gap-1 overflow-y-auto">
          {nav.map((n) => <NavLink key={n.href} {...n} />)}
        </nav>
        <div className="border-t border-zinc-200 pt-4">
          <div className="truncate px-2 text-sm font-semibold">{user}</div>
          <Link href="/account/security" className="mt-1 block rounded-xl px-3 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100">🔐 {t("Face ID / fingerprint")}</Link>
          <LangSwitch />
          {signOut("w-full rounded-xl px-3 py-2 text-start text-sm text-zinc-500 hover:bg-zinc-100")}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 md:hidden">
          <Logo />
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-xl border border-zinc-300 px-3 py-1.5 text-sm">{t("Menu")}</summary>
            <div className="absolute end-0 z-20 mt-2 max-h-[80vh] w-64 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-2 shadow-lg">
              {top}
              {nav.map((n) => <NavLink key={n.href} {...n} />)}
              <Link href="/account/security" className="block rounded-xl px-3 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100">🔐 {t("Face ID / fingerprint")}</Link>
              <LangSwitch />
              {signOut("w-full rounded-xl px-3 py-2 text-start text-sm text-zinc-500 hover:bg-zinc-100")}
            </div>
          </details>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
