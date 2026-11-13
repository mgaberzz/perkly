import { Icon } from "@/components/icons";
import { merchantCan, requireMerchant, type MerchantArea } from "@/lib/auth";
import { SentryUser } from "@/components/sentry-user";
import { Shell, type NavItem } from "@/components/shell";
import { Badge } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { MEMBER_ROLE_LABEL } from "@/lib/labels";
import Link from "next/link";
import { switchMerchant } from "./actions";

export default async function MerchantLayout({ children }: LayoutProps<"/merchant">) {
  const { merchant, memberships, profile, user, memberRole, branchScope, supabase } = await requireMerchant();
  const t = await getT();
  const online = merchant.channel !== "in_store";
  // Refund requests waiting for this merchant (RLS limits branch managers to their branch)
  const { count: refunds } = merchantCan(memberRole, "refunds")
    ? await supabase.from("refund_requests").select("*", { count: "exact", head: true }).eq("merchant_id", merchant.id).eq("status", "pending")
    : { count: 0 };
  const { count: refundsLate } = refunds
    ? await supabase.from("refund_requests").select("*", { count: "exact", head: true }).eq("merchant_id", merchant.id).eq("status", "pending").lt("created_at", daysAgo(3))
    : { count: 0 };
  const items: (NavItem & { area: MerchantArea })[] = [
    { area: "dashboard", href: "/merchant", label: branchScope ? t("My branch dashboard") : t("Dashboard"), icon: "home", group: 0, exact: true },
    { area: "transactions", href: "/merchant/redemptions", label: t("Transactions"), icon: "receipt", group: 0 },
    { area: "refunds", href: "/merchant/refunds", label: t("Refunds"), icon: "undo", group: 0, count: refunds || undefined },
    { area: "reviews", href: "/merchant/reviews", label: t("Reviews"), icon: "flag", group: 0 },
    ...(online ? [{ area: "online" as const, href: "/merchant/online", label: t("Online orders"), icon: "globe", group: 0 }] : []),
    { area: "perks", href: "/merchant/perks", label: t("Perks"), icon: "gift", group: 1 },
    { area: "branches", href: "/merchant/branches", label: branchScope ? t("My branch & QR") : t("Branches & QR"), icon: "qr", group: 1 },
    { area: "payouts", href: "/merchant/payouts", label: t("Payouts"), icon: "wallet", group: 2 },
    { area: "team", href: "/merchant/team", label: t("Team"), icon: "team", group: 2 },
    { area: "profile", href: "/merchant/profile", label: t("Business profile"), icon: "building", group: 2 },
  ];
  // Each staff role sees only its own areas
  const nav: NavItem[] = [...items.filter((i) => merchantCan(memberRole, i.area)).map((i) => ({ href: i.href, label: i.label, exact: i.exact, icon: i.icon, group: i.group, count: i.count })),
    { href: "/merchant/settings", label: t("Settings"), icon: "settings", group: 3 }];
  const top = (
    <div className="mb-2 rounded-2xl bg-zinc-50 p-3">
      {memberships.length > 1 ? (
        <form action={switchMerchant}>
          <select name="merchant_id" defaultValue={merchant.id} className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm font-semibold">
            {memberships.map((m) => <option key={m.merchant.id} value={m.merchant.id}>{m.merchant.name}</option>)}
          </select>
          <button className="mt-2 w-full rounded-lg bg-white px-2 py-1 text-xs font-semibold text-perk-purple ring-1 ring-zinc-200">{t("Switch")}</button>
        </form>
      ) : (
        <div className="truncate font-bold">{merchant.name}</div>
      )}
      <div className="mt-1 font-mono text-xs text-zinc-500">{merchant.merchant_code}</div>
      {branchScope && <div className="mt-1 truncate text-xs text-zinc-500"><Icon name="pin" size={12} className="me-1 inline-block align-[-2px]" />{branchScope.name}</div>}
      <div className="mt-2 flex flex-wrap gap-1"><Badge tone={merchant.status}>{t(merchant.status)}</Badge><Badge tone={memberRole}>{t(MEMBER_ROLE_LABEL[memberRole])}</Badge></div>
    </div>
  );
  return (
    <Shell nav={nav} top={top} user={profile?.full_name ?? user.email ?? ""} badge={t("Merchant")}>
      <SentryUser id={user.id} role={`merchant_${memberRole}`} />
      {merchant.status !== "live" && (
        <div className="mb-6 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {merchant.status === "pending"
            ? t("Your business isn't live yet. Set up your branches and perks — the Perkly team will switch you on.")
            : t("Your business is {status}. Students can't see or redeem your perks right now.", { status: t(merchant.status) })}
        </div>
      )}
      {!!refunds && (
        <Link href="/merchant/refunds" className={`mb-6 flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-medium ${refundsLate ? "bg-red-50 text-red-800" : "bg-perk-purple/10 text-perk-purple"}`}>
          <span>
            {refundsLate
              ? t("Refund requests waiting more than 3 days: {n}. Students are waiting for your answer; the Perkly team may decide for you.", { n: refundsLate })
              : t("Refund requests waiting for your answer: {n}.", { n: refunds })}
          </span>
          <span className="shrink-0 font-bold">{t("Review")} →</span>
        </Link>
      )}
      {children}
    </Shell>
  );
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86400_000).toISOString();
}
