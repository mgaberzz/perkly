import { requireMerchant } from "@/lib/auth";
import { Shell, type NavItem } from "@/components/shell";
import { Badge } from "@/components/ui";
import { switchMerchant } from "./actions";

const NAV: NavItem[] = [
  { href: "/merchant", label: "Dashboard", icon: "📊", exact: true },
  { href: "/merchant/redemptions", label: "Redemptions", icon: "🧾" },
  { href: "/merchant/perks", label: "Perks", icon: "🎁" },
  { href: "/merchant/branches", label: "Branches & QR", icon: "📍" },
  { href: "/merchant/team", label: "Team", icon: "👥" },
  { href: "/merchant/profile", label: "Business profile", icon: "🏪" },
];

export default async function MerchantLayout({ children }: LayoutProps<"/merchant">) {
  const { merchant, memberships, profile, user } = await requireMerchant();
  const top = (
    <div className="mb-2 rounded-2xl bg-zinc-50 p-3">
      {memberships.length > 1 ? (
        <form action={switchMerchant}>
          <select
            name="merchant_id"
            defaultValue={merchant.id}
            className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm font-semibold"
          >
            {memberships.map((m) => <option key={m.merchant.id} value={m.merchant.id}>{m.merchant.name}</option>)}
          </select>
          <button className="mt-2 w-full rounded-lg bg-white px-2 py-1 text-xs font-semibold text-perk-purple ring-1 ring-zinc-200">Switch</button>
        </form>
      ) : (
        <div className="truncate font-bold">{merchant.name}</div>
      )}
      <div className="mt-2 flex gap-1"><Badge>{merchant.status}</Badge><Badge tone="paused">{merchant.plan}</Badge></div>
    </div>
  );
  return (
    <Shell nav={NAV} top={top} user={profile?.full_name ?? user.email ?? ""} badge="Merchant">
      {merchant.status !== "live" && (
        <div className="mb-6 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {merchant.status === "pending"
            ? "Your business isn't live yet. Set up your branches and perks — the Perkly team will switch you on."
            : `Your business is ${merchant.status}. Students can't see or redeem your perks right now.`}
        </div>
      )}
      {children}
    </Shell>
  );
}
