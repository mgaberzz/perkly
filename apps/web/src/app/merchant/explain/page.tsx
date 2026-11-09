import { Icon } from "@/components/icons";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { merchantCan, requireMerchant } from "@/lib/auth";
import { Amount, Badge, Card, PageHeader, Table, Td } from "@/components/ui";
import { ExportButtons } from "@/components/export-buttons";
import { dateTime, periodStart } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { applyTxFilters, readTxFilters, txSelect, type TxFilters } from "@/lib/tx-filters";
import { settlementLabel } from "@/lib/types";

export const metadata = { title: "Explain" };

type Tx = {
  id: string; created_at: string; verification_code: string; tx_code: string; payment_method: string; first_time_at_merchant: boolean;
  original_amount: number | null; discount_amount: number | null; final_amount: number | null;
  commission_amount: number | null; vat_amount: number | null; merchant_net: number | null; settle_amount: number | null;
  perk: { title: string } | null; branch: { name: string } | null; qr: { label: string; cashier_name: string | null } | null;
  settlement: { id: string; status: string } | null;
};
type Settlement = { id: string; period_start: string | null; period_end: string; amount: number; paid_amount: number; status: string };
type Payment = { id: string; amount: number; reference: string; paid_at: string; settlement: { id: string; amount: number } | null };

const SELECT = "id, created_at, verification_code, tx_code, payment_method, first_time_at_merchant, original_amount, discount_amount, final_amount, commission_amount, vat_amount, merchant_net, settle_amount, perk:perks(title), branch:merchant_branches(name), qr:branch_qr_codes(label, cashier_name), settlement:settlements(id, status)";
const sum = <T,>(rows: T[], f: (r: T) => number | null | undefined) => rows.reduce((a, r) => a + Number(f(r) ?? 0), 0);

