"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge, Table, Td } from "./ui";
import { dateTime, egp } from "@/lib/format";

export type FeedRow = {
  id: string; created_at: string; verification_code: string;
  original_amount: number | null; discount_amount: number | null; final_amount: number | null;
  status: string; first_time_at_merchant: boolean;
  perk: { title: string } | null; branch: { name: string } | null;
};

const SELECT = "id, created_at, verification_code, original_amount, discount_amount, final_amount, status, first_time_at_merchant, perk:perks(title), branch:merchant_branches(name)";

export function LiveRedemptions({ merchantId, initial }: { merchantId: string; initial: FeedRow[] }) {
  const [rows, setRows] = useState(initial);
  const [fresh, setFresh] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`redemptions:${merchantId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "redemptions", filter: `merchant_id=eq.${merchantId}` }, async (payload) => {
        const { data } = await supabase.from("redemptions").select(SELECT).eq("id", (payload.new as { id: string }).id).single<FeedRow>();
        if (data) {
          setRows((r) => [data, ...r.filter((x) => x.id !== data.id)].slice(0, 200));
          setFresh(data.id);
          setTimeout(() => setFresh((f) => (f === data.id ? null : f)), 8000);
        }
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => { supabase.removeChannel(channel); };
  }, [merchantId]);

  return (
    <>
      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className={`h-2.5 w-2.5 rounded-full ${live ? "animate-pulse bg-emerald-500" : "bg-zinc-300"}`} />
        {live ? "Live — new redemptions appear instantly" : "Connecting…"}
      </div>
      <Table head={["Code", "Time", "Perk", "Branch", "Bill", "Discount", "Student", "Status"]} empty="No redemptions yet. Put your QR on the cashier table and they'll show up here.">
        {rows.map((r) => (
          <tr key={r.id} className={r.id === fresh ? "bg-emerald-50 transition-colors" : ""}>
            <Td><span className="rounded-lg bg-perk-ink px-2 py-1 font-mono text-base font-bold tracking-widest text-white">{r.verification_code}</span></Td>
            <Td className="whitespace-nowrap">{dateTime(r.created_at)}</Td>
            <Td>{r.perk?.title}</Td>
            <Td>{r.branch?.name}</Td>
            <Td>{egp(r.original_amount)}</Td>
            <Td className="font-semibold text-perk-purple">{egp(r.discount_amount)}</Td>
            <Td>{r.first_time_at_merchant ? <Badge tone="live">New</Badge> : <Badge tone="paused">Returning</Badge>}</Td>
            <Td><Badge>{r.status}</Badge></Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
