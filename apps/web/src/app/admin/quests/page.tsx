import { PageTabs } from "@/components/page-tabs";
import { requireStaff } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { Badge, PageHeader, Table, Td } from "@/components/ui";
import type { Quest } from "@/lib/types";
import { toggleQuest } from "../actions";

export const metadata = { title: "Quests" };
const METRIC: Record<string, string> = { redemptions: "Redemptions", unique_merchants: "Different merchants", new_merchants: "New merchants" };

export default async function QuestsPage() {
  const { supabase } = await requireStaff("quests");
  const t = await getT();
  const { data } = await supabase.from("quests").select("*").order("quest_type").order("xp_reward").returns<Quest[]>();
  return (
    <>
      <PageHeader title={t("Quests")} subtitle={t("Progress updates automatically on every redemption. XP is awarded on completion.")} />
      {<PageTabs tabs={[{ href: "/admin/quests", label: t("All quests") }, { href: "/admin/quests/new", label: t("New quest") }]} />}
      <div>
        <div>
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
      </div>
    </>
  );
}