function Line({ label, value, href, sign, strong, count }: { label: string; value: number; href?: string; sign?: string; strong?: boolean; count?: boolean }) {
  const body = (
    <div className={`flex items-center justify-between gap-4 rounded-xl px-3 py-2 ${strong ? "bg-perk-purple/10 font-bold" : "hover:bg-zinc-50"}`}>
      <span className="flex items-center gap-2"><span className="w-4 text-center text-zinc-400">{sign}</span>{label}</span>
      {count ? <span className={strong ? "text-perk-purple" : ""}>{value.toLocaleString()}</span> : <Amount v={value} className={strong ? "text-perk-purple" : ""} />}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

export default async function MerchantExplainPage({ searchParams }: PageProps<"/merchant/explain">) {
  const ctx = await requireMerchant();
  const { supabase, merchant, branchScope, memberRole } = ctx;
  const t = await getT();
  const sp = await searchParams;
  const g = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const metric = g("metric") || "transactions";
  const money = merchantCan(memberRole, "payouts");
  if (!merchantCan(memberRole, "transactions")) redirect("/merchant");
  if (metric !== "transactions" && !money) redirect("/merchant/redemptions");

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => typeof v === "string")) as Record<string, string>, ...extra })) if (v) p.set(k, v);
    return `/merchant/explain?${p}`;
  };

  // ── Transactions for a period, with optional branch / cashier / perk / customer filters ──
  if (metric === "transactions") {
    const days = Number(g("days")) || 30;
    const f: TxFilters = { ...readTxFilters(g), from: g("from") || periodStart(days) };
    if (branchScope) f.branch = branchScope.id;
    const q = applyTxFilters(supabase.from("redemptions").select(txSelect(SELECT, f)).eq("merchant_id", merchant.id).neq("status", "reversed")
      .order("created_at", { ascending: false }).limit(1000), f);
    const { data } = await q.returns<Tx[]>();
    const rows = data ?? [];
    const newOnes = rows.filter((r) => r.first_time_at_merchant).length;
    const what = [
      f.branch && !branchScope && rows[0]?.branch?.name, f.qr && (rows[0]?.qr?.cashier_name ?? rows[0]?.qr?.label), f.perk,
      f.customer === "new" ? t("New customers") : f.customer === "recurring" ? t("Recurring customers") : null,
      g("to") && g("from") === g("to") ? g("from") : null,
    ].filter(Boolean).join(" · ");
    return (
      <Explained title={t("Transactions") + (what ? ` · ${what}` : "")}
        value={<>{rows.length.toLocaleString()}</>}
        subtitle={g("to") && g("from") === g("to") ? t("On {date}", { date: g("from") }) : t("Last {days} days", { days })}
        formula={<>
          <Line count label={t("Transactions")} value={rows.length} href={qs({ customer: undefined })} />
          <Line count sign="↳" label={t("New customers")} value={newOnes} href={qs({ customer: "new" })} />
          <Line count sign="↳" label={t("Recurring customers")} value={rows.length - newOnes} href={qs({ customer: "recurring" })} />
          <Line label={t("Total GMV (bills before discount)")} value={sum(rows, (r) => r.original_amount)} />
          <Line sign="−" label={t("Student discounts")} value={sum(rows, (r) => r.discount_amount)} />
          <Line sign="=" strong label={t("Revenue after discount")} value={sum(rows, (r) => r.final_amount)} />
          {money && <>
            <Line sign="−" label={t("Perkly commission")} value={sum(rows, (r) => r.commission_amount)} />
            <Line sign="−" label={t("VAT on commission")} value={sum(rows, (r) => r.vat_amount)} />
            <Line sign="=" strong label={t("Your net")} value={sum(rows, (r) => r.merchant_net)} />
          </>}
        </>}
        exportParams={{ scope: "merchant", ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) as Record<string, string> }}>
        <TxTable rows={rows} t={t} money={money} />
      </Explained>
    );
  }

  // ── What will be settled to you (unsettled transactions, netted) ──
  if (metric === "to_settle") {
    const kind = g("kind");
    const { data: open } = await supabase.from("settlements").select("id, period_start, period_end, amount, paid_amount, status")
      .eq("merchant_id", merchant.id).neq("status", "paid").returns<Settlement[]>();
    const { data } = await supabase.from("redemptions").select(SELECT).eq("merchant_id", merchant.id).is("settlement_id", null)
      .neq("status", "reversed").or("payment_method.eq.merchant,payment_status.eq.paid").order("created_at", { ascending: false }).limit(1000).returns<Tx[]>();
    const all = data ?? [];
    const inApp = all.filter((r) => r.payment_method === "in_app"), cashier = all.filter((r) => r.payment_method !== "in_app");
    const rows = kind === "in_app" ? inApp : kind === "cashier" ? cashier : all;
    const openRemaining = sum(open ?? [], (s) => Math.sign(s.amount) * (Math.abs(s.amount) - Number(s.paid_amount)));
    const total = sum(all, (r) => r.settle_amount) + openRemaining;
    return (
      <Explained title={total >= 0 ? t("To be settled to your bank account") : t("Commission you owe Perkly")} value={<Amount v={Math.abs(total)} />}
        subtitle={t("All branches. Positive = Perkly pays you; negative = you owe Perkly commission + VAT on sales paid at your cashier.")}
        formula={<>
          <Line sign="+" label={t("Paid in the Perkly app ({n}): paid − commission − VAT", { n: inApp.length })} value={sum(inApp, (r) => r.settle_amount)} href={qs({ kind: "in_app" })} />
          <Line sign="−" label={t("Commission on cashier sales ({n})", { n: cashier.length })} value={sum(cashier, (r) => r.commission_amount)} href={qs({ kind: "cashier" })} />
          <Line sign="−" label={t("VAT on that commission")} value={sum(cashier, (r) => r.vat_amount)} href={qs({ kind: "cashier" })} />
          <Line sign="+" label={t("Open settlements (created, not fully paid)")} value={openRemaining} href="/merchant/payouts" />
          <Line sign="=" strong label={t("Total")} value={total} href={qs({ kind: undefined })} />
        </>}
        exportParams={{ scope: "merchant", unsettled: "1", payment: kind === "in_app" ? "in_app" : kind === "cashier" ? "merchant" : undefined }}>
        <TxTable rows={rows} t={t} money />
      </Explained>
    );
  }

  // ── One settlement ──
  if (metric === "settlement") {
    const id = g("id");
    const [{ data: s }, { data: tx }, { data: pays }] = await Promise.all([
      supabase.from("settlements").select("id, period_start, period_end, amount, paid_amount, status").eq("id", id).eq("merchant_id", merchant.id).maybeSingle<Settlement>(),
      supabase.from("redemptions").select(SELECT).eq("settlement_id", id).eq("merchant_id", merchant.id).order("created_at").limit(2000).returns<Tx[]>(),
      supabase.from("settlement_payments").select("id, amount, reference, paid_at").eq("settlement_id", id).order("paid_at").returns<Payment[]>(),
    ]);
    if (!s) notFound();
    const rows = tx ?? [];
    const inApp = rows.filter((r) => r.payment_method === "in_app"), cashier = rows.filter((r) => r.payment_method !== "in_app");
    return (
      <Explained title={t("Settlement")} value={<Amount v={s.amount} />} subtitle={`${s.period_start ?? ""} → ${s.period_end} · ${t(settlementLabel(s.status))}`}
        formula={<>
          <Line sign="+" label={t("Paid in the Perkly app: paid − commission − VAT")} value={sum(inApp, (r) => r.settle_amount)} />
          <Line sign="−" label={t("Commission + VAT on cashier sales")} value={-sum(cashier, (r) => r.settle_amount)} />
          <Line sign="=" strong label={t("Net amount")} value={s.amount} />
          <Line sign="−" label={t("Paid so far ({n} payment(s))", { n: (pays ?? []).length })} value={s.paid_amount} />
          <Line sign="=" label={t("Remaining")} value={Math.abs(s.amount) - Number(s.paid_amount)} />
        </>}
        exportParams={{ scope: "merchant", settlement: s.id }}>
        {(pays ?? []).length > 0 && (
          <Card title={t("Payments recorded")} className="mb-6">
            <ul className="divide-y divide-zinc-100 text-sm">
              {(pays ?? []).map((p) => <li key={p.id} className="flex justify-between py-2"><span>{dateTime(p.paid_at)} · <span className="font-mono">{p.reference}</span></span><Amount v={p.amount} className="font-semibold" /></li>)}
            </ul>
          </Card>
        )}
        <TxTable rows={rows} t={t} money />
      </Explained>
    );
  }

  // ── Money transferred to you ──
  if (metric === "paid_to_you") {
    const { data } = await supabase.from("settlement_payments").select("id, amount, reference, paid_at, settlement:settlements!inner(id, amount, merchant_id)")
      .eq("settlement.merchant_id", merchant.id).gt("settlement.amount", 0).order("paid_at", { ascending: false }).returns<Payment[]>();
    const rows = data ?? [];
    return (
      <Explained title={t("Paid to you so far")} value={<Amount v={sum(rows, (p) => p.amount)} />} subtitle={t("Bank transfers from Perkly, recorded by Perkly finance.")}
        formula={<Line sign="=" strong label={t("{n} payment(s)", { n: rows.length })} value={sum(rows, (p) => p.amount)} />}>
        <Table head={[t("Paid at"), t("Bank reference"), t("Amount"), ""]} empty={t("No payments yet.")}>
          {rows.map((p) => (
            <tr key={p.id}>
              <Td>{dateTime(p.paid_at)}</Td><Td className="font-mono">{p.reference}</Td><Td phone="sum" className="font-semibold"><Amount v={p.amount} /></Td>
              <Td><Link href={`/merchant/explain?metric=settlement&id=${p.settlement?.id}`} className="text-sm font-semibold text-perk-purple hover:underline">{t("Settlement")} →</Link></Td>
            </tr>
          ))}
        </Table>
      </Explained>
    );
  }

  notFound();
}

