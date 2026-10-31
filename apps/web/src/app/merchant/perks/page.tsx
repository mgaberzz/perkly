import Link from "next/link";
import { requireMerchant } from "@/lib/auth";
import { Badge, LinkButton, PageHeader, Table, Td } from "@/components/ui";
import { date, discountLabel, tierFor } from "@/lib/format";
import type { Perk } from "@/lib/types";
import { setPerkStatus } from "../actions";

export const metadata = { title: "Perks" };

export default async function PerksPage() {
  const { supabase, merchant, canManage } = await requireMerchant();
  const { data: perks } = await supabase.from("perks").select("*, branch:merchant_branches(name)")
    .eq("merchant_id", merchant.id).order("created_at", { ascending: false })
    .returns<(Perk & { branch: { name: string } | null })[]>();
  return (
    <>
      <PageHeader title="Perks" subtitle="What students get when they scan your QR."
        actions={canManage && <LinkButton href="/merchant/perks/new">+ New perk</LinkButton>} />
      <Table head={["Perk", "Discount", "Tier", "Branch", "Ends", "Status", ""]} empty="No perks yet — create your first one.">
        {(perks ?? []).map((p) => {
          const tier = tierFor(p);
          return (
            <tr key={p.id}>
              <Td><Link href={`/merchant/perks/${p.id}`} className="font-semibold hover:text-perk-purple">{p.is_flash && "⚡ "}{p.title}</Link></Td>
              <Td>{discountLabel(p)}</Td>
              <Td>{tier && <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${tier.cls}`}>{tier.name}</span>}</Td>
              <Td>{p.branch?.name ?? "All branches"}</Td>
              <Td>{date(p.end_at)}</Td>
              <Td><Badge>{p.status}</Badge>{p.status === "rejected" && p.review_note && <div className="mt-1 text-xs text-red-600">{p.review_note}</div>}</Td>
              <Td className="text-right">
                {canManage && (p.status === "active" || p.status === "paused") && (
                  <form action={setPerkStatus}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="status" value={p.status === "active" ? "paused" : "active"} />
                    <button className="text-sm font-semibold text-perk-purple hover:underline">{p.status === "active" ? "Pause" : "Activate"}</button>
                  </form>
                )}
              </Td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
