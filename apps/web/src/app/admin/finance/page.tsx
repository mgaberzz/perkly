import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { Amount, Card, Input, PageHeader } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ExportMenu } from "@/components/export-menu";
import { CardGrid } from "@/components/card-grid";
import { ExpandRow } from "@/components/expand-row";
import { TxPeek } from "@/components/tx-peek";
import { date, egp, short } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { PERIOD_LABEL, PERIODS, resolvePeriod } from "@/lib/periods";
import { BRAND_TYPE_LABEL } from "@/lib/labels";
import { settlementLabel, type Balance, type PartnerBalance, type Settlement } from "@/lib/types";
import { createSettlements, markSettlementPaid } from "../actions";

export const metadata = { title: "Finance" };

type Summary = { transactions: number; gmv: number; net_revenue: number; vat: number; partner_cuts?: number;
  paid_to_merchants: number; to_be_paid_to_merchants: number; owed_by_merchants: number; received_from_merchants: number };

/** One number in a finance panel; opens its details when it has a link. */
function Metric({ label, value, hint, href, strong }: { label: string; value: React.ReactNode; hint?: React.ReactNode; href?: string; strong?: boolean }) {
  const inner = (
    <div className={`h-full rounded-xl p-4 transition ${strong ? "perk-gradient text-white" : "bg-zinc-50 hover:bg-zinc-100"}`}>
      <div className={`text-xs font-semibold uppercase tracking-wide ${strong ? "text-white/80" : "text-zinc-500"}`}>{label}</div>
      <div className="mt-1 text-xl font-extrabold sm:text-2xl">{value}</div>
      {hint && <div className={`mt-1 text-xs ${strong ? "text-white/80" : "text-zinc-500"}`}>{hint}</div>}
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "balances", label: "Merchant balances" },
  { key: "settlements", label: "Settlements" },
] as const;

