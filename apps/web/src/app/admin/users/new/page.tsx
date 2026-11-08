import { requireAdmin } from "@/lib/auth";
import { Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PageTabs } from "@/components/page-tabs";
import { getT } from "@/lib/i18n/server";
import { ROLE_LABEL } from "@/lib/labels";
import { inviteTeamMember } from "../../actions";

export const metadata = { title: "New user" };

export default async function NewUserPage() {
  await requireAdmin();
  const t = await getT();
  return (
    <>
      <PageHeader title={t("Users & roles")} subtitle={t("Invite a Perkly team member. Merchant staff are added on the merchant's page, partners on the partner's page, and students sign up in the app.")} />
      <PageTabs tabs={[{ href: "/admin/users", label: t("All users") }, { href: "/admin/users/new", label: t("New user") }]} />
      <Card className="max-w-xl">
        <ActionForm action={inviteTeamMember} className="space-y-4" resetOnSuccess>
          <Field label={t("Full name")}><Input name="full_name" required /></Field>
          <Field label={t("Email")}><Input name="email" type="email" required /></Field>
          <Field label={t("Role")}>
            <Select name="role" defaultValue="operations">
              {["operations", "account_manager", "finance", "admin"].map((r) => <option key={r} value={r}>{t(ROLE_LABEL[r])}</option>)}
            </Select>
          </Field>
          <p className="text-xs text-zinc-500">{t("They get an email to set a password. Account managers then need merchants assigned under Team & assignments.")}</p>
          <SubmitButton className="w-full">{t("Send invite")}</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
