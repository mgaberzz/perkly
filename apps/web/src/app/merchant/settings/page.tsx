import { requireMerchant } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { AccountSettings } from "@/components/account-settings";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Settings" };

export default async function MerchantSettings() {
  const { profile, user } = await requireMerchant();
  const t = await getT();
  return (
    <>
      <PageHeader title={t("Settings")} subtitle={t("Your account settings.")} />
      <div className="max-w-xl"><AccountSettings t={t} name={profile?.full_name ?? ""} email={profile?.email ?? user.email ?? ""} code={profile?.user_code} /></div>
    </>
  );
}
