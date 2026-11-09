import { Icon } from "@/components/icons";
import Link from "next/link";
import { notFound } from "next/navigation";
import { inScope, requireStaff } from "@/lib/auth";
import { Amount, Badge, Card, LinkButton, PageHeader, Table, Td } from "@/components/ui";
import { ExportButtons } from "@/components/export-buttons";
import { ExpandRow } from "@/components/expand-row";
import { dateTime, periodStart } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { settlementLabel, type Balance } from "@/lib/types";

export const metadata = { title: "Explain" };

type Tx = {
  id: string; created_at: string; verification_code: string; tx_code: string; payment_method: string; status: string;
  original_amount: number | null; discount_amount: number | null; final_amount: number | null;
  commission_amount: number | null; vat_amount: number | null; merchant_net: number | null; settle_amount: number | null;
  merchant: { id: string; name: string; merchant_code: string } | null; perk: { title: string } | null;
  settlement: { id: string; status: string } | null;
};
type Settlement = { id: string; settlement_code: string; created_at: string; period_start: string | null; period_end: string; amount: number; paid_amount: number;
  gross_amount: number; commission: number; vat: number; lines: number; status: string; reference: string | null;
  merchant: { id: string; name: string; merchant_code: string } | null };
type Payment = { id: string; amount: number; reference: string; paid_at: string;
  settlement: { id: string; amount: number; merchant: { id: string; name: string; merchant_code: string } | null } | null };

const TX_SELECT = "id, created_at, verification_code, tx_code, payment_method, status, original_amount, discount_amount, final_amount, commission_amount, vat_amount, merchant_net, settle_amount, merchant:merchants(id, name, merchant_code), perk:perks(title), settlement:settlements(id, status)";
const sum = <T,>(rows: T[], f: (r: T) => number | null | undefined) => rows.reduce((a, r) => a + Number(f(r) ?? 0), 0);

