import { requireStaff } from "@/lib/auth";
import { Badge, Card, Input, PageHeader, Select } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AccountSettings } from "@/components/account-settings";
import { SentryTest } from "@/components/sentry-test";
import { getT } from "@/lib/i18n/server";
import { MultiSelect } from "@/components/multi-select";
import { APP_FEATURES, type FeatureCfg } from "@/lib/features";
import { saveAppFeatures, setRefundWindow, setPaymentsMode, setRedemptionRules, setVatRate, setVerificationRules } from "../actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, can, profile, user } = await requireStaff();
  const t = await getT();
  const platform = can("settings");
  const { data: rows } = platform
    ? await supabase.from("app_settings").select("key, value").in("key", ["tax", "payments", "redemption_rules", "student_verification", "features", "refunds"])
    : { data: [] };
  const get = (k: string) => ((rows ?? []).find((r) => r.key === k)?.value ?? {}) as Record<string, unknown>;
  const vat = Number(get("tax").vat_pct ?? 14);
  const mode = String(get("payments").mode ?? "off");
  const limit = Number(get("redemption_rules").max_per_merchant_per_day ?? 4);
  const verifyRequired = get("student_verification").required === true;
  const freeRedemptions = Number(get("student_verification").free_redemptions ?? 0);
  const features = get("features") as FeatureCfg;
  const refundDays = Number(get("refunds").window_days ?? 7);
  const { data: campuses } = platform ? await supabase.from("campuses").select("id, name").order("name") : { data: [] };
  const campusOptions = (campuses ?? []).map((c) => ({ value: c.id, label: c.name }));

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
            <Card title={t("Refunds")}>
              <p className="mb-3 text-xs text-zinc-500">{t("How long after a purchase a student can ask for a refund. The merchant decides; Admin and Operations can step in.")}</p>
              <ActionForm action={setRefundWindow} className="flex flex-wrap items-center gap-2">
                <Input name="window_days" type="number" min="1" max="60" defaultValue={refundDays} className="w-28" />
                <span className="text-sm text-zinc-500">{t("days after the purchase")}</span>
                <SubmitButton variant="secondary">{t("Save")}</SubmitButton>
              </ActionForm>
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
      {platform && (
        <Card className="mt-6" title={t("App features")}>
          <p className="-mt-1 mb-4 text-sm text-zinc-500">
            {t("Show or hide parts of the student app. No new app version needed: students see the change the next time they open or refresh the app. Leave campuses empty for everyone, or pick campuses to turn a feature on only there.")}
          </p>
          <ActionForm action={saveAppFeatures} className="space-y-3">
            {APP_FEATURES.map((f) => {
              const cfg = features[f.key] ?? {};
              return (
                <div key={f.key} className="grid gap-3 rounded-xl border border-zinc-200 p-3 md:grid-cols-[1fr_minmax(0,22rem)] md:items-center">
                  <label className="flex items-start gap-3">
                    <input type="checkbox" name={`on_${f.key}`} defaultChecked={cfg.on !== false} className="mt-1 h-4 w-4 accent-perk-purple" />
                    <span><span className="block text-sm font-semibold">{t(f.label)}</span><span className="block text-xs text-zinc-500">{t(f.hint)}</span></span>
                  </label>
                  <div className="space-y-2">
                    <MultiSelect name={`campuses_${f.key}`} options={campusOptions} defaultValues={cfg.campuses ?? []} placeholder={t("All campuses")} allLabel={t("All campuses")} />
                    {f.key === "language" && (
                      <label className="flex items-center gap-2 text-xs text-zinc-500">
                        {t("When off, everyone uses")}
                        <Select name="language_default" defaultValue={cfg.default ?? "en"} className="w-36">
                          <option value="en">English</option><option value="ar">العربية</option>
                        </Select>
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
            <SubmitButton>{t("Save app features")}</SubmitButton>
          </ActionForm>
        </Card>
      )}
    </>
  );
}
