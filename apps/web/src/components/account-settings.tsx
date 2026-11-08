import Link from "next/link";
import { Card } from "@/components/ui";
import { LangSwitch } from "@/components/lang-switch";

/** Personal settings shown in every portal: language, Face ID / fingerprint, password. */
export function AccountSettings({ t, name, email, code }: { t: (s: string, v?: Record<string, string | number>) => string; name: string; email: string; code?: string | null }) {
  const row = "flex items-center justify-between gap-3 border-b border-zinc-100 py-3 last:border-0";
  return (
    <Card title={t("Your account")}>
      <div className={row}><span className="text-sm text-zinc-500">{t("Name")}</span><span className="text-sm font-semibold">{name || "—"}</span></div>
      <div className={row}><span className="text-sm text-zinc-500">{t("Email")}</span><span className="truncate text-sm font-semibold">{email}</span></div>
      {code && <div className={row}><span className="text-sm text-zinc-500">{t("User ID")}</span><span className="font-mono text-sm font-semibold">{code}</span></div>}
      <div className={row}><span className="text-sm text-zinc-500">{t("Language")}</span><LangSwitch className="[&_button]:w-auto [&_button]:text-perk-purple" /></div>
      <div className={row}><span className="text-sm text-zinc-500">{t("Face ID / fingerprint")}</span><Link href="/account/security" className="text-sm font-semibold text-perk-purple hover:underline">{t("Manage")} →</Link></div>
      <div className={row}><span className="text-sm text-zinc-500">{t("Password")}</span><Link href="/account/password" className="text-sm font-semibold text-perk-purple hover:underline">{t("Change")} →</Link></div>
    </Card>
  );
}
