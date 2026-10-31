import { requireAdmin } from "@/lib/auth";
import { Shell, type NavItem } from "@/components/shell";

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "📈", exact: true },
  { href: "/admin/merchants", label: "Merchants", icon: "🏪" },
  { href: "/admin/perks", label: "Perks & approvals", icon: "🎁" },
  { href: "/admin/redemptions", label: "Redemptions", icon: "🧾" },
  { href: "/admin/users", label: "Users", icon: "🎓" },
  { href: "/admin/campuses", label: "Campuses", icon: "🏫" },
  { href: "/admin/quests", label: "Quests", icon: "🎯" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { profile, user } = await requireAdmin();
  return <Shell nav={NAV} user={profile.full_name ?? user.email ?? ""} badge="Admin">{children}</Shell>;
}
