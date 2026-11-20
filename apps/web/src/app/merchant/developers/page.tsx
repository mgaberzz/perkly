import Link from "next/link";
import { requireMerchantArea } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import { ApiKeyCard, CreateKeysButton } from "@/components/api-key-card";
import { dateTime } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { revealSecret, saveKeys } from "./actions";

export const metadata = { title: "API keys" };

type Cred = { public_key: string; created_at: string; public_rotated_at: string; secret_rotated_at: string; last_used_at: string | null };

export default async function DevelopersPage() {
  const { supabase, merchant } = await requireMerchantArea("developers");
  const t = await getT();
  const [{ data: cred }, { data: m }] = await Promise.all([
    supabase.from("merchant_api_credentials").select("public_key, created_at, public_rotated_at, secret_rotated_at, last_used_at").eq("merchant_id", merchant.id).maybeSingle<Cred>(),
    supabase.from("merchants").select("api_enabled").eq("id", merchant.id).maybeSingle<{ api_enabled: boolean }>(),
  ]);
  const enabled = m?.api_enabled ?? true;
  return (
    <>
      <PageHeader title={t("API keys")} subtitle={t("Create and manage API keys to connect your cashier system or website to Perkly.")}
        actions={<Link href="/merchant/developers/docs" className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50"><Icon name="doc" size={16} className="me-1.5 inline-block align-[-3px]" />{t("Documentation")}</Link>} />
      {!enabled && <div className="mb-6 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">{t("API access is turned off for your business. Your keys don't work right now. Contact Perkly to turn it on.")}</div>}
      {!cred ? (
        <Card className="max-w-xl">
          <h2 className="text-lg font-bold">{t("No API keys yet")}</h2>
          <p className="mb-4 mt-1 text-sm text-zinc-500">{t("Create a public key and a secret key. Your developer uses them to read your transactions, check a student's code at the cashier and list your perks and branches.")}</p>
          {enabled && <CreateKeysButton create={saveKeys.bind(null, "both")} />}
        </Card>
      ) : (
        <>
          <div className="grid max-w-5xl gap-5 md:grid-cols-2">
            <ApiKeyCard title={t("Public key")} description={t("A non-secret identifier for your business. Safe to use in your website or app.")}
              masked={cred.public_key} value={cred.public_key} recreate={saveKeys.bind(null, "public")}
              meta={t("Created {date}", { date: dateTime(cred.public_rotated_at) })} />
            <ApiKeyCard title={t("Secret key")} description={t("A confidential key that signs in your API requests. Keep it on your server only, never in an app or web page.")}
              masked={`sk_live_${"•".repeat(28)}`} reveal={revealSecret} recreate={saveKeys.bind(null, "secret")}
              meta={`${t("Created {date}", { date: dateTime(cred.secret_rotated_at) })} · ${cred.last_used_at ? t("Last used {date}", { date: dateTime(cred.last_used_at) }) : t("Not used yet")}`} />
          </div>
          <div className="mt-6 max-w-5xl rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-600">
            <b>{t("Keep your secret key safe.")}</b> {t("Anyone with it can read your Perkly transactions. If it leaks, press Recreate: the old key stops working at once. Perkly staff will never ask you for it.")}
          </div>
        </>
      )}
    </>
  );
}
