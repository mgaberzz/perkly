import Link from "next/link";
import { merchantCan, requireMerchant, type MerchantArea } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import { TourButton } from "@/components/merchant-tour";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Settings" };

type Item = { href: string; icon: string; title: string; text: string; area?: MerchantArea };

export default async function MerchantSettingsHub() {
  const { memberRole } = await requireMerchant();
  const t = await getT();
  const groups: { title: string; items: Item[] }[] = [
    { title: t("Account"), items: [
      { href: "/merchant/settings/profile", icon: "user", title: t("Profile details"), text: t("Your name, email, mobile number, password and sign-in.") },
      { href: "/merchant/profile", icon: "building", title: t("Business profile"), text: t("Logo, description and contact details students see."), area: "profile" },
      { href: "/merchant/team", icon: "team", title: t("Team & access"), text: t("Invite managers, branch managers and cashiers; resend invites."), area: "team" },
      { href: "/merchant/branches", icon: "qr", title: t("Branches & cashier QR"), text: t("Branches, opening hours and the QR codes on your cashier tables."), area: "branches" },
      { href: "/merchant/payouts", icon: "wallet", title: t("Bank & payouts"), text: t("Your bank account, balance and settlements with Perkly."), area: "payouts" },
    ] },
    { title: t("Reports"), items: [
      { href: "/merchant/statements", icon: "doc", title: t("Reports & statements"), text: t("Monthly statements to print or save as PDF."), area: "statements" },
    ] },
    { title: t("Developers"), items: [
      { href: "/merchant/developers", icon: "key", title: t("API keys"), text: t("Create and manage keys to connect your cashier system or website."), area: "developers" },
      { href: "/merchant/developers/docs", icon: "code", title: t("Documentation"), text: t("How to use the Perkly API, with examples."), area: "developers" },
    ] },
  ];
  return (
    <>
      <PageHeader title={t("Settings")} subtitle={t("Manage your account, your business and your integrations.")} />
      <div className="max-w-5xl space-y-8">
        {groups.map((g) => {
          const items = g.items.filter((i) => !i.area || merchantCan(memberRole, i.area));
          if (!items.length) return null;
          return (
            <section key={g.title}>
              <h2 className="mb-3 text-lg font-bold">{g.title}</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {items.map((i) => (
                  <Link key={i.href} href={i.href} className="flex items-start gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-perk-purple/40 hover:shadow">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-perk-purple/10 text-perk-purple"><Icon name={i.icon} size={20} /></span>
                    <span><span className="block font-bold">{i.title}</span><span className="mt-1 block text-sm text-zinc-500">{i.text}</span></span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
        <section>
          <h2 className="mb-3 text-lg font-bold">{t("Help")}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <TourButton />
            <a href="mailto:support@perklyapp.co" className="flex items-start gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-perk-purple/40 hover:shadow">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-perk-purple/10 text-perk-purple"><Icon name="send" size={20} /></span>
              <span><span className="block font-bold">{t("Contact Perkly")}</span><span className="mt-1 block text-sm text-zinc-500">support@perklyapp.co</span></span>
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
