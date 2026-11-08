import { requireStaff } from "@/lib/auth";
import { Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PageTabs } from "@/components/page-tabs";
import { getT } from "@/lib/i18n/server";
import { createQuest } from "../../actions";

export const metadata = { title: "New quest" };
const METRIC: Record<string, string> = { redemptions: "Redemptions", unique_merchants: "Different merchants", new_merchants: "New merchants" };

export default async function NewQuestsPage() {
  await requireStaff("quests");
  const t = await getT();
  return (
    <>
      <PageHeader title={t("Quests")} />
      <PageTabs tabs={[{ href: "/admin/quests", label: t("All quests") }, { href: "/admin/quests/new", label: t("New quest") }]} />
      <Card className="max-w-xl">
          <ActionForm action={createQuest} className="space-y-3" resetOnSuccess>
            <div className="grid grid-cols-4 gap-2">
              <Field label={t("Emoji")}><Input name="emoji" defaultValue="🎯" /></Field>
              <Field label={t("Title")} className="col-span-3"><Input name="title" required /></Field>
            </div>
            <Field label={t("Description")}><Input name="description" /></Field>
            <Field label={t("Resets")}><Select name="quest_type"><option value="daily">{t("daily")}</option><option value="weekly">{t("weekly")}</option><option value="monthly">{t("monthly")}</option></Select></Field>
            <Field label={t("Counts")}><Select name="metric">{Object.entries(METRIC).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</Select></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t("Target")}><Input name="target" type="number" min="1" defaultValue={1} /></Field>
              <Field label={t("XP reward")}><Input name="xp_reward" type="number" min="1" defaultValue={25} /></Field>
            </div>
            <SubmitButton className="w-full">{t("Create quest")}</SubmitButton>
          </ActionForm>
        </Card>
    </>
  );
}
