import { requireStaff } from "@/lib/auth";
import { Card, PageHeader, Select, Table, Td } from "@/components/ui";
import { BroadcastForm } from "@/components/broadcast-form";
import { dateTime } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { runAutoNotificationsNow, saveAutoNotifications, sendBroadcast } from "../actions";

export const metadata = { title: "Push notifications" };

type AutoRule = "ending_soon" | "almost_level" | "new_near_campus";
type AutoCfg = Record<AutoRule, boolean> & { max_per_week: number };

type Sent = {
  id: string; title: string; body: string; recipients: number; created_at: string; campus_ids: string[] | null;
  campus: { name: string } | null; perk: { title: string } | null; sender: { full_name: string | null } | null;
};

export default async function BroadcastsPage() {
  const { supabase } = await requireStaff("broadcasts");
  const t = await getT();
  const [{ data: campuses }, { data: perks }, { data: audience }, { data: sent }, { data: autoCfg }, { data: autoStats }, { data: autoPreview }] = await Promise.all([
    supabase.from("campuses").select("id, name").order("name"),
    supabase.from("perks").select("id, title, merchant:merchants!inner(name, status)").eq("status", "active").eq("merchant.status", "live").order("created_at", { ascending: false }).limit(200)
      .returns<{ id: string; title: string; merchant: { name: string } }[]>(),
    supabase.rpc("broadcast_audience"),
    supabase.from("broadcasts").select("id, title, body, recipients, created_at, campus_ids, campus:campuses(name), perk:perks(title), sender:profiles!broadcasts_sent_by_fkey(full_name)")
      .order("created_at", { ascending: false }).limit(30).returns<Sent[]>(),
    supabase.from("app_settings").select("value").eq("key", "auto_notifications").maybeSingle<{ value: AutoCfg }>(),
    supabase.rpc("auto_notification_stats"),
    supabase.rpc("run_auto_notifications", { p_dry_run: true }),
  ]);
  const cfg: AutoCfg = { ending_soon: true, almost_level: true, new_near_campus: true, max_per_week: 3, ...(autoCfg?.value ?? {}) };
  const stats = (autoStats ?? {}) as Partial<Record<AutoRule | "opened" | "total", number>>;
  const preview = (autoPreview ?? {}) as Partial<Record<AutoRule | "total", number>>;
  const RULES: { key: AutoRule; title: string; text: string; example: string }[] = [
    { key: "ending_soon", title: t("Saved perk ending soon"), text: t("A perk at a place the student saved ends tomorrow and they haven't used it."), example: t("“Ends tomorrow ⏰ 15% off drinks at Café X ends tomorrow. Don't miss it!”") },
    { key: "almost_level", title: t("Close to the next level"), text: t("The student is a few XP away from their next level (once per level)."), example: t("“Almost there 🚀 You're 40 XP from Insider. Use a perk today to level up!”") },
    { key: "new_near_campus", title: t("New perk near their campus"), text: t("A new perk at a shop with a branch at the student's campus. Only students who turned on perk drops."), example: t("“New near AUC 🎉 Café X: 20% off all drinks”") },
  ];
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
      <Card className="mb-6" title={t("Automatic messages")}>
        <p className="-mt-1 mb-4 text-sm text-zinc-500">
          {t("Sent every day at 6 pm (Cairo). Each student gets at most one a day, never the same one twice, and students can turn them off in the app.")}
        </p>
        <ActionForm action={saveAutoNotifications} className="space-y-3">
          {RULES.map((r) => (
            <label key={r.key} className="flex items-start gap-3 rounded-xl border border-zinc-200 p-3">
              <input type="checkbox" name={r.key} defaultChecked={cfg[r.key]} className="mt-1 h-4 w-4 accent-perk-purple" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-sm font-semibold">{r.title}</span>
                  <span className="text-xs text-zinc-500">{t("{n} sent in the last 7 days", { n: stats[r.key] ?? 0 })} · {t("{n} due today", { n: preview[r.key] ?? 0 })}</span>
                </span>
                <span className="block text-xs text-zinc-500">{r.text}</span>
                <span className="mt-1 block text-xs italic text-zinc-400">{r.example}</span>
              </span>
            </label>
          ))}
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm font-semibold">
              <span className="mb-1 block">{t("Most per student per week")}</span>
              <Select name="max_per_week" defaultValue={String(cfg.max_per_week)} className="w-28">
                {[1, 2, 3, 4, 5, 7].map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </label>
            <SubmitButton>{t("Save")}</SubmitButton>
          </div>
        </ActionForm>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 text-sm">
          <span className="text-zinc-500">
            {t("Last 7 days: {n} sent, {o} opened.", { n: stats.total ?? 0, o: stats.opened ?? 0 })}{" "}
            {t("Tonight: about {n} students.", { n: preview.total ?? 0 })}
          </span>
          <ActionForm action={runAutoNotificationsNow}>
            <SubmitButton variant="secondary">{t("Send today's now")}</SubmitButton>
          </ActionForm>
        </div>
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
