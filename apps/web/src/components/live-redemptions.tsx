"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "./i18n";
import { Badge, Table, Td } from "./ui";
import { dateTime, egp } from "@/lib/format";

export type FeedRow = {
  id: string; created_at: string; verification_code: string; branch_id: string | null;
  original_amount: number | null; discount_amount: number | null; final_amount: number | null;
  status: string; first_time_at_merchant: boolean; channel: string; payment_method: string;
  perk: { title: string } | null; branch: { name: string } | null; qr: { label: string; cashier_name: string | null } | null;
};

export const FEED_SELECT = "id, created_at, verification_code, branch_id, original_amount, discount_amount, final_amount, status, first_time_at_merchant, channel, payment_method, perk:perks(title), branch:merchant_branches(name), qr:branch_qr_codes(label, cashier_name)";

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
      <Table head={[t("Code"), t("Time"), t("Perk"), t("Branch / cashier"), t("Bill"), t("Discount"), t("Payment"), t("Customer"), t("Status")]}
        empty={t("No redemptions yet. Put your QR on the cashier table and they'll show up here.")}>
        {rows.map((r) => (
          <tr key={r.id} className={r.id === fresh ? "bg-emerald-50 transition-colors" : ""}>
            <Td><span className="rounded-lg bg-perk-ink px-2 py-1 font-mono text-base font-bold tracking-widest text-white">{r.verification_code}</span></Td>
            <Td className="whitespace-nowrap">{dateTime(r.created_at)}</Td>
            <Td>{r.perk?.title}</Td>
            <Td>{r.branch?.name ?? `🌐 ${t("Online")}`}<div className="text-xs text-zinc-500">{r.qr?.cashier_name ?? r.qr?.label}</div></Td>
            <Td>{egp(r.original_amount)}</Td>
            <Td className="font-semibold text-perk-purple">{egp(r.discount_amount)}</Td>
            <Td>{r.payment_method === "in_app"
              ? <Badge tone="active">{t("Paid in app")} · {egp(r.final_amount)}</Badge>
              : <Badge tone="paused">{t("Pay at cashier")}</Badge>}</Td>
            <Td>{r.first_time_at_merchant ? <Badge tone="live">{t("New customer")}</Badge> : <Badge tone="paused">{t("Recurring customer")}</Badge>}</Td>
            <Td><Badge tone={r.status}>{t(r.status)}</Badge></Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
