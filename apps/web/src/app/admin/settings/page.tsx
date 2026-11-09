import { requireStaff } from "@/lib/auth";
import { Badge, Card, Input, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AccountSettings } from "@/components/account-settings";
import { SentryTest } from "@/components/sentry-test";
import { getT } from "@/lib/i18n/server";
import { setPaymentsMode, setRedemptionRules, setVatRate, setVerificationRules } from "../actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, can, profile, user } = await requireStaff();
  const t = await getT();
  const platform = can("settings");
  const { data: rows } = platform
    ? await supabase.from("app_settings").select("key, value").in("key", ["tax", "payments", "redemption_rules", "student_verification"])
    : { data: [] };
  const get = (k: string) => ((rows ?? []).find((r) => r.key === k)?.value ?? {}) as Record<string, unknown>;
  const vat = Number(get("tax").vat_pct ?? 14);
  const mode = String(get("payments").mode ?? "off");
  const limit = Number(get("redemption_rules").max_per_merchant_per_day ?? 4);
  const verifyRequired = get("student_verification").required === true;
  const freeRedemptions = Number(get("student_verification").free_redemptions ?? 0);

  return (
    <>
      <PageHeader title={t("Settings")} subtitle={platform ? t("Your account and Perkly-wide settings.") : t("Your account settings.")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <AccountSettings t={t} name={profile.full_name ?? ""} email={profile.email ?? user.email ?? ""} code={profile.user_code} />
        {platform && (
          <div className="space-y-6">
            <Card title={t("VAT on commission")}>
              <p className="mb-3 text-xs text-zinc-500">{t("Applied to Perkly's commission. 0% turns VAT off for everyone; single merchants can be exempted on their merchant page.")}</p>
              <ActionForm action={setVatRate} className="flex items-center gap-2">
                <Input name="vat_pct" type="number" step="0.01" min="0" max="100" defaultValue={vat} className="w-28" /><span className="text-sm text-zinc-500">%</span>
                <SubmitButton variant="secondary">{t("Save")}</SubmitButton>
              </ActionForm>
            </Card>
            <Card title={t("In-app payments")}>
              <div className="mb-3 flex items-center gap-2 text-sm">{t("Mode")}: <Badge tone={mode === "live" ? "live" : mode === "test" ? "pending" : "paused"}>{t(mode)}</Badge></div>
              <p className="mb-3 text-xs text-zinc-500">{t("Test mode records payments without charging cards. Switch to live once a payment gateway (e.g. Paymob) is connected.")}</p>
              <form action={setPaymentsMode} className="flex gap-2">
                {["off", "test", "live"].map((m) => (
                  <button key={m} name="mode" value={m} disabled={m === "live"} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-zinc-200 disabled:opacity-40 ${m === mode ? "bg-perk-ink text-white" : "bg-white"}`}>{t(m)}</button>
                ))}
              </form>
            </Card>
            <Card title={t("Transaction limit")}>
              <p className="mb-3 text-xs text-zinc-500">{t("How many times a student can use Perkly at the same merchant in one day.")}</p>
              <ActionForm action={setRedemptionRules} className="flex items-center gap-2">
                <Input name="max_per_day" type="number" min="1" max="50" defaultValue={limit} className="w-28" /><span className="text-sm text-zinc-500">{t("per merchant per day")}</span>
                <SubmitButton variant="secondary">{t("Save")}</SubmitButton>
              </ActionForm>
            </Card>
            <Card title={t("Error reporting (Sentry)")}>
              <p className="mb-3 text-xs text-zinc-500">{t("Crashes and errors from the portals and the student app are reported to Sentry automatically, without names or contact details.")}</p>
              <SentryTest />
            </Card>
            <Card title={t("Student verification")}>
              <p className="mb-3 text-xs text-zinc-500">{t("When required, students must have their student ID approved before they can redeem. Turn it on when you launch; keep it off while testing.")}</p>
              <ActionForm action={setVerificationRules} className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" name="required" defaultChecked={verifyRequired} className="h-4 w-4 accent-perk-purple" />
                  {t("Require verification to redeem")}
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input name="free_redemptions" type="number" min="0" max="20" defaultValue={freeRedemptions} className="w-28" />
                  <span className="text-sm text-zinc-500">{t("free redemptions before verifying")}</span>
                  <SubmitButton variant="secondary">{t("Save")}</SubmitButton>
                </div>
              </ActionForm>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
