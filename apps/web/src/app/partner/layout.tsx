import { requirePartner } from "@/lib/auth";
import { SentryUser } from "@/components/sentry-user";
import { Shell } from "@/components/shell";
import { Badge } from "@/components/ui";
import { dealLabel } from "@/components/partner-form";
import { getT } from "@/lib/i18n/server";

export default async function PartnerLayout({ children }: LayoutProps<"/partner">) {
  const { partner, profile, user } = await requirePartner();
  const t = await getT();
  const nav = [
    { href: "/partner", label: t("Dashboard"), exact: true, icon: "home", group: 0 },
    { href: "/partner/merchants", label: t("My merchants"), icon: "store", group: 1 },
    { href: "/partner/transactions", label: t("Transactions"), icon: "receipt", group: 1 },
    { href: "/partner/payments", label: t("Payments"), icon: "wallet", group: 1 },
    { href: "/partner/settings", label: t("Settings"), icon: "settings", group: 2 },
  ];
  const top = (
    <div className="mb-2 rounded-2xl bg-zinc-50 p-3">
      <div className="truncate font-bold">{partner.name}</div>
      <div className="mt-1 font-mono text-xs text-zinc-500">{partner.partner_code}</div>
      <div className="mt-2 flex flex-wrap gap-1"><Badge tone="active">{dealLabel(partner, t)}</Badge>{partner.status !== "active" && <Badge tone="paused">{t(partner.status)}</Badge>}</div>
    </div>
  );
  return <Shell nav={nav} top={top} user={profile?.full_name ?? user.email ?? ""} badge={t("Partner")}><SentryUser id={user.id} role="partner" />{children}</Shell>;
}
