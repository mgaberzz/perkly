import { Icon } from "@/components/icons";
import Link from "next/link";
import { inScope, requireStaff } from "@/lib/auth";
import { Badge, PageHeader, Table, Td } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { Avatar, DetailRow, ExpandItem, ExpandList } from "@/components/expand-list";
import { ExportButtons } from "@/components/export-buttons";
import { dateTime, egp, shortDateTime } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { setRedemptionStatus } from "../actions";
import { AGE_LABEL, applyTxFilters, readTxFilters, txSelect } from "@/lib/tx-filters";
import { Amount } from "@/components/ui";
import { settlementLabel } from "@/lib/types";
import { ReceiptRefForm } from "@/components/receipt-ref-form";

export const metadata = { title: "Transactions" };

type Row = {
  id: string; created_at: string; verification_code: string; tx_code: string; original_amount: number | null; discount_amount: number | null; final_amount: number | null;
  status: string; flag_reason: string | null; xp_awarded: number; channel: string; payment_method: string; first_time_at_merchant: boolean;
  merchant: { id: string; name: string; merchant_code: string }; perk: { title: string }; branch: { name: string } | null;
  qr: { label: string; cashier_name: string | null } | null;
  student: { full_name: string | null; student_code: string | null; user_code: string } | null;
  settle_amount: number | null; settlement: { id: string; status: string; settlement_code: string } | null; receipt_ref: string | null;
};

