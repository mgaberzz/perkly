import { redirect } from "next/navigation";
import { requireMerchantArea } from "@/lib/auth";
import { Badge, Card, Field, Input, PageHeader, Table, Td } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { dateTime, egp } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { confirmOnlineCode, reportOnlineOrder } from "../actions";

export const metadata = { title: "Online orders" };

type Order = { id: string; order_code: string; order_ref: string; amount: number; cashback_amount: number; status: string; created_at: string };
type Code = { id: string; code: string; status: string; created_at: string; perk: { title: string } | null };

export default async function OnlinePage() {
  const { supabase, merchant } = await requireMerchantArea("online");
  if (merchant.channel === "in_store") redirect("/merchant");
  const t = await getT();
  const [{ data: orders }, { data: codes }] = await Promise.all([
    supabase.from("online_orders").select("id, order_code, order_ref, amount, cashback_amount, status, created_at").eq("merchant_id", merchant.id).order("created_at", { ascending: false }).limit(50).returns<Order[]>(),
    supabase.from("online_codes").select("id, code, status, created_at, perk:perks(title)").eq("merchant_id", merchant.id).eq("status", "used").order("created_at", { ascending: false }).limit(50).returns<Code[]>(),
  ]);
  const link = merchant.affiliate_url ?? merchant.website_url;
  return (
    <>
      <PageHeader title={t("Online orders")} subtitle={t("Two ways students save with you online: a one-time Perkly code at checkout, or a tracked link that earns them cashback.")} />
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card title={`1 · ${t("Validate a one-time code")}`}>
          <p className="mb-3 text-sm text-zinc-500">{t("Students tap “Get code” in the app (valid 30 minutes, single use). Enter it with the order total to apply the discount.")}</p>
          <ActionForm action={confirmOnlineCode} className="space-y-3" resetOnSuccess>
            <Field label={t("Code")}><Input name="code" placeholder="PK1A2B3C4D" required dir="ltr" className="font-mono uppercase" /></Field>
            <Field label={t("Order total (EGP)")}><Input name="amount" type="number" step="0.01" min="0" /></Field>
            <SubmitButton className="w-full">{t("Validate & redeem")}</SubmitButton>
          </ActionForm>
        </Card>
        <Card title={`2 · ${t("Report a tracked-link order")}`}>
          <p className="mb-3 text-sm text-zinc-500">
            {t("Students open your shop from Perkly. Each visit adds perkly_ref=PKR… to the URL — save it with the order, then report it here (or via the API). Finance approves the cashback.")}
          </p>
          {link ? <p className="mb-3 truncate rounded-lg bg-zinc-50 px-3 py-2 font-mono text-xs" dir="ltr">{link}?perkly_ref=PKR…</p>
            : <p className="mb-3 text-xs text-amber-700">{t("Ask Perkly to add your shop URL to turn on tracked links.")}</p>}
          <ActionForm action={reportOnlineOrder} className="grid gap-3 sm:grid-cols-3" resetOnSuccess>
            <Field label={t("Perkly ref")}><Input name="ref" placeholder="PKR…" required dir="ltr" className="font-mono uppercase" /></Field>
            <Field label={t("Your order #")}><Input name="order_ref" required dir="ltr" /></Field>
            <Field label={t("Order total (EGP)")}><Input name="amount" type="number" step="0.01" min="1" required /></Field>
            <SubmitButton className="sm:col-span-3">{t("Report order")}</SubmitButton>
          </ActionForm>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-bold">{t("Redeemed codes")}</h2>
          <Table head={[t("Code"), t("Perk"), t("Time")]} empty={t("No codes redeemed yet.")}>
            {(codes ?? []).map((c) => (
              <tr key={c.id}><Td className="font-mono">{c.code}</Td><Td phone="sum">{c.perk?.title}</Td><Td>{dateTime(c.created_at)}</Td></tr>
            ))}
          </Table>
        </div>
        <div>
          <h2 className="mb-3 font-bold">{t("Tracked-link orders")}</h2>
          <Table head={[t("Order ID"), t("Total"), t("Cashback"), t("Status")]} empty={t("No orders reported yet.")}>
            {(orders ?? []).map((o) => (
              <tr key={o.id}><Td className="font-mono"><span className="font-semibold text-perk-purple">{o.order_code}</span><div className="text-xs text-zinc-500">{t("Your order #")} {o.order_ref}</div></Td><Td phone="sum">{egp(o.amount)}</Td><Td>{egp(o.cashback_amount)}</Td><Td phone="sum"><Badge tone={o.status}>{t(o.status)}</Badge></Td></tr>
            ))}
          </Table>
        </div>
      </div>
    </>
  );
}
