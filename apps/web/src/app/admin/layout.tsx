import { can, requireStaff, type Perm } from "@/lib/auth";
import { Shell, type NavItem } from "@/components/shell";
import { getT } from "@/lib/i18n/server";
import { ROLE_LABEL } from "@/lib/labels";

const NAV: (NavItem & { perm: Perm })[] = [
  { href: "/admin", label: "Overview", icon: "📈", exact: true, perm: "overview" },
  { href: "/admin/insights", label: "Insights", icon: "📊", perm: "insights" },
  { href: "/admin/notifications", label: "Notifications", icon: "🔔", perm: "notifications" },
  { href: "/admin/merchants", label: "Merchants", icon: "🏪", perm: "merchants_view" },
  { href: "/admin/perks", label: "Campaigns & perks", icon: "🎁", perm: "perks" },
  { href: "/admin/redemptions", label: "Transactions", icon: "🧾", perm: "redemptions_view" },
  { href: "/admin/finance", label: "Finance & settlements", icon: "💰", perm: "finance" },
  { href: "/admin/users", label: "Users & roles", icon: "🎓", perm: "users" },
  { href: "/admin/team", label: "Team & assignments", icon: "🧑‍💼", perm: "users" },
  { href: "/admin/campuses", label: "Campuses", icon: "🏫", perm: "campuses_view" },
  { href: "/admin/quests", label: "Quests", icon: "🎯", perm: "quests" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { profile, user, role, supabase } = await requireStaff();
  const t = await getT();
  // Open requests this person can act on (RLS scopes the count)
  const { count } = await supabase.from("admin_requests").select("*", { count: "exact", head: true }).eq("status", "pending");
  // Account managers see "My …" because they only ever see their own merchants and campuses
  const mine: Record<string, string> = role === "account_manager"
    ? { "/admin/merchants": "My merchants", "/admin/campuses": "My campuses", "/admin/perks": "My campaigns", "/admin/redemptions": "My transactions" }
    : role === "finance" ? { "/admin/merchants": "Merchants (view)" } : {};
  const nav = NAV.filter((n) => can(role, n.perm)).map((n) => ({
    href: n.href, icon: n.icon, exact: n.exact, label: t(mine[n.href] ?? n.label), count: n.href === "/admin/notifications" ? count ?? 0 : undefined,
  }));
  return <Shell nav={nav} user={profile.full_name ?? user.email ?? ""} badge={`Perkly · ${t(ROLE_LABEL[role])}`}>{children}</Shell>;
}
