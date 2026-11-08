import { requireStaff } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { Badge, Card, Field, Input, PageHeader, Select, Table, Td } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import type { Quest } from "@/lib/types";
import { createQuest, toggleQuest } from "../actions";

export const metadata = { title: "Quests" };
const METRIC: Record<string, string> = { redemptions: "Redemptions", unique_merchants: "Different merchants", new_merchants: "New merchants" };

export default async function QuestsPage() {
  const { supabase } = await requireStaff("quests");
  const t = await getT();
  const { data } = await supabase.from("quests").select("*").order("quest_type").order("xp_reward").returns<Quest[]>();
  return (
    <>
      <PageHeader title={t("Quests")} subtitle={t("Progress updates automatically on every redemption. XP is awarded on completion.")} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Table head={[t("Quest"), t("Type"), t("Goal"), "XP", t("Status"), ""]}>
            {(data ?? []).map((q) => (
              <tr key={q.id}>
                <Td><span className="me-1">{q.emoji}</span><span className="font-semibold">{q.title}</span><div className="text-xs text-zinc-500">{q.description}</div></Td>
                <Td phone="sum">{t(q.quest_type)}</Td>
                <Td>{q.target} × {t(METRIC[q.metric])}</Td>
                <Td phone="sum">+{q.xp_reward} XP</Td>
                <Td phone="sum"><Badge tone={q.is_active ? "active" : "paused"}>{q.is_active ? t("active") : t("off")}</Badge></Td>
                <Td><form action={toggleQuest}><input type="hidden" name="id" value={q.id} /><input type="hidden" name="active" value={String(!q.is_active)} />
                  <button className="text-xs font-semibold text-perk-purple hover:underline">{q.is_active ? t("Turn off") : t("Turn on")}</button></form></Td>
              </tr>
            ))}
          </Table>
        </div>
        <Card title={t("New quest")}>
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
      </div>
    </>
  );
}
