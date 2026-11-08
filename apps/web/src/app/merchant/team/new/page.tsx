import { redirect } from "next/navigation";
import { requireMerchantArea } from "@/lib/auth";
import { Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PageTabs } from "@/components/page-tabs";
import { getT } from "@/lib/i18n/server";
import { MEMBER_ROLE_LABEL } from "@/lib/labels";
import { inviteStaff } from "../../actions";

export const metadata = { title: "Add staff" };

export default async function AddStaffPage() {
  const { supabase, merchant, memberRole } = await requireMerchantArea("team");
  if (memberRole !== "owner") redirect("/merchant/team");
  const t = await getT();
  const { data: branches } = await supabase.from("merchant_branches").select("id, name").eq("merchant_id", merchant.id).order("name");
  return (
    <>
      <PageHeader title={t("Team")} subtitle={t("They get an email invite to set a password and sign in.")} />
      <PageTabs tabs={[{ href: "/merchant/team", label: t("Team") }, { href: "/merchant/team/new", label: t("Add staff") }]} />
      <Card className="max-w-xl">
            <ActionForm action={inviteStaff} className="space-y-4" resetOnSuccess>
              <Field label={t("Email")}><Input name="email" type="email" required /></Field>
              <Field label={t("Role")}>
                <Select name="member_role" defaultValue="cashier">
                  {["cashier", "branch_manager", "manager"].map((r) => <option key={r} value={r}>{t(MEMBER_ROLE_LABEL[r])}</option>)}
                </Select>
              </Field>
              <Field label={t("Branch")} hint={t("Required for branch managers")}>
                <Select name="branch_id" defaultValue="">
                  <option value="">—</option>
                  {(branches ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </Field>
              <SubmitButton className="w-full">{t("Send invite")}</SubmitButton>
            </ActionForm>
          
      </Card>
    </>
  );
}
