import { merchantCan, requireMerchant, type MerchantArea } from "@/lib/auth";
import { Shell, type NavItem } from "@/components/shell";
import { Badge } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { MEMBER_ROLE_LABEL } from "@/lib/labels";
import { switchMerchant } from "./actions";

export default async function MerchantLayout({ children }: LayoutProps<"/merchant">) {
  const { merchant, memberships, profile, user, memberRole, branchScope } = await requireMerchant();
  const t = await getT();
  const online = merchant.channel !== "in_store";
  const items: (NavItem & { area: MerchantArea })[] = [
    { area: "dashboard", href: "/merchant", label: branchScope ? t("My branch dashboard") : t("Dashboard"), icon: "📊", exact: true },
    { area: "transactions", href: "/merchant/redemptions", label: t("Transactions"), icon: "🧾" },
    ...(online ? [{ area: "online" as const, href: "/merchant/online", label: t("Online orders"), icon: "🌐" }] : []),
    { area: "perks", href: "/merchant/perks", label: t("Perks"), icon: "🎁" },
    { area: "branches", href: "/merchant/branches", label: branchScope ? t("My branch & QR") : t("Branches & QR"), icon: "📍" },
    { area: "payouts", href: "/merchant/payouts", label: t("Payouts"), icon: "💰" },
    { area: "team", href: "/merchant/team", label: t("Team"), icon: "👥" },
    { area: "profile", href: "/merchant/profile", label: t("Business profile"), icon: "🏪" },
  ];
  // Each staff role sees only its own areas
  const nav: NavItem[] = items.filter((i) => merchantCan(memberRole, i.area)).map((i) => ({ href: i.href, label: i.label, icon: i.icon, exact: i.exact }));
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
      {branchScope && <div className="mt-1 truncate text-xs text-zinc-500">📍 {branchScope.name}</div>}
      <div className="mt-2 flex flex-wrap gap-1"><Badge tone={merchant.status}>{t(merchant.status)}</Badge><Badge tone={memberRole}>{t(MEMBER_ROLE_LABEL[memberRole])}</Badge></div>
    </div>
  );
  return (
    <Shell nav={nav} top={top} user={profile?.full_name ?? user.email ?? ""} badge={t("Merchant")}>
      {merchant.status !== "live" && (
        <div className="mb-6 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {merchant.status === "pending"
            ? t("Your business isn't live yet. Set up your branches and perks — the Perkly team will switch you on.")
            : t("Your business is {status}. Students can't see or redeem your perks right now.", { status: t(merchant.status) })}
        </div>
      )}
      {children}
    </Shell>
  );
}
