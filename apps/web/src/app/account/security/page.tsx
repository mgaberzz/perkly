import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, homeFor } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { PasskeyManager } from "@/components/passkey";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Security" };

export default async function SecurityPage() {
  const { user, profile } = await getSession();
  if (!user) redirect("/login?next=/account/security");
  const t = await getT();
  const home = await homeFor(profile?.role, user.id);
  return (
    <main className="mx-auto w-full max-w-2xl p-4 md:p-8">
      <Link href={home.startsWith("/login") ? "/" : home} className="text-sm font-semibold text-perk-purple">← {t("Back to the portal")}</Link>
      <div className="mt-4"><PageHeader title={t("Security")} subtitle={user.email ?? ""} /></div>
      <Card title={t("Face ID / fingerprint sign-in")}>
        <p className="mb-4 text-sm text-zinc-500">
          {t("Sign in with one touch on this computer or phone (Face ID, Touch ID, Windows Hello or fingerprint). Your password still works too. You stay signed in on this browser until you sign out.")}
        </p>
        <PasskeyManager />
      </Card>
    </main>
  );
}
