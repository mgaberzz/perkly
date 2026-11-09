import Link from "next/link";
import type { ReactNode } from "react";
import { getT } from "@/lib/i18n/server";
import { Logo } from "./logo";
import { NavLink } from "./nav-link";
import { MobileMenu } from "./mobile-menu";
import { TableToggle } from "./table-toggle";
import { Icon } from "./icons";

export type NavItem = { href: string; label: string; icon?: string; exact?: boolean; count?: number; group?: number };

/** Menu items with a thin divider between groups (like Supabase's menu) */
function NavList({ nav }: { nav: NavItem[] }) {
  return (
    <>
      {nav.map((n, i) => (
        <div key={n.href}>
          {i > 0 && (n.group ?? 0) !== (nav[i - 1].group ?? 0) && <div className="mx-3 my-2 border-t border-zinc-200" />}
          <NavLink {...n} />
        </div>
      ))}
    </>
  );
}

export async function Shell({ nav, children, top, user, badge }: { nav: NavItem[]; children: ReactNode; top?: ReactNode; user: string; badge: string }) {
  const t = await getT();
  const signOut = (cls: string) => (
    <form action="/auth/signout" method="post"><button className={cls}>{t("Sign out")}</button></form>
  );
  // Floating round buttons above the phone menu: Home, Notifications (if any), Settings, Sign out
  const settings = nav.find((n) => n.href.endsWith("/settings"));
  const bell = nav.find((n) => n.href.endsWith("/notifications"));
  const round = "flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 active:scale-95";
  const quick = (
    <>
      <Link href="/" aria-label={t("Home")} className={round}><Icon name="home" /></Link>
      {bell && <Link href={bell.href} aria-label={bell.label} className={`${round} relative`}><Icon name="bell" />{!!bell.count && <span className="absolute -end-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-perk-pink" />}</Link>}
      {settings && <Link href={settings.href} aria-label={settings.label} className={round}><Icon name="settings" /></Link>}
      <form action="/auth/signout" method="post"><button aria-label={t("Sign out")} className={round}><Icon name="logout" /></button></form>
    </>
  );
  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-e border-zinc-200 bg-white p-4 md:flex">
        <Link href="/" className="mb-1 px-2"><Logo className="text-lg" /></Link>
        <span className="mb-6 px-2 text-xs font-bold uppercase tracking-widest text-perk-pink">{badge}</span>
        {top}
        <nav className="mt-2 flex flex-1 flex-col gap-0.5 overflow-y-auto"><NavList nav={nav} /></nav>
        <div className="border-t border-zinc-200 pt-4">
          <div className="truncate px-2 text-sm font-semibold">{user}</div>
          {signOut("w-full rounded-xl px-3 py-2 text-start text-sm text-zinc-500 hover:bg-zinc-100")}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Menu button at the start (left in English, right in Arabic); logo in the middle */}
        <header className="no-print sticky top-0 z-30 grid grid-cols-[3rem_1fr_3rem] items-center border-b border-zinc-200 bg-white/90 px-4 py-2.5 backdrop-blur md:hidden">
          <MobileMenu quick={quick}>
            {top}
            <nav className="flex flex-col gap-0.5"><NavList nav={nav} /></nav>
            <div className="mx-3 my-2 border-t border-zinc-200" />
            <div className="truncate px-3 py-1 text-xs text-zinc-500">{user}</div>
          </MobileMenu>
          <Link href="/" aria-label={t("Home")} className="justify-self-center rounded-xl active:opacity-70"><Logo /></Link>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">{children}</main>
        <TableToggle />
      </div>
    </div>
  );
}
