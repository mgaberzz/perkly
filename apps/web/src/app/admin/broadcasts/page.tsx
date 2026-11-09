import { requireStaff } from "@/lib/auth";
import { Card, PageHeader, Table, Td } from "@/components/ui";
import { BroadcastForm } from "@/components/broadcast-form";
import { dateTime } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { sendBroadcast } from "../actions";

export const metadata = { title: "Push notifications" };

type Sent = {
  id: string; title: string; body: string; recipients: number; created_at: string; campus_ids: string[] | null;
  campus: { name: string } | null; perk: { title: string } | null; sender: { full_name: string | null } | null;
};

export default async function BroadcastsPage() {
  const { supabase } = await requireStaff("broadcasts");
  const t = await getT();
  const [{ data: campuses }, { data: perks }, { data: audience }, { data: sent }] = await Promise.all([
    supabase.from("campuses").select("id, name").order("name"),
    supabase.from("perks").select("id, title, merchant:merchants!inner(name, status)").eq("status", "active").eq("merchant.status", "live").order("created_at", { ascending: false }).limit(200)
      .returns<{ id: string; title: string; merchant: { name: string } }[]>(),
    supabase.rpc("broadcast_audience"),
    supabase.from("broadcasts").select("id, title, body, recipients, created_at, campus_ids, campus:campuses(name), perk:perks(title), sender:profiles!broadcasts_sent_by_fkey(full_name)")
      .order("created_at", { ascending: false }).limit(30).returns<Sent[]>(),
  ]);
  const campusName = new Map((campuses ?? []).map((c) => [c.id, c.name]));
  const counts = await Promise.all((campuses ?? []).map((c) => supabase.rpc("broadcast_audience", { p_campus_id: c.id })));

  return (
    <>
      <PageHeader title={t("Push notifications")}
        subtitle={t("Send perk drops and news to students' phones. Only students who turned on perk drops receive them; receipts and verification results are sent automatically.")} />
      <Card className="mb-6">
        <BroadcastForm action={sendBroadcast} audience={Number(audience ?? 0)}
          campuses={(campuses ?? []).map((c, i) => ({ id: c.id, label: c.name, count: (counts[i].data as number | null) ?? null }))}
          perks={(perks ?? []).map((p) => ({ id: p.id, label: `${p.merchant.name} · ${p.title}` }))} />
      </Card>
      <h2 className="mb-3 text-lg font-bold">{t("Sent")}</h2>
      <Table head={[t("Notification"), t("Audience"), t("Opens"), t("Students"), t("Sent by"), t("Date")]} empty={t("Nothing sent yet.")}>
        {(sent ?? []).map((b) => (
          <tr key={b.id}>
            <Td phone="lead"><div className="font-semibold">{b.title}</div><div className="max-w-md text-xs font-normal text-zinc-500">{b.body}</div></Td>
            <Td>{b.campus_ids && b.campus_ids.length > 1 ? b.campus_ids.map((id) => campusName.get(id) ?? "—").join(", ") : b.campus?.name ?? t("All campuses")}</Td>
            <Td phone="hide">{b.perk?.title ?? t("Inbox")}</Td>
            <Td phone="sum">{b.recipients}</Td>
            <Td>{b.sender?.full_name ?? "—"}</Td>
            <Td>{dateTime(b.created_at)}</Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