/** One line of the "how it's calculated" box; clickable when it has a link */
function Line({ label, value, href, sign, strong }: { label: string; value: number; href?: string; sign?: "+" | "−" | "=" | "→"; strong?: boolean }) {
  const body = (
    <div className={`flex items-center justify-between gap-4 rounded-xl px-3 py-2 ${strong ? "bg-perk-purple/10 font-bold" : "hover:bg-zinc-50"}`}>
      <span className="flex items-center gap-2"><span className="w-4 text-center text-zinc-400">{sign}</span>{label}</span>
      <Amount v={value} className={strong ? "text-perk-purple" : ""} />
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

export default async function ExplainPage({ searchParams }: PageProps<"/admin/explain">) {
  const { supabase, merchantScope } = await requireStaff("merchants_view");
  const t = await getT();
  const sp = await searchParams;
  const g = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const metric = g("metric"), merchant = g("merchant"), days = Number(g("days")) || 30, id = g("id"), kind = g("kind");
  const self = (extra: Record<string, string>) => `/admin/explain?${new URLSearchParams({ metric, ...(merchant ? { merchant } : {}), ...(g("days") ? { days: g("days") } : {}), ...extra })}`;
  let merchantName = "";
  if (merchant) {
    const { data: m } = await supabase.from("merchants").select("name").eq("id", merchant).maybeSingle();
    merchantName = m?.name ?? "";
  }
  const scopeNote = merchantName ? ` · ${merchantName}` : "";

  // ── Net to settle: unsettled transactions, netted ──
  if (metric === "net_to_settle") {
    let q = inScope(supabase.from("redemptions").select(TX_SELECT).is("settlement_id", null).neq("status", "reversed")
      .or("payment_method.eq.merchant,payment_status.eq.paid").order("created_at", { ascending: false }).limit(1000), merchantScope);
    if (merchant) q = q.eq("merchant_id", merchant);
    const { data } = await q.returns<Tx[]>();
    const all = data ?? [];
    const inApp = all.filter((r) => r.payment_method === "in_app"), cashier = all.filter((r) => r.payment_method !== "in_app");
    const rows = kind === "in_app" ? inApp : kind === "cashier" ? cashier : all;
    return (
      <Explained title={t("Net to settle") + scopeNote} value={sum(all, (r) => r.settle_amount)}
        subtitle={t("Transactions not yet in a settlement. Positive = Perkly pays the merchant; negative = the merchant owes Perkly.")}
        formula={<>
          <Line sign="+" label={t("In-app payments Perkly owes merchants ({n}): paid − commission − VAT", { n: inApp.length })} value={sum(inApp, (r) => r.settle_amount)} href={self({ kind: "in_app" })} />
          <Line sign="−" label={t("Commission on cashier sales ({n})", { n: cashier.length })} value={sum(cashier, (r) => r.commission_amount)} href={self({ kind: "cashier" })} />
          <Line sign="−" label={t("VAT on that commission")} value={sum(cashier, (r) => r.vat_amount)} href={self({ kind: "cashier" })} />
          <Line sign="=" strong label={t("Net to settle")} value={sum(all, (r) => r.settle_amount)} href={self({})} />
        </>}
        exportParams={{ unsettled: "1", merchant: merchant || undefined, payment: kind === "in_app" ? "in_app" : kind === "cashier" ? "merchant" : undefined }}
        filterNote={kind ? (kind === "in_app" ? t("Showing in-app payments only") : t("Showing cashier payments only")) : ""} clear={kind ? self({}) : ""}>
        <TxTable rows={rows} t={t} />
      </Explained>
    );
  }

  // ── One settlement: its transactions and payments ──
  if (metric === "settlement" && id) {
    const [{ data: s }, { data: tx }, { data: pays }] = await Promise.all([
      supabase.from("settlements").select("*, merchant:merchants(id, name, merchant_code)").eq("id", id).maybeSingle<Settlement>(),
      supabase.from("redemptions").select(TX_SELECT).eq("settlement_id", id).order("created_at").limit(2000).returns<Tx[]>(),
      supabase.from("settlement_payments").select("id, amount, reference, paid_at").eq("settlement_id", id).order("paid_at").returns<Payment[]>(),
    ]);
    if (!s) notFound();
    const rows = tx ?? [];
    const inApp = rows.filter((r) => r.payment_method === "in_app"), cashier = rows.filter((r) => r.payment_method !== "in_app");
    return (
      <Explained title={`${t("Settlement")} ${s.settlement_code} · ${s.merchant?.name ?? ""}`} value={s.amount}
        subtitle={`${s.period_start ?? ""} → ${s.period_end} · ${t(settlementLabel(s.status))}`}
        formula={<>
          <Line sign="+" label={t("In-app payments to the merchant: paid − commission − VAT")} value={sum(inApp, (r) => r.settle_amount)} />
          <Line sign="−" label={t("Commission + VAT on cashier sales")} value={-sum(cashier, (r) => r.settle_amount)} />
          <Line sign="=" strong label={t("Net amount")} value={s.amount} />
          <Line sign="−" label={t("Paid so far ({n} payment(s))", { n: (pays ?? []).length })} value={s.paid_amount} />
          <Line sign="=" label={t("Remaining")} value={Math.abs(s.amount) - Number(s.paid_amount)} />
        </>}
        exportParams={{ settlement: id }}>
        {(pays ?? []).length > 0 && (
          <Card title={t("Payments recorded")} className="mb-6">
            <ul className="divide-y divide-zinc-100 text-sm">
              {(pays ?? []).map((p) => <li key={p.id} className="flex justify-between py-2"><span>{dateTime(p.paid_at)} · <span className="font-mono">{p.reference}</span></span><Amount v={p.amount} className="font-semibold" /></li>)}
            </ul>
          </Card>
        )}
        <TxTable rows={rows} t={t} />
      </Explained>
    );
  }

  // ── Open settlements ──
  if (metric === "open_settlements") {
    let q = inScope(supabase.from("settlements").select("*, merchant:merchants(id, name, merchant_code)").neq("status", "paid").order("created_at", { ascending: false }), merchantScope);
    if (merchant) q = q.eq("merchant_id", merchant);
    const { data } = await q.returns<Settlement[]>();
    const rows = data ?? [];
    const remaining = (s: Settlement) => Math.sign(s.amount) * (Math.abs(s.amount) - Number(s.paid_amount));
    const { data: lines } = rows.length
      ? await supabase.from("redemptions").select(`${TX_SELECT}, settlement_id`).in("settlement_id", rows.map((x) => x.id)).order("created_at", { ascending: false }).limit(3000).returns<(Tx & { settlement_id: string })[]>()
      : { data: [] as (Tx & { settlement_id: string })[] };
    return (
      <Explained title={t("Open settlements") + scopeNote} value={sum(rows, remaining)}
        subtitle={t("Settlements created but not fully paid. Positive = still to pay merchants; negative = still to collect from merchants.")}
        formula={<>
          <Line sign="+" label={t("Still to pay merchants")} value={sum(rows.filter((s) => s.amount > 0), remaining)} />
          <Line sign="−" label={t("Still to collect from merchants")} value={-sum(rows.filter((s) => s.amount < 0), remaining)} />
          <Line sign="=" strong label={t("Open settlements")} value={sum(rows, remaining)} />
        </>}>
        <SettlementTable rows={rows} t={t} lines={lines ?? []} />
      </Explained>
    );
  }

  // ── Payments: paid to merchants / received from merchants ──
  if (metric === "paid_to_merchants" || metric === "received_from_merchants") {
    const out = metric === "paid_to_merchants";
    const { data } = await supabase.from("settlement_payments")
      .select("id, amount, reference, paid_at, settlement:settlements!inner(id, amount, merchant_id, merchant:merchants(id, name, merchant_code))")
      .filter("settlement.amount", out ? "gt" : "lt", 0).order("paid_at", { ascending: false }).limit(1000).returns<(Payment & { settlement: { merchant_id: string } })[]>();
    let rows = data ?? [];
    if (merchant) rows = rows.filter((p) => p.settlement?.merchant?.id === merchant);
    if (merchantScope) rows = rows.filter((p) => merchantScope.includes(p.settlement?.merchant?.id ?? ""));
    return (
      <Explained title={(out ? t("Paid to merchants") : t("Received from merchants")) + scopeNote} value={sum(rows, (p) => p.amount)}
        subtitle={out ? t("Bank transfers Perkly made to merchants, recorded by finance.") : t("Commission + VAT merchants transferred to Perkly, recorded by finance.")}
        formula={<Line sign="=" strong label={t("{n} payment(s)", { n: rows.length })} value={sum(rows, (p) => p.amount)} />}>
        <Table head={[t("Paid at"), t("Merchant"), t("Bank reference"), t("Amount"), ""]} empty={t("No payments yet.")}>
          {rows.map((p) => (
            <tr key={p.id}>
              <Td>{dateTime(p.paid_at)}</Td>
              <Td phone="lead">{p.settlement?.merchant?.name}<div className="font-mono text-xs text-zinc-500">{p.settlement?.merchant?.merchant_code}</div></Td>
              <Td className="font-mono">{p.reference}</Td>
              <Td phone="sum" className="font-semibold"><Amount v={p.amount} /></Td>
              <Td><Link href={`/admin/explain?metric=settlement&id=${p.settlement?.id}`} className="text-sm font-semibold text-perk-purple hover:underline">{t("Settlement")} →</Link></Td>
            </tr>
          ))}
        </Table>
      </Explained>
    );
  }

  // ── Dues per merchant ──
  if (metric === "to_be_paid" || metric === "owed_by") {
    const { data } = await supabase.rpc("merchant_balances");
    const due = (b: Balance) => (metric === "to_be_paid"
      ? Math.max(Number(b.net_to_settle), 0) + Math.max(Number(b.pending_settlements), 0)
      : -Math.min(Number(b.net_to_settle), 0) - Math.min(Number(b.pending_settlements), 0));
    const rows = ((data ?? []) as Balance[]).filter((b) => due(b) > 0 && (!merchantScope || merchantScope.includes(b.merchant_id))).sort((a, b) => due(b) - due(a));
    const { data: open } = rows.length
      ? await supabase.from("redemptions").select(TX_SELECT).in("merchant_id", rows.map((b) => b.merchant_id)).is("settlement_id", null).neq("status", "reversed")
          .or("payment_method.eq.merchant,payment_status.eq.paid").order("created_at", { ascending: false }).limit(2000).returns<Tx[]>()
      : { data: [] as Tx[] };
    const txOf = (id: string) => (open ?? []).filter((r) => r.merchant?.id === id);
    return (
      <Explained title={metric === "to_be_paid" ? t("To be paid to merchants") : t("Merchants owe Perkly")} value={sum(rows, due)}
        subtitle={metric === "to_be_paid" ? t("Per merchant: unsettled in-app money owed to them plus open settlements in their favour.") : t("Per merchant: unsettled commission + VAT from cashier sales plus open settlements in Perkly's favour.")}
        formula={<Line sign="=" strong label={t("{n} merchant(s)", { n: rows.length })} value={sum(rows, due)} />}>
        {rows.length === 0 ? <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">{t("Nothing due")}</div> : (
          <div className="space-y-3">
            {rows.map((b) => (
              <ExpandRow key={b.merchant_id} openLabel={t("View transactions")} closeLabel={t("Hide transactions")} summary={<>
                <div className="min-w-0 basis-48"><div className="truncate font-semibold">{b.merchant_name}</div><div className="font-mono text-xs text-zinc-500">{b.merchant_code}</div></div>
                <div className="text-sm"><div className="text-xs text-zinc-500">{t("Net to settle")}</div><Amount v={b.net_to_settle} /></div>
                <div className="text-sm"><div className="text-xs text-zinc-500">{t("Open settlements")}</div><Amount v={b.pending_settlements} /></div>
                <div className="text-sm"><div className="text-xs text-zinc-500">{t("Total")}</div><b><Amount v={due(b)} /></b></div>
              </>}>
                <TxTable rows={txOf(b.merchant_id)} t={t} />
                <div className="mt-3 flex flex-wrap gap-4 px-1 text-sm">
                  <Link href={`/admin/merchants/${b.merchant_id}`} className="font-semibold text-perk-purple hover:underline">{t("Open merchant")} →</Link>
                  {Number(b.pending_settlements) !== 0 && <Link href={`/admin/explain?metric=open_settlements&merchant=${b.merchant_id}`} className="font-semibold text-perk-purple hover:underline">{t("Open settlements")} →</Link>}
                </div>
              </ExpandRow>
            ))}
          </div>
        )}
      </Explained>
    );
  }

  // ── Period figures: GMV, net revenue, VAT ──
  if (metric === "gmv" || metric === "net_revenue" || metric === "vat") {
    const from = periodStart(days);
    let q = inScope(supabase.from("redemptions").select(TX_SELECT).neq("status", "reversed").gte("created_at", `${from}T00:00:00+02:00`)
      .order("created_at", { ascending: false }).limit(1000), merchantScope);
    if (merchant) q = q.eq("merchant_id", merchant);
    const { data } = await q.returns<Tx[]>();
    const rows = data ?? [];
    const title = { gmv: t("Total volume (GMV)"), net_revenue: t("Net revenue"), vat: t("VAT on commission") }[metric];
    const value = metric === "gmv" ? sum(rows, (r) => r.original_amount) : metric === "net_revenue" ? sum(rows, (r) => r.commission_amount) : sum(rows, (r) => r.vat_amount);
    return (
      <Explained title={title + scopeNote} value={value} subtitle={t("Last {days} days · {n} transactions (reversed ones excluded)", { days, n: rows.length })}
        formula={<>
          <Line label={t("Total GMV (bills before discount)")} value={sum(rows, (r) => r.original_amount)} strong={metric === "gmv"} />
          <Line sign="−" label={t("Student discounts")} value={sum(rows, (r) => r.discount_amount)} />
          <Line sign="=" label={t("Paid after discount")} value={sum(rows, (r) => r.final_amount)} />
          <Line sign="→" label={t("Perkly commission (net revenue)")} value={sum(rows, (r) => r.commission_amount)} strong={metric === "net_revenue"} />
          <Line sign="→" label={t("VAT on commission")} value={sum(rows, (r) => r.vat_amount)} strong={metric === "vat"} />
          <Line sign="→" label={t("Merchants' net (settlement amount)")} value={sum(rows, (r) => r.merchant_net)} />
        </>}
        exportParams={{ from, merchant: merchant || undefined }}>
        <TxTable rows={rows} t={t} />
      </Explained>
    );
  }

  notFound();
}

function Explained({ title, value, subtitle, formula, children, exportParams, filterNote, clear }: {
  title: string; value: number; subtitle: string; formula: React.ReactNode; children: React.ReactNode;
  exportParams?: Record<string, string | undefined>; filterNote?: string; clear?: string;
}) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={exportParams && <ExportButtons kind="transactions" params={exportParams} />} />
      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl p-6 text-white shadow-sm perk-gradient">
          <div className="text-xs font-semibold uppercase tracking-wide text-white/80">{title}</div>
          <div className="mt-2 text-4xl font-extrabold"><Amount v={value} /></div>
        </div>
        <Card title={<Icon name="calculator" size={18} />} className="lg:col-span-2"><div className="space-y-1 text-sm">{formula}</div></Card>
      </div>
      {filterNote && <div className="mb-3 text-sm text-zinc-600">{filterNote} · <Link href={clear!} className="font-semibold text-perk-purple hover:underline"><Icon name="x" size={14} className="inline-block align-[-2px]" /></Link></div>}
      {children}
      <div className="mt-6"><LinkButton href="/admin/finance" variant="secondary">← Finance</LinkButton></div>
    </>
  );
}

