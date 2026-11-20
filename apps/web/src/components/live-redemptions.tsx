"use client";
import { ReceiptRefForm } from "./receipt-ref-form";
import { Icon } from "@/components/icons";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "./i18n";
import { Badge, Table, Td } from "./ui";
import { dateTime, discountPct, egp, shortDateTime } from "@/lib/format";
import { DetailRow, ExpandItem, ExpandList } from "./expand-list";
import { FEED_SELECT, type FeedRow } from "@/lib/feed";

export function LiveRedemptions({ merchantId, branchId, initial }: { merchantId: string; branchId: string | null; initial: FeedRow[] }) {
  const t = useT();
  const [rows, setRows] = useState(initial);
  const [fresh, setFresh] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`redemptions:${merchantId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "redemptions", filter: `merchant_id=eq.${merchantId}` }, async (payload) => {
        const { data } = await supabase.from("redemptions").select(FEED_SELECT).eq("id", (payload.new as { id: string }).id).single<FeedRow>();
        if (data && (!branchId || data.branch_id === branchId)) {
          setRows((r) => [data, ...r.filter((x) => x.id !== data.id)].slice(0, 300));
          setFresh(data.id);
          setTimeout(() => setFresh((f) => (f === data.id ? null : f)), 8000);
        }
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => { supabase.removeChannel(channel); };
  }, [merchantId, branchId]);

  return (
    <>
      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className={`h-2.5 w-2.5 rounded-full ${live ? "animate-pulse bg-emerald-500" : "bg-zinc-300"}`} />
        {live ? t("Live — new redemptions appear instantly") : t("Connecting…")}
      </div>
      <ExpandList empty={t("No redemptions yet. Put your QR on the cashier table and they'll show up here.")}>
        {rows.map((r) => (
          <div key={r.id} className={r.id === fresh ? "rounded-2xl ring-2 ring-emerald-400 transition" : ""}>
          <ExpandItem accent={r.status === "flagged" ? "amber" : r.status === "reversed" ? "red" : undefined} summary={
            <div className="flex items-center gap-3">
              <span className="shrink-0 rounded-xl bg-perk-ink px-2.5 py-2 font-mono text-base font-bold tracking-widest text-white">{r.verification_code}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-bold">{r.perk?.title}</span>
                  <span className="shrink-0 font-extrabold">{egp(r.original_amount)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
                  <span className="truncate"><span className="font-mono font-semibold text-zinc-600">{r.tx_code}</span> · {shortDateTime(r.created_at)}</span>
                  <span className="shrink-0 font-semibold text-perk-purple">−{egp(r.discount_amount)}{discountPct(r.discount_amount, r.original_amount) && ` (${discountPct(r.discount_amount, r.original_amount)})`}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <Badge tone={r.status} className="!text-[10px]">{t(r.status)}</Badge>
                  <Badge tone={r.payment_method === "in_app" ? "active" : "paused"} className="!text-[10px]">{r.payment_method === "in_app" ? t("Paid in app") : t("Pay at cashier")}</Badge>
                  <Badge tone={r.first_time_at_merchant ? "live" : "paused"} className="!text-[10px]">{r.first_time_at_merchant ? t("New customer") : t("Recurring customer")}</Badge>
                </div>
              </div>
            </div>}>
            <DetailRow label={t("Transaction ID")}><span className="font-mono text-zinc-600">{r.tx_code}</span></DetailRow>
            <DetailRow label={t("Time")}>{dateTime(r.created_at)}</DetailRow>
            <DetailRow label={t("Shop receipt / order no.")}><ReceiptRefForm id={r.id} value={r.receipt_ref ?? null} /></DetailRow>
            <DetailRow label={t("Branch / cashier")}>{r.branch?.name ?? <><Icon name="globe" size={14} className="me-1 inline-block align-[-2px]" />{t("Online")}</>}{(r.qr?.cashier_name ?? r.qr?.label) && <span className="block text-xs text-zinc-500">{r.qr?.cashier_name ?? r.qr?.label}</span>}</DetailRow>
            <DetailRow label={t("Bill")}>{egp(r.original_amount)}</DetailRow>
            <DetailRow label={t("Discount")}>{egp(r.discount_amount)}{discountPct(r.discount_amount, r.original_amount) && <span className="ms-1 text-xs font-semibold text-perk-purple">({discountPct(r.discount_amount, r.original_amount)})</span>}</DetailRow>
            <DetailRow label={t("Paid after discount")}>{egp(r.final_amount)}</DetailRow>
          </ExpandItem>
          </div>
        ))}
      </ExpandList>
      <Table className="hidden sm:block" head={[t("Code"), t("Transaction"), t("Perk"), t("Branch / cashier"), t("Amount"), t("Customer"), t("Status")]}
        empty={t("No redemptions yet. Put your QR on the cashier table and they'll show up here.")}>
        {rows.map((r) => {
          const pct = discountPct(r.discount_amount, r.original_amount);
          const who = r.qr?.cashier_name ?? r.qr?.label;
          return (
          <tr key={r.id} className={r.id === fresh ? "bg-emerald-50 transition-colors" : r.status === "reversed" ? "bg-zinc-50/60" : r.status === "flagged" ? "bg-amber-50/50" : ""}>
            <Td><span className="rounded-lg bg-perk-ink px-2 py-1 font-mono text-base font-bold tracking-widest text-white">{r.verification_code}</span></Td>
            <Td className="whitespace-nowrap">
              <div className="font-mono text-[13px] font-bold">{r.tx_code}</div>
              <div className="text-xs text-zinc-500">{shortDateTime(r.created_at)}</div>
              {r.receipt_ref && <div className="font-mono text-[11px] text-zinc-400" title={t("Shop receipt / order no.")}>#{r.receipt_ref}</div>}
            </Td>
            <Td className="min-w-[120px] max-w-[200px]"><div className="line-clamp-2 text-[13px] text-zinc-700" title={r.perk?.title}>{r.perk?.title}</div></Td>
            <Td className="max-w-[200px]">
              <div className="truncate font-semibold" title={r.branch?.name}>{r.branch?.name ?? <><Icon name="globe" size={12} className="me-1 inline-block align-[-1px]" />{t("Online")}</>}</div>
              {who && <div className="truncate text-xs text-zinc-500" title={who}>{who}</div>}
            </Td>
            <Td className="whitespace-nowrap">
              <div className={`font-bold ${r.status === "reversed" ? "text-zinc-400 line-through" : ""}`}>{egp(r.original_amount)}</div>
              <div className="text-xs font-semibold text-perk-purple">−{egp(r.discount_amount)}{pct && <span className="font-normal text-zinc-500"> ({pct})</span>}</div>
              <div className="mt-1">{r.payment_method === "in_app"
                ? <Badge tone="active" className="!text-[10px]">{t("Paid in app")} · {egp(r.final_amount)}</Badge>
                : <Badge tone="paused" className="!text-[10px]">{t("Pay at cashier")}</Badge>}</div>
            </Td>
            <Td className="whitespace-nowrap">{r.first_time_at_merchant ? <Badge tone="live">{t("New customer")}</Badge> : <Badge tone="paused">{t("Recurring customer")}</Badge>}</Td>
            <Td className="whitespace-nowrap"><Badge tone={r.status}>{t(r.status)}</Badge></Td>
          </tr>
          );
        })}
      </Table>
    </>
  );
}
