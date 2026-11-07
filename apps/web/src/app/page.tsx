import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, homeFor } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { getT } from "@/lib/i18n/server";

export default async function Home() {
  const { user, profile } = await getSession();
  if (user) redirect(await homeFor(profile?.role, user.id));
  const t = await getT();
  return (
    <main className="perk-gradient flex min-h-screen flex-col items-center justify-center px-6 text-center text-white">
      <Logo className="text-3xl [&>span:first-child]:bg-white [&>span:first-child]:text-perk-purple" />
      <h1 className="mt-8 max-w-xl text-4xl font-extrabold">{t("Unlock Perks. Live Smart.")}</h1>
      <p className="mt-3 max-w-md text-white/85">{t("Portal for Perkly merchants and the Perkly team.")}</p>
      <Link href="/login" className="mt-8 rounded-2xl bg-white px-6 py-3 font-bold text-perk-purple shadow-lg hover:bg-white/90">
        {t("Sign in")}
      </Link>
    </main>
  );
}
