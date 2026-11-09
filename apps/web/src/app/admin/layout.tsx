import { can, requireStaff, type Perm } from "@/lib/auth";
import { SentryUser } from "@/components/sentry-user";
import { Shell, type NavItem } from "@/components/shell";
import { getT } from "@/lib/i18n/server";
import { ROLE_LABEL } from "@/lib/labels";

const NAV: (NavItem & { perm: Perm })[] = [
  { href: "/admin", label: "Overview", icon: "home", group: 0, exact: true, perm: "overview" },
  { href: "/admin/insights", label: "Insights", icon: "chart", group: 0, perm: "insights" },
  { href: "/admin/notifications", label: "Notifications", icon: "bell", group: 0, perm: "notifications" },
  { href: "/admin/merchants", label: "Merchants", icon: "store", group: 1, perm: "merchants_view" },
  { href: "/admin/partners", label: "Partners", icon: "handshake", group: 1, perm: "partners_view" },
  { href: "/admin/perks", label: "Campaigns & perks", icon: "gift", group: 1, perm: "perks" },
  { href: "/admin/broadcasts", label: "Push notifications", icon: "send", group: 1, perm: "broadcasts" },
  { href: "/admin/redemptions", label: "Transactions", icon: "receipt", group: 1, perm: "redemptions_view" },
  { href: "/admin/finance", label: "Finance", icon: "wallet", group: 2, perm: "finance" },
  { href: "/admin/verifications", label: "Student verification", icon: "shield", group: 3, perm: "verifications" },
  { href: "/admin/users", label: "Users & roles", icon: "users", group: 3, perm: "users" },
  { href: "/admin/team", label: "Team & assignments", icon: "team", group: 3, perm: "users" },
  { href: "/admin/campuses", label: "Campuses", icon: "school", group: 3, perm: "campuses_view" },
  { href: "/admin/quests", label: "Quests", icon: "target", group: 3, perm: "quests" },
  { href: "/admin/settings", label: "Settings", icon: "settings", group: 4, perm: "overview" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { profile, user, role, supabase } = await requireStaff();
  const t = await getT();
  // Open requests this person can act on (RLS scopes the count)
  const [{ count }, { count: toVerify }] = await Promise.all([
    supabase.from("admin_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
    can(role, "verifications") ? supabase.from("student_verifications").select("*", { count: "exact", head: true }).eq("status", "pending") : Promise.resolve({ count: 0 }),
  ]);
  // Account managers see "My …" because they only ever see their own merchants and campuses
  const mine: Record<string, string> = role === "account_manager"
    ? { "/admin/merchants": "My merchants", "/admin/campuses": "My campuses", "/admin/perks": "My campaigns", "/admin/redemptions": "My transactions" }
    : role === "finance" ? { "/admin/merchants": "Merchants (view)" } : {};
  const nav = NAV.filter((n) => can(role, n.perm)).map((n) => ({
    href: n.href, icon: n.icon, group: n.group, exact: n.exact, label: t(mine[n.href] ?? n.label), count: n.href === "/admin/notifications" ? count ?? 0 : n.href === "/admin/verifications" ? toVerify ?? 0 : undefined,
  }));
  return <Shell nav={nav} user={profile.full_name ?? user.email ?? ""} badge={`Perkly · ${t(ROLE_LABEL[role])}`}><SentryUser id={user.id} role={role} />{children}</Shell>;
}