function Explained({ title, value, subtitle, formula, children, exportParams }: {
  title: string; value: React.ReactNode; subtitle: string; formula: React.ReactNode; children: React.ReactNode; exportParams?: Record<string, string | undefined>;
}) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={exportParams && <ExportButtons kind="transactions" params={exportParams} />} />
      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl p-6 text-white shadow-sm perk-gradient">
          <div className="text-xs font-semibold uppercase tracking-wide text-white/80">{title}</div>
          <div className="mt-2 text-4xl font-extrabold">{value}</div>
        </div>
        <Card title={<Icon name="calculator" size={18} />} className="lg:col-span-2"><div className="space-y-1 text-sm">{formula}</div></Card>
      </div>
      {children}
    </>
  );
}

function TxTable({ rows, t, money }: { rows: Tx[]; t: (s: string, v?: Record<string, string | number>) => string; money: boolean }) {
  return (
    <Table head={[t("Time"), t("Branch / cashier"), t("Perk"), t("Customer"), t("Payment"), t("Bill"), t("Discount"), t("Paid"),
      ...(money ? [t("Commission"), t("VAT"), t("Your net"), t("Status")] : [])]} empty={t("No transactions.")}>
      {rows.map((r) => (
        <tr key={r.id}>
          <Td className="whitespace-nowrap">{dateTime(r.created_at)}<div className="font-mono text-xs font-semibold text-perk-purple">{r.tx_code}</div><div className="font-mono text-xs text-zinc-500">{r.verification_code}</div></Td>
          <Td>{r.branch?.name ?? <><Icon name="globe" size={14} className="me-1 inline-block align-[-2px]" />{t("Online")}</>}<div className="text-xs text-zinc-500">{r.qr?.cashier_name ?? r.qr?.label}</div></Td>
          <Td phone="lead">{r.perk?.title}</Td>
          <Td>{r.first_time_at_merchant ? <Badge tone="live">{t("New customer")}</Badge> : <Badge tone="paused">{t("Recurring customer")}</Badge>}</Td>
          <Td phone="sum"><Badge tone={r.payment_method === "in_app" ? "active" : "paused"}>{r.payment_method === "in_app" ? t("Paid in app") : t("Pay at cashier")}</Badge></Td>
          <Td phone="sum"><Amount v={r.original_amount} /></Td>
          <Td><Amount v={r.discount_amount} /></Td>
          <Td><Amount v={r.final_amount} /></Td>
          {money && <>
            <Td><Amount v={r.commission_amount} /></Td>
            <Td><Amount v={r.vat_amount} /></Td>
            <Td className="font-semibold"><Amount v={r.merchant_net} /></Td>
            <Td>{r.settlement
              ? <Link href={`/merchant/explain?metric=settlement&id=${r.settlement.id}`} className="hover:underline"><Badge tone={r.settlement.status === "paid" ? "paid" : "pending"}>{t(settlementLabel(r.settlement.status))}</Badge></Link>
              : <Badge tone="paused">{t("Not settled yet")}</Badge>}</Td>
          </>}
        </tr>
      ))}
    </Table>
  );
}