function TxTable({ rows, t }: { rows: Tx[]; t: (s: string, v?: Record<string, string | number>) => string }) {
  return (
    <Table head={[t("Time"), t("Merchant"), t("Perk"), t("Payment"), t("Total GMV"), t("Paid"), t("Commission"), t("VAT"), t("Settlement amount"), t("To settle"), t("Status")]} empty={t("No transactions.")}>
      {rows.map((r) => (
        <tr key={r.id}>
          <Td className="whitespace-nowrap">{dateTime(r.created_at)}<div className="font-mono text-xs font-semibold text-zinc-600">{r.tx_code}</div><div className="font-mono text-xs text-zinc-500">{r.verification_code}</div></Td>
          <Td phone="lead">{r.merchant && <Link href={`/admin/merchants/${r.merchant.id}`} className="hover:underline">{r.merchant.name}</Link>}</Td>
          <Td>{r.perk?.title}</Td>
          <Td><Badge tone={r.payment_method === "in_app" ? "active" : "paused"}>{r.payment_method === "in_app" ? t("In app") : t("Cashier")}</Badge></Td>
          <Td><Amount v={r.original_amount} /></Td>
          <Td><Amount v={r.final_amount} /></Td>
          <Td><Amount v={r.commission_amount} /></Td>
          <Td><Amount v={r.vat_amount} /></Td>
          <Td><Amount v={r.merchant_net} /></Td>
          <Td phone="sum" className={Number(r.settle_amount) < 0 ? "font-semibold text-amber-700" : "font-semibold text-perk-purple"}><Amount v={r.settle_amount} /></Td>
          <Td phone="sum" className="whitespace-nowrap text-xs font-semibold">{r.settlement
            ? <Link href={`/admin/explain?metric=settlement&id=${r.settlement.id}`} className={`hover:underline ${r.settlement.status === "paid" ? "text-emerald-700" : "text-amber-700"}`}>{t(settlementLabel(r.settlement.status))}</Link>
            : <span className="text-zinc-500">{t("Not settled yet")}</span>}</Td>
        </tr>
      ))}
    </Table>
  );
}

