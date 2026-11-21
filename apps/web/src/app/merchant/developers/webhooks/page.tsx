import { requireMerchantArea } from "@/lib/auth";
import { Badge, Card, Field, Input, PageHeader, Table, Td } from "@/components/ui";
import { PageTabs } from "@/components/page-tabs";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ApiKeyCard } from "@/components/api-key-card";
import { dateTime } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { devTabs } from "@/lib/dev-tabs";
import { WEBHOOK_EVENTS, WEBHOOK_EVENT_LABEL } from "@/lib/webhooks";
import { addWebhook, removeWebhook, revealWebhookSecret, rotateWebhookSecret, setWebhookActive, testWebhook } from "./actions";

export const metadata = { title: "Webhooks" };

type Hook = { id: string; url: string; events: string[]; is_active: boolean; created_at: string; secret_rotated_at: string; last_success_at: string | null; last_failure_at: string | null; failures_in_row: number };
type Delivery = { id: string; webhook_id: string; event: string; status: string; attempts: number; last_status_code: number | null; last_error: string | null; created_at: string; delivered_at: string | null; next_attempt_at: string };

export default async function WebhooksPage() {
  const { supabase, merchant } = await requireMerchantArea("developers");
  const t = await getT();
  const [{ data: hooks }, { data: deliveries }, { data: m }] = await Promise.all([
    supabase.from("merchant_webhooks").select("id, url, events, is_active, created_at, secret_rotated_at, last_success_at, last_failure_at, failures_in_row")
      .eq("merchant_id", merchant.id).order("created_at").returns<Hook[]>(),
    supabase.from("webhook_deliveries").select("id, webhook_id, event, status, attempts, last_status_code, last_error, created_at, delivered_at, next_attempt_at")
      .eq("merchant_id", merchant.id).order("created_at", { ascending: false }).limit(25).returns<Delivery[]>(),
    supabase.from("merchants").select("api_enabled").eq("id", merchant.id).maybeSingle<{ api_enabled: boolean }>(),
  ]);
  const enabled = m?.api_enabled ?? true;
  const urlOf = new Map((hooks ?? []).map((h) => [h.id, h.url]));
  const tone = (s: string) => (s === "sent" ? "active" : s === "failed" ? "rejected" : "pending");
  return (
    <>
      <PageHeader title={t("Webhooks")} subtitle={t("Perkly tells your system the moment something happens, like a redemption at your cashier. Each event is signed with HMAC so you know it came from Perkly.")} />
      <PageTabs tabs={devTabs(t)} />
      {!enabled && <div className="mb-6 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">{t("API access is turned off for your business. Webhooks aren't sent right now. Contact Perkly to turn it on.")}</div>}
      <div className="max-w-5xl space-y-6">
        {(hooks ?? []).map((h) => (
          <Card key={h.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <code dir="ltr" className="block break-all font-mono text-sm font-semibold">{h.url}</code>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone={!h.is_active ? "paused" : h.failures_in_row > 0 ? "pending" : "active"}>
                    {!h.is_active ? t("Off") : h.failures_in_row > 0 ? t("Failing ({n} in a row)", { n: h.failures_in_row }) : t("Active")}
                  </Badge>
                  {h.events.map((e) => <span key={e} className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[11px] text-zinc-600">{e}</span>)}
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  {h.last_success_at ? t("Last delivered {date}", { date: dateTime(h.last_success_at) }) : t("Nothing delivered yet")}
                  {h.last_failure_at && ` · ${t("Last failure {date}", { date: dateTime(h.last_failure_at) })}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={testWebhook.bind(null, h.id)}><button className="perk-gradient rounded-xl px-3 py-1.5 text-sm font-semibold text-white" disabled={!h.is_active || !enabled}>{t("Send test event")}</button></form>
                <form action={setWebhookActive.bind(null, h.id, !h.is_active)}><button className="rounded-xl border border-zinc-300 px-3 py-1.5 text-sm font-semibold hover:bg-zinc-50">{h.is_active ? t("Turn off") : t("Turn on")}</button></form>
                <form action={removeWebhook.bind(null, h.id)}><button className="rounded-xl border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50">{t("Delete")}</button></form>
              </div>
            </div>
            <div className="mt-4 max-w-xl">
              <ApiKeyCard live={false} title={t("Signing secret (HMAC)")} description={t("Use it to check the Perkly-Signature header on every event. Keep it on your server only.")}
                masked={`whsec_${"•".repeat(28)}`} reveal={revealWebhookSecret.bind(null, h.id)} recreate={rotateWebhookSecret.bind(null, h.id)}
                meta={t("Created {date}", { date: dateTime(h.secret_rotated_at) })} />
            </div>
          </Card>
        ))}

        {(hooks ?? []).length < 3 && enabled && (
          <Card title={(hooks ?? []).length ? t("Add another webhook") : t("Add a webhook")}>
            <ActionForm action={addWebhook} className="space-y-4" resetOnSuccess>
              <Field label={t("Your endpoint URL (https)")}><Input name="url" type="url" required placeholder="https://your-system.com/perkly/webhook" dir="ltr" /></Field>
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">{t("Events to send")}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {WEBHOOK_EVENTS.map((e) => (
                    <label key={e} className="flex items-start gap-2 rounded-xl border border-zinc-200 p-3 text-sm">
                      <input type="checkbox" name={e} defaultChecked className="mt-0.5" />
                      <span><span className="block font-mono text-xs font-semibold">{e}</span><span className="text-zinc-500">{t(WEBHOOK_EVENT_LABEL[e])}</span></span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <SubmitButton>{t("Add webhook")}</SubmitButton>
            </ActionForm>
          </Card>
        )}

        <div>
          <h2 className="mb-3 font-bold">{t("Recent deliveries")}</h2>
          <Table head={[t("Time"), t("Event"), t("Endpoint"), t("Result"), t("Tries")]} empty={t("No events sent yet.")}>
            {(deliveries ?? []).map((d) => (
              <tr key={d.id}>
                <Td className="whitespace-nowrap text-xs">{dateTime(d.created_at)}</Td>
                <Td><span className="font-mono text-xs">{d.event}</span></Td>
                <Td className="max-w-[260px]"><span dir="ltr" className="block truncate font-mono text-xs text-zinc-500">{urlOf.get(d.webhook_id) ?? "—"}</span></Td>
                <Td className="whitespace-nowrap">
                  <Badge tone={tone(d.status)}>{d.status === "sent" ? t("Delivered") : d.status === "failed" ? t("Failed") : d.status === "sending" ? t("Sending") : t("Retrying")}</Badge>
                  {(d.last_status_code || d.last_error) && <div className="mt-1 text-[11px] text-zinc-500">{d.last_status_code ? `HTTP ${d.last_status_code}` : ""}{d.last_error && d.status !== "sent" ? ` ${d.last_error}` : ""}</div>}
                  {d.status === "pending" && d.attempts > 0 && <div className="text-[11px] text-zinc-500">{t("Next try {date}", { date: dateTime(d.next_attempt_at) })}</div>}
                </Td>
                <Td>{d.attempts}</Td>
              </tr>
            ))}
          </Table>
          <p className="mt-2 text-xs text-zinc-500">{t("Failed events are retried after 1, 5, 30, 120 and 600 minutes. Logs are kept for 30 days.")}</p>
        </div>
      </div>
    </>
  );
}
