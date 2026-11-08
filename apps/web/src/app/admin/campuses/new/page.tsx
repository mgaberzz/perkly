import { requireStaff } from "@/lib/auth";
import { Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PageTabs } from "@/components/page-tabs";
import { getT } from "@/lib/i18n/server";
import { createCampus } from "../../actions";

export const metadata = { title: "New campus" };

export default async function NewCampusesPage() {
  await requireStaff("campuses_edit");
  const t = await getT();
  return (
    <>
      <PageHeader title={t("Campuses")} />
      <PageTabs tabs={[{ href: "/admin/campuses", label: t("All campuses") }, { href: "/admin/campuses/new", label: t("New campus") }]} />
      <Card className="max-w-xl">
          <ActionForm action={createCampus} className="space-y-3" resetOnSuccess>
            <Field label={t("Name")}><Input name="name" required /></Field>
            <Field label={t("Short name")}><Input name="short_name" placeholder="AUC" /></Field>
            <Field label={t("City")}><Input name="city" required /></Field>
            <Field label={t("Type")}><Select name="type"><option value="university">{t("university")}</option><option value="school">{t("school")}</option><option value="hub">{t("hub")}</option></Select></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t("Latitude")}><Input name="lat" type="number" step="any" /></Field>
              <Field label={t("Longitude")}><Input name="lng" type="number" step="any" /></Field>
            </div>
            <SubmitButton className="w-full">{t("Add campus")}</SubmitButton>
          </ActionForm>
        </Card>
    </>
  );
}
