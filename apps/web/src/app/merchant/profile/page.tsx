import { requireMerchant } from "@/lib/auth";
import { Card, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { updateProfile } from "../actions";

export const metadata = { title: "Business profile" };

export default async function ProfilePage() {
  const { merchant, canManage } = await requireMerchant();
  return (
    <>
      <PageHeader title="Business profile" subtitle="What students see on your page in the app." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {canManage ? (
            <ActionForm action={updateProfile} className="space-y-4">
              <Field label="Business name"><Input name="name" defaultValue={merchant.name} required /></Field>
              <Field label="Description"><Textarea name="description" defaultValue={merchant.description ?? ""} /></Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Logo URL" hint="Square image, at least 256px"><Input name="logo_url" type="url" defaultValue={merchant.logo_url ?? ""} /></Field>
                <Field label="Cover image URL"><Input name="cover_url" type="url" defaultValue={merchant.cover_url ?? ""} /></Field>
                <Field label="Contact name"><Input name="contact_name" defaultValue={merchant.contact_name ?? ""} /></Field>
                <Field label="Contact phone"><Input name="contact_phone" defaultValue={merchant.contact_phone ?? ""} /></Field>
                <Field label="Contact email"><Input name="contact_email" type="email" defaultValue={merchant.contact_email ?? ""} /></Field>
              </div>
              <SubmitButton>Save profile</SubmitButton>
            </ActionForm>
          ) : <p className="text-sm text-zinc-500">Only owners and managers can edit the profile.</p>}
        </Card>
        <Card title="Your plan">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-zinc-500">Category</dt><dd className="font-semibold">{merchant.category}</dd></div>
            <div className="flex justify-between"><dt className="text-zinc-500">Plan</dt><dd className="font-semibold capitalize">{merchant.plan}</dd></div>
            <div className="flex justify-between"><dt className="text-zinc-500">Perkly commission</dt><dd className="font-semibold">{merchant.commission_pct}%</dd></div>
          </dl>
          {merchant.plan === "free" && (
            <p className="mt-4 rounded-xl bg-perk-purple/10 p-3 text-sm text-perk-purple">
              Perkly Pro: heat maps, campus segmentation, push campaigns and priority listing. Talk to your Perkly contact.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
