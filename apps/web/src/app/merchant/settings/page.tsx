import { requireMerchant } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { PhoneSettings } from "@/components/phone-settings";
import { sendPhoneCode, verifyPhoneCode } from "../actions";
import { AccountSettings } from "@/components/account-settings";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Settings" };

export default async function MerchantSettings() {
  const { profile, user } = await requireMerchant();
  const t = await getT();
  // The number on the login itself is the one confirmed by SMS
  const authPhone = user.phone ? `+${user.phone.replace(/^\+/, "")}` : null;
  return (
    <>
      <PageHeader title={t("Settings")} subtitle={t("Your account settings.")} />
      <div className="max-w-xl space-y-6">
        <Card title={t("Mobile number")}>
          <PhoneSettings phone={authPhone ?? profile?.phone ?? null} verified={Boolean(authPhone)} send={sendPhoneCode} verify={verifyPhoneCode} />
        </Card>
        <AccountSettings t={t} name={profile?.full_name ?? ""} email={profile?.email ?? user.email ?? ""} code={profile?.user_code} />
      </div>
    </>
  );
}