export default async function AdminRedemptionsPage({ searchParams }: PageProps<"/admin/redemptions">) {
  const sp = await searchParams;
  const g = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const f = readTxFilters(g);
  const { supabase, can, merchantScope } = await requireStaff("redemptions_view");
  const t = await getT();
  const select = txSelect("id, created_at, verification_code, tx_code, original_amount, discount_amount, final_amount, status, flag_reason, xp_awarded, channel, payment_method, first_time_at_merchant, merchant:merchants(id, name, merchant_code), perk:perks(title), branch:merchant_branches(name), qr:branch_qr_codes(label, cashier_name), student:profiles(full_name, student_code, user_code), settle_amount, receipt_ref, settlement:settlements(id, status, settlement_code)", f);
  const query = applyTxFilters(inScope(supabase.from("redemptions").select(select)
    .order("created_at", { ascending: false }).limit(200), merchantScope), f);
  const [{ data }, { data: merchants }, { data: campus }] = await Promise.all([
    query.returns<Row[]>(),
    inScope(supabase.from("merchants").select("id, name").order("name").limit(1000), merchantScope, "id"),
    f.campus && f.campus !== "none" ? supabase.from("campuses").select("name").eq("id", f.campus).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  // Drill-down chips (from Insights) with a way to clear each one
  const without = (k: string) => { const p = new URLSearchParams(f as Record<string, string>); p.delete(k); return `/admin/redemptions?${p}`; };
  const chips = [
    f.category && { k: "category", label: `${t("Sector")}: ${t(f.category)}` },
    f.city && { k: "city", label: `${t("Location")}: ${f.city === "online" ? t("Online") : f.city === "unknown" ? t("Unknown") : f.city}` },
    f.campus && { k: "campus", label: `${t("Campus")}: ${f.campus === "none" ? t("No campus") : (campus as { name: string } | null)?.name ?? ""}` },
    f.age && { k: "age", label: `${t("Age range")}: ${t(AGE_LABEL[f.age] ?? f.age)}` },
  ].filter(Boolean) as { k: string; label: string }[];
  const review = can("redemptions_review");
  return (
    <>
      <PageHeader title={t("Transactions")} subtitle={t("Flagged = no location shared or scanned 300m+ from the branch. Review and reverse fraud.")}
        actions={<ExportButtons kind="transactions" params={f} />} />
      <FilterBar path="/admin/redemptions" search={{ name: "q", value: f.q, placeholder: t("Search transaction ID or code") }}
        keep={Object.fromEntries(Object.entries(f).filter(([k]) => !["q", "merchant", "status", "channel", "payment", "from", "to"].includes(k))) as Record<string, string>}
        fields={[
          { name: "merchant", label: t("Merchant"), type: "select", value: f.merchant, all: t("All merchants"), options: (merchants ?? []).map((m) => ({ value: m.id, label: m.name })) },
          { name: "status", label: t("Status"), type: "select", value: f.status, all: t("All statuses"), options: ["success", "flagged", "reversed"].map((x) => ({ value: x, label: t(x) })) },
          { name: "channel", label: t("Channel"), type: "select", value: f.channel, all: t("All channels"), options: [{ value: "in_store", label: t("In-store") }, { value: "online", label: t("Online") }] },
          { name: "payment", label: t("Payment"), type: "select", value: f.payment, all: t("All payments"), options: [{ value: "merchant", label: t("Paid at cashier") }, { value: "in_app", label: t("Paid in app") }] },
          { name: "from", label: t("From"), type: "date", value: f.from },
          { name: "to", label: t("To"), type: "date", value: f.to },
        ]} />
      {chips.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-zinc-500">{t("From Insights")}:</span>
          {chips.map((c) => <Link key={c.k} href={without(c.k)} className="rounded-full bg-perk-purple/10 px-3 py-1 font-semibold text-perk-purple hover:bg-perk-purple/20">{c.label} <Icon name="x" size={12} className="ms-1 inline-block align-[-1px]" /></Link>)}
        </div>
      )}
      <ExpandList empty={t("No transactions.")}>
        {(data ?? []).map((r) => (
          <ExpandItem key={r.id} accent={r.status === "flagged" ? "amber" : r.status === "reversed" ? "red" : undefined} summary={
            <div className="flex items-center gap-3">
              <Avatar name={r.merchant.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-bold">{r.merchant.name}</span>
                  <span className={`shrink-0 font-extrabold ${r.status === "reversed" ? "text-zinc-400 line-through" : ""}`}><Amount v={r.original_amount} /></span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
                  <span className="truncate"><span className="font-mono font-semibold text-perk-purple">{r.tx_code}</span> · {shortDateTime(r.created_at)}</span>
                  <span className="shrink-0 text-emerald-600">−<Amount v={r.discount_amount} /></span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <Badge tone={r.status} className="!text-[10px]">{t(r.status)}</Badge>
                  <Badge tone={r.payment_method === "in_app" ? "active" : "paused"} className="!text-[10px]">{r.payment_method === "in_app" ? t("In app") : t("Cashier")}</Badge>
                  {r.status !== "reversed" && <Badge tone={r.settlement?.status === "paid" ? "paid" : r.settlement?.status === "partially_paid" ? "pending" : "paused"} className="!text-[10px]">{t(settlementLabel(r.settlement?.status))}</Badge>}
                </div>
              </div>
            </div>}>
            <DetailRow label={t("Time")}>{dateTime(r.created_at)}</DetailRow>
            <DetailRow label={t("Transaction ID")}><span className="font-mono text-perk-purple">{r.tx_code}</span></DetailRow>
            <DetailRow label={t("Code")}><span className="font-mono">{r.verification_code}</span></DetailRow>
            <DetailRow label={t("Shop receipt / order no.")}>{review ? <ReceiptRefForm id={r.id} value={r.receipt_ref} /> : <span className="font-mono">{r.receipt_ref ?? "—"}</span>}</DetailRow>
            {r.settlement && <DetailRow label={t("Settlement ID")}><Link href={`/admin/explain?metric=settlement&id=${r.settlement.id}`} className="font-mono text-perk-purple underline">{r.settlement.settlement_code}</Link></DetailRow>}
            <DetailRow label={t("Student")}>{r.student?.full_name ?? "—"} <span className="font-mono text-xs text-zinc-500">{r.student?.student_code ?? r.student?.user_code}</span></DetailRow>
            <DetailRow label={t("Merchant")}><Link href={`/admin/merchants/${r.merchant.id}`} className="underline">{r.merchant.name}</Link> <span className="font-mono text-xs text-zinc-500">{r.merchant.merchant_code}</span></DetailRow>
            <DetailRow label={t("Branch / cashier")}>{r.branch?.name ?? <><Icon name="globe" size={14} className="me-1 inline-block align-[-2px]" />{t("Online")}</>}{(r.qr?.cashier_name ?? r.qr?.label) && <span className="block text-xs text-zinc-500">{r.qr?.cashier_name ?? r.qr?.label}</span>}</DetailRow>
            <DetailRow label={t("Perk")}>{r.perk.title}</DetailRow>
            <DetailRow label={t("Total GMV")}>{egp(r.original_amount)}</DetailRow>
            <DetailRow label={t("Discount")}>{egp(r.discount_amount)}</DetailRow>
            <DetailRow label={t("Paid after discount")}>{egp(r.final_amount)}</DetailRow>
            <DetailRow label={t("To settle")}>{r.status === "reversed" ? "—" : egp(r.settle_amount)}</DetailRow>
            {r.flag_reason && <DetailRow label={t("Flag reason")}>{r.flag_reason}</DetailRow>}
            {review && r.status !== "success" || review && r.status !== "reversed" ? (
              <div className="my-2 flex gap-2">
                {review && r.status !== "success" && (
                  <form action={setRedemptionStatus} className="flex-1"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="success" />
                    <button className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white"><Icon name="check" size={14} className="me-1 inline-block align-[-2px]" />{t("Mark OK")}</button></form>
                )}
                {review && r.status !== "reversed" && (
                  <form action={setRedemptionStatus} className="flex-1"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="reversed" /><input type="hidden" name="reason" value="reversed by Perkly" />
                    <button className="w-full rounded-xl border border-red-200 bg-white py-2.5 text-sm font-semibold text-red-600"><Icon name="undo" size={14} className="me-1 inline-block align-[-2px]" />{t("Reverse")}</button></form>
                )}
              </div>
            ) : null}
          </ExpandItem>
        ))}
      </ExpandList>
      <Table className="hidden sm:block" head={[t("Time / ID"), t("Student"), t("Merchant"), t("Branch / cashier"), t("Perk"), t("Total GMV"), t("Discount"), t("Payment"), t("To settle"), t("Status"), ""]} empty={t("No transactions.")}>
        {(data ?? []).map((r) => (
          <tr key={r.id}>
            <Td className="whitespace-nowrap">{dateTime(r.created_at)}<div className="font-mono text-xs font-semibold text-perk-purple">{r.tx_code}</div><div className="font-mono text-xs text-zinc-500">{r.verification_code}</div>{r.receipt_ref && <div className="font-mono text-xs text-zinc-500" title={t("Shop receipt / order no.")}>#{r.receipt_ref}</div>}</Td>
            <Td>{r.student?.full_name ?? "—"}<div className="font-mono text-xs text-zinc-500">{r.student?.student_code ?? r.student?.user_code}</div></Td>
            <Td><Link href={`/admin/merchants/${r.merchant.id}`} className="hover:underline">{r.merchant.name}</Link><div className="font-mono text-xs text-zinc-500">{r.merchant.merchant_code}</div></Td>
            <Td>{r.branch?.name ?? <><Icon name="globe" size={14} className="me-1 inline-block align-[-2px]" />{t("Online")}</>}<div className="text-xs text-zinc-500">{r.qr?.cashier_name ?? r.qr?.label}</div></Td>
            <Td>{r.perk.title}</Td>
            <Td><Amount v={r.original_amount} /></Td>
            <Td><Amount v={r.discount_amount} /></Td>
            <Td><Badge tone={r.payment_method === "in_app" ? "active" : "paused"}>{r.payment_method === "in_app" ? t("In app") : t("Cashier")}</Badge></Td>
            <Td className="whitespace-nowrap">{r.status === "reversed" ? "—" : <>{egp(r.settle_amount)}<div className="mt-1"><Badge tone={r.settlement?.status === "paid" ? "paid" : r.settlement?.status === "partially_paid" ? "pending" : "paused"}>{t(settlementLabel(r.settlement?.status))}</Badge></div>{r.settlement && <Link href={`/admin/explain?metric=settlement&id=${r.settlement.id}`} className="font-mono text-xs text-zinc-500 hover:underline">{r.settlement.settlement_code}</Link>}</>}</Td>
            <Td><Badge tone={r.status}>{t(r.status)}</Badge>{r.flag_reason && <div className="mt-1 text-xs text-zinc-500">{r.flag_reason}</div>}</Td>
            <Td className="whitespace-nowrap text-end">
              {review && r.status !== "success" && (
                <form action={setRedemptionStatus} className="inline"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="success" />
                  <button className="me-3 text-xs font-semibold text-emerald-700 hover:underline">{t("Mark OK")}</button></form>
              )}
              {review && r.status !== "reversed" && (
                <form action={setRedemptionStatus} className="inline"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="reversed" /><input type="hidden" name="reason" value="reversed by Perkly" />
                  <button className="text-xs font-semibold text-red-600 hover:underline">{t("Reverse")}</button></form>
              )}
            </Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