function SettlementTable({ rows, t, lines }: { rows: Settlement[]; t: (s: string, v?: Record<string, string | number>) => string; lines: (Tx & { settlement_id: string })[] }) {
  if (rows.length === 0) return <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">{t("No settlements yet.")}</div>;
  return (
    <div className="space-y-3">
      {rows.map((s) => (
        <ExpandRow key={s.id} openLabel={t("View transactions")} closeLabel={t("Hide transactions")} summary={<>
          <div className="min-w-0 basis-48"><div className="truncate font-semibold">{s.merchant?.name}</div><div className="font-mono text-xs text-zinc-500">{s.settlement_code} · {s.period_start} → {s.period_end}</div></div>
          <div className="text-sm"><div className="text-xs text-zinc-500">{t("Net amount")}</div><b><Amount v={s.amount} /></b></div>
          <div className="text-sm"><div className="text-xs text-zinc-500">{t("Paid")}</div><Amount v={s.paid_amount} /></div>
          <div className="text-xs font-semibold text-amber-700">{t(settlementLabel(s.status))}</div>
        </>}>
          <TxTable rows={lines.filter((l) => l.settlement_id === s.id)} t={t} />
          <div className="mt-3 px-1 text-sm"><Link href={`/admin/explain?metric=settlement&id=${s.id}`} className="font-semibold text-perk-purple hover:underline">{t("Open settlement")} →</Link></div>
        </ExpandRow>
      ))}
    </div>
  );
}