export default async function FinancePage({ searchParams }: PageProps<"/admin/finance">) {
  const { supabase, can } = await requireStaff("finance");
  const t = await getT();
  const sp = await searchParams;
  const tab = TABS.find((x) => x.key === sp.tab)?.key ?? "overview";
  const view = sp.view === "all" ? "all" : "due";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const g = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const { period, from, to } = resolvePeriod(g("period") || (g("from") ? "custom" : ""), g("from"), g("to"));
  const [{ data: balances }, { data: settlements }, { data: setting }, { data: tax }, { data: partnerBal }, { data: summary }, { data: periodSum }] = await Promise.all([
    supabase.rpc("merchant_balances"),
    supabase.from("settlements").select("*, merchant:merchants(id, name, merchant_code)").order("created_at", { ascending: false }).limit(100)
      .returns<(Settlement & { merchant: { id: string; name: string; merchant_code: string } })[]>(),
    supabase.from("app_settings").select("value").eq("key", "payments").maybeSingle<{ value: { mode: string; provider: string | null } }>(),
    supabase.from("app_settings").select("value").eq("key", "tax").maybeSingle<{ value: { vat_pct: number } }>(),
    supabase.rpc("partner_balances"),
    supabase.rpc("finance_summary", { p_days: 30 }),
    supabase.rpc("insights_range_summary", { p_from: from, p_to: to }),
  ]);
  const s = (summary ?? {}) as Summary;
  // Period numbers (default: this month) come from the same function as Insights
  const ps = (periodSum ?? {}) as { transactions: number; gmv: number; net_revenue: number; vat: number; partner_cuts: number };
  const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const range = from === to ? fmtDate(to) : `${fmtDate(from)} – ${fmtDate(to)}`;
  const partners = (partnerBal ?? []) as PartnerBalance[];
  const pSum = (k: keyof PartnerBalance) => partners.reduce((a, p) => a + Number(p[k] ?? 0), 0);
  const all = (balances ?? []) as Balance[];
  const sum = (k: keyof Balance) => all.reduce((a, b) => a + Number(b[k] ?? 0), 0);
  let rows = view === "all" ? all : all.filter((b) => Number(b.net_to_settle) !== 0 || Number(b.pending_settlements) !== 0);
  if (q) rows = rows.filter((b) => b.merchant_name.toLowerCase().includes(q.toLowerCase()) || b.merchant_code.includes(q));
  rows.sort((a, b) => Math.abs(Number(b.net_to_settle)) - Math.abs(Number(a.net_to_settle)));
  const pending = (settlements ?? []).filter((x) => x.status !== "paid");
  const net = sum("net_to_settle");
  const mode = setting?.value.mode ?? "off";
  const vat = Number(tax?.value.vat_pct ?? 14);
  const missingBank = all.filter((b) => !b.bank_name && Number(b.net_to_settle) > 0).length;
  const tabHref = (k: string) => (k === "overview" ? "/admin/finance" : `/admin/finance?tab=${k}`);

  return (
    <>
      <PageHeader title={t("Finance")} subtitle={t("What Perkly earns, what it owes merchants and partners, and what has been paid.")}
        actions={<ExportMenu items={[
          { label: t("Transactions"), kind: "transactions" },
          { label: t("Merchant balances"), kind: "balances", params: { all: view === "all" ? "1" : undefined } },
          { label: t("Settlements"), kind: "settlements" },
          ...(can("partners_view") ? [{ label: t("Partner balances"), kind: "partners" }, { label: t("Partner payments"), kind: "partner_payouts" }] : []),
        ]} />} />

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-zinc-200">
        {TABS.map((x) => (
          <Link key={x.key} href={tabHref(x.key)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold ${x.key === tab ? "border-perk-purple text-perk-purple" : "border-transparent text-zinc-500 hover:text-zinc-800"}`}>
            {t(x.label)}{x.key === "settlements" && pending.length > 0 && <span className="ms-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{pending.length}</span>}
          </Link>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <FilterBar path="/admin/finance" fields={[
            { name: "period", label: t("Period"), type: "select", value: period === "mtd" ? "" : period, all: t("This month (MTD)"),
              options: PERIODS.filter((p) => p !== "mtd").map((p) => ({ value: p, label: t(PERIOD_LABEL[p]) })) },
            { name: "from", label: t("From (custom)"), type: "date", value: period === "custom" ? from : undefined },
            { name: "to", label: t("To (custom)"), type: "date", value: period === "custom" ? to : undefined },
          ]} />

          <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-bold">{t(PERIOD_LABEL[period])} <span className="font-normal text-zinc-500">· {range}</span></h2>
            <CardGrid className="grid grid-cols-2 gap-3 lg:grid-cols-4" items={[
              { key: "gmv", title: t("Total volume (GMV)"), tx: { from, to }, card: <Metric strong label={t("Total volume (GMV)")} value={<Amount v={ps.gmv} />} hint={t("{n} transactions", { n: short(ps.transactions) })} /> },
              { key: "rev", title: t("Net revenue"), tx: { from, to }, card: <Metric label={t("Net revenue")} value={<Amount v={ps.net_revenue} />} hint={t("Perkly commission, excl. VAT {vat}", { vat: short(ps.vat) })} /> },
              { key: "cuts", title: t("Partner cuts"), tx: { from, to, partner: "any" }, card: <Metric label={t("Partner cuts")} value={<Amount v={ps.partner_cuts ?? 0} />} hint={t("Share of commission earned by partners")} /> },
              { key: "keep", title: t("Perkly keeps"), tx: { from, to }, card: <Metric label={t("Perkly keeps")} value={<Amount v={Number(ps.net_revenue ?? 0) - Number(ps.partner_cuts ?? 0)} />} hint={t("Net revenue after partner cuts")} /> },
            ]} />
          </section>

          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-zinc-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-bold">{t("To settle now")}</h2>
              <CardGrid className="grid grid-cols-2 gap-3" items={[
                { key: "net", title: t("Not yet in a settlement"), tx: { unsettled: "1" }, card: <Metric label={t("Net to settle with merchants")} value={<Amount v={net} />}
                  hint={net > 0 ? t("Perkly pays merchants") : net < 0 ? t("Merchants pay Perkly commission") : t("All settled")} /> },
                { key: "open", href: "/admin/finance?tab=settlements", card: <Metric label={t("Open settlements")} value={<Amount v={sum("pending_settlements")} />} hint={t("{n} settlement(s) not fully paid", { n: pending.length })} /> },
                { key: "partners", href: "/admin/partners", card: <Metric label={t("Owed to partners")} value={<Amount v={pSum("due")} />} hint={t("Earned minus paid")} /> },
                { key: "owe", title: t("Cashier sales not yet settled"), tx: { unsettled: "1", payment: "merchant" }, card: <Metric label={t("Merchants owe Perkly")} value={<Amount v={s.owed_by_merchants} />} hint={t("Commission on cashier sales")} /> },
              ]} />
            </section>
            <section className="rounded-2xl border border-zinc-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-bold">{t("Paid so far (all time)")}</h2>
              <div className="grid grid-cols-2 gap-3">
                <Metric label={t("Paid to merchants")} value={<Amount v={sum("paid_out")} />} href="/admin/explain?metric=paid_to_merchants" />
                <Metric label={t("Received from merchants")} value={<Amount v={sum("received_from_merchant")} />} hint={t("Commission collected")} href="/admin/explain?metric=received_from_merchants" />
                <Metric label={t("Paid to partners")} value={<Amount v={pSum("paid")} />} href="/admin/partners" />
                <Metric label={t("Partner cuts (all time)")} value={<Amount v={pSum("earned")} />} href="/admin/partners" />
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm">
            <h2 className="mb-2 text-sm font-bold">{t("Needs attention")}</h2>
            <ul className="space-y-1.5 text-zinc-600">
              <li>{pending.length > 0 ? <Link href="/admin/finance?tab=settlements" className="font-semibold text-perk-purple hover:underline">{t("{n} settlement(s) waiting for payment", { n: pending.length })}</Link> : t("No open settlements.")}</li>
              {missingBank > 0 && <li><Link href="/admin/finance?tab=balances" className="font-semibold text-amber-700 hover:underline">{t("{n} merchant(s) are owed money but have no bank details", { n: missingBank })}</Link></li>}
              <li className="text-xs text-zinc-500">
                {t("VAT on commission")}: <b>{vat > 0 ? `${vat}%` : t("off")}</b> · {t("In-app payments")}: <b>{t(mode)}</b>
                {can("settings") && <> · <Link href="/admin/settings" className="font-semibold text-perk-purple hover:underline">{t("Change in Settings")}</Link></>}
              </li>
            </ul>
          </section>
        </>
      )}

      {tab === "balances" && (
        <>
      <FilterBar path="/admin/finance" keep={{ tab: "balances" }} search={{ name: "q", value: q, placeholder: t("Merchant name or ID") }} fields={[
        { name: "view", label: t("Show"), type: "select", value: view === "all" ? "all" : undefined, all: t("With amounts due"), options: [{ value: "all", label: t("All merchants") }] },
      ]} />
      {rows.length === 0 ? <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">{t("Nothing due")}</div> : (
        <div className="space-y-3">
          {rows.map((b) => (
            <ExpandRow key={b.merchant_id} openLabel={t("View transactions")} closeLabel={t("Hide transactions")} summary={<>
              <div className="min-w-0 basis-48"><div className="truncate font-semibold">{b.merchant_name}</div><div className="font-mono text-xs text-zinc-500">{b.merchant_code} · {t(BRAND_TYPE_LABEL[b.brand_type] ?? b.brand_type)}</div></div>
              <div className="text-sm"><div className="text-xs text-zinc-500">{t("Net to settle")}</div><b className={Number(b.net_to_settle) < 0 ? "text-amber-700" : "text-perk-purple"}><Amount v={b.net_to_settle} /></b>
                <div className="text-xs text-zinc-500">{Number(b.net_to_settle) > 0 ? t("Perkly pays merchant") : Number(b.net_to_settle) < 0 ? t("Merchant pays Perkly commission") : ""}</div></div>
              <div className="text-sm"><div className="text-xs text-zinc-500">{t("Open settlements")}</div><Amount v={b.pending_settlements} /></div>
              <div className="text-xs">{b.bank_name ? <span className="text-zinc-500">{b.bank_name}</span> : <span className="font-semibold text-amber-600">{t("Bank details missing")}</span>}</div>
            </>}>
              <dl className="mb-3 grid grid-cols-2 gap-x-6 gap-y-1 px-1 text-sm sm:grid-cols-4">
                <div><dt className="text-xs text-zinc-500">{t("In-app sales")}</dt><dd><Amount v={b.in_app_gross} /></dd></div>
                <div><dt className="text-xs text-zinc-500">{t("Due to merchant")}</dt><dd><Amount v={b.due_to_merchant} /></dd></div>
                <div><dt className="text-xs text-zinc-500">{t("Commission on cashier sales")}</dt><dd><Amount v={b.commission_owed} /></dd></div>
                <div><dt className="text-xs text-zinc-500">{t("VAT on commission")}</dt><dd><Amount v={b.vat} /></dd></div>
              </dl>
              <TxPeek params={{ unsettled: "1", merchant: b.merchant_id }} moreHref={`/admin/redemptions?unsettled=1&merchant=${b.merchant_id}`} merchantColumn={false} />
              {b.iban && <p className="mt-2 px-1 font-mono text-xs text-zinc-500">{b.bank_name} · {b.iban}</p>}
            </ExpandRow>
          ))}
        </div>
      )}

        </>
      )}

      {tab === "settlements" && (
        <>
          <Card title={t("Create settlements")} className="mb-6">
            <p className="mb-3 text-sm text-zinc-500">{t("Groups every unsettled transaction up to the chosen date into one netted settlement per merchant: in-app payments Perkly owes the merchant, minus the commission the merchant owes Perkly on cashier sales. Transactions show “Not settled yet” until finance records a payment.")}</p>
            <ActionForm action={createSettlements} className="flex flex-wrap items-end gap-3">
              <label className="text-xs text-zinc-500">{t("Up to (Cairo date)")}<Input type="date" name="until" className="w-44" /></label>
              <SubmitButton>{t("Create settlements")}</SubmitButton>
            </ActionForm>
          </Card>
      {(settlements ?? []).length === 0 ? <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">{t("No settlements yet.")}</div> : (
        <div className="space-y-3">
          {(settlements ?? []).map((x) => (
            <ExpandRow key={x.id} openLabel={t("View transactions")} closeLabel={t("Hide transactions")} summary={<>
              <div className="min-w-0 basis-48"><div className="truncate font-semibold">{x.merchant.name}</div><div className="font-mono text-xs text-zinc-500">{x.settlement_code} · {x.period_start} → {x.period_end}</div></div>
              <div className="text-sm"><div className="text-xs text-zinc-500">{t("Net amount")}</div><b>{egp(Math.abs(x.amount))}</b><div className="text-xs text-zinc-500">{x.amount >= 0 ? t("Perkly pays merchant") : t("Merchant pays Perkly commission")}</div></div>
              <div className="text-sm"><div className="text-xs text-zinc-500">{t("Paid")}</div>{egp(x.paid_amount)}</div>
              <div className={`text-xs font-semibold ${x.status === "paid" ? "text-emerald-700" : x.status === "partially_paid" ? "text-amber-700" : "text-zinc-500"}`}>{t(settlementLabel(x.status))}{x.reference && <div className="font-mono font-normal text-zinc-500">{x.reference}</div>}</div>
            </>}>
              <p className="mb-2 px-1 text-xs text-zinc-500">{t("{n} transactions", { n: x.lines })} · {t("commission {c} + VAT {v}", { c: egp(x.commission), v: egp(x.vat) })} · {t("{amount} remaining", { amount: egp(Math.abs(x.amount) - Number(x.paid_amount)) })} · {t("Created")} {date(x.created_at)}</p>
              {x.status !== "paid" && (
                <ActionForm action={markSettlementPaid} className="mb-3 flex flex-wrap gap-2 rounded-xl bg-zinc-50 p-3">
                  <input type="hidden" name="id" value={x.id} />
                  <Input name="amount" type="number" step="0.01" min="0.01" placeholder={t("Amount (empty = all)")} className="w-40 text-sm" />
                  <Input name="reference" placeholder={t("Bank reference")} className="w-40 text-sm" required />
                  <SubmitButton variant="secondary" className="text-sm">{t("Record payment")}</SubmitButton>
                </ActionForm>
              )}
              <TxPeek params={{ settlement: x.id }} moreHref={`/admin/explain?metric=settlement&id=${x.id}`} merchantColumn={false} />
            </ExpandRow>
          ))}
        </div>
      )}
        </>
      )}
    </>
  );
}
