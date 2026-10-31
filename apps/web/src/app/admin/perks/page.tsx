import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Badge, LinkButton, PageHeader, Table, Td } from "@/components/ui";
import { date, discountLabel, tierFor } from "@/lib/format";
import type { Perk } from "@/lib/types";
import { reviewPerk } from "../actions";

export const metadata = { title: "Perks" };
const STATUSES = ["pending", "active", "paused", "rejected", "expired"];

export default async function AdminPerksPage({ searchParams }: PageProps<"/admin/perks">) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "pending";
  const { supabase } = await requireAdmin();
  let query = supabase.from("perks").select("*, merchant:merchants(id, name)").order("created_at", { ascending: false }).limit(300);
  if (status !== "all") query = query.eq("status", status);
  const { data } = await query.returns<(Perk & { merchant: { id: string; name: string } })[]>();
  return (
    <>
      <PageHeader title="Perks" subtitle="Hero perks (above 30%) wait here for approval."
        actions={[...STATUSES, "all"].map((s) => <LinkButton key={s} href={`/admin/perks?status=${s}`} variant={s === status ? "primary" : "secondary"} className="capitalize">{s}</LinkButton>)} />
      <Table head={["Perk", "Merchant", "Discount", "Limits", "Ends", "Status", ""]} empty={status === "pending" ? "Nothing waiting for approval 🎉" : "No perks."}>
        {(data ?? []).map((p) => {
          const tier = tierFor(p);
          return (
            <tr key={p.id}>
              <Td><Link href={`/admin/perks/${p.id}`} className="font-semibold hover:text-perk-purple">{p.is_flash && "⚡ "}{p.title}</Link></Td>
              <Td><Link href={`/admin/merchants/${p.merchant.id}`} className="hover:underline">{p.merchant.name}</Link></Td>
              <Td>{discountLabel(p)} {tier && <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${tier.cls}`}>{tier.name}</span>}</Td>
              <Td className="text-xs text-zinc-500">{p.max_uses_per_user ?? "∞"}/student · {p.daily_cap ?? "∞"}/day</Td>
              <Td>{date(p.end_at)}</Td>
              <Td><Badge>{p.status}</Badge></Td>
              <Td>
                {p.status === "pending" && (
                  <div className="flex gap-2">
                    <form action={reviewPerk}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="decision" value="approve" />
                      <button className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">Approve</button></form>
                    <Link href={`/admin/perks/${p.id}#review`} className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-semibold">Review</Link>
                  </div>
                )}
              </Td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
