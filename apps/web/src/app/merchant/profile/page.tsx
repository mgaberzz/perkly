import { requireMerchantArea } from "@/lib/auth";
import { Card, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { getT } from "@/lib/i18n/server";
import { BRAND_TYPE_LABEL, CHANNEL_LABEL } from "@/lib/labels";
import { updateProfile } from "../actions";

export const metadata = { title: "Business profile" };

export default async function ProfilePage() {
  const { merchant, canManage } = await requireMerchantArea("profile");
  const t = await getT();
  const row = (k: string, v: string) => <div className="flex justify-between gap-3"><dt className="text-zinc-500">{k}</dt><dd className="text-end font-semibold">{v}</dd></div>;
  return (
    <>
      <PageHeader title={t("Business profile")} subtitle={t("What students see on your page in the app.")} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {canManage ? (
            <ActionForm action={updateProfile} className="space-y-4">
              <Field label={t("Business name")}><Input name="name" defaultValue={merchant.name} required /></Field>
              <Field label={t("Description")}><Textarea name="description" defaultValue={merchant.description ?? ""} /></Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t("Logo URL")} hint={t("Square image, at least 256px")}><Input name="logo_url" type="url" defaultValue={merchant.logo_url ?? ""} /></Field>
                <Field label={t("Cover image URL")}><Input name="cover_url" type="url" defaultValue={merchant.cover_url ?? ""} /></Field>
                <Field label={t("Contact name")}><Input name="contact_name" defaultValue={merchant.contact_name ?? ""} /></Field>
                <Field label={t("Contact phone")}><Input name="contact_phone" defaultValue={merchant.contact_phone ?? ""} /></Field>
                <Field label={t("Contact email")}><Input name="contact_email" type="email" defaultValue={merchant.contact_email ?? ""} /></Field>
              </div>
              <SubmitButton>{t("Save profile")}</SubmitButton>
            </ActionForm>
          ) : <p className="text-sm text-zinc-500">{t("Only owners and managers can edit the profile.")}</p>}
        </Card>
        <Card title={t("Your account")}>
          <dl className="space-y-3 text-sm">
            {row(t("Merchant ID"), merchant.merchant_code)}
            {row(t("Category"), t(merchant.category))}
            {row(t("Brand type"), t(BRAND_TYPE_LABEL[merchant.brand_type] ?? merchant.brand_type))}
            {row(t("Sells"), t(CHANNEL_LABEL[merchant.channel]))}
            {row(t("Plan"), merchant.plan === "pro" ? "Pro" : "Free")}
            {row(t("Perkly commission"), `${merchant.commission_pct}%`)}
            {row(t("VAT on commission"), merchant.vat_enabled ? t("Yes") : t("No"))}
          </dl>
          {merchant.plan === "free" && (
            <p className="mt-4 rounded-xl bg-perk-purple/10 p-3 text-sm text-perk-purple">
              {t("Perkly Pro: heat maps, campus segmentation, push campaigns and priority listing. Talk to your Perkly contact.")}
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
