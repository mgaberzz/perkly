import Link from "next/link";
import { inScope, requireStaff } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { Badge, LinkButton, PageHeader, Table, Td } from "@/components/ui";
import { date, discountLabel, tierFor } from "@/lib/format";
import type { Perk } from "@/lib/types";
import { reviewPerk } from "../actions";

export const metadata = { title: "Perks" };
const STATUSES = ["pending", "active", "paused", "rejected", "expired"];

export default async function AdminPerksPage({ searchParams }: PageProps<"/admin/perks">) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "pending";
  const { supabase, merchantScope } = await requireStaff("perks");
  const t = await getT();
  let query = inScope(supabase.from("perks").select("*, merchant:merchants(id, name)").order("created_at", { ascending: false }).limit(300), merchantScope);
  if (status !== "all") query = query.eq("status", status);
  const { data } = await query.returns<(Perk & { merchant: { id: string; name: string } })[]>();
  return (
    <>
      <PageHeader title={t("Campaigns & perks")} subtitle={t("Hero perks (above 30%) wait here for approval.")}
        actions={[...STATUSES, "all"].map((s) => <LinkButton key={s} href={`/admin/perks?status=${s}`} variant={s === status ? "primary" : "secondary"} >{t(s)}</LinkButton>)} />
      <Table head={[t("Perk"), t("Merchant"), t("Discount"), t("Limits"), t("Ends"), t("Status"), ""]} empty={status === "pending" ? t("Nothing waiting for approval 🎉") : t("No perks.")}>
        {(data ?? []).map((p) => {
          const tier = tierFor(p);
          return (
            <tr key={p.id}>
              <Td><Link href={`/admin/perks/${p.id}`} className="font-semibold hover:text-perk-purple">{p.is_flash && "⚡ "}{p.title}</Link></Td>
              <Td><Link href={`/admin/merchants/${p.merchant.id}`} className="hover:underline">{p.merchant.name}</Link></Td>
              <Td>{discountLabel(p, t)} {tier && <span className={`ms-1 rounded-full px-2 py-0.5 text-xs font-bold ${tier.cls}`}>{t(tier.name)}</span>}</Td>
              <Td className="text-xs text-zinc-500">{p.max_uses_per_user ?? "∞"}/{t("student")} · {p.daily_cap ?? "∞"}/{t("day")}</Td>
              <Td>{date(p.end_at)}</Td>
              <Td><Badge tone={p.status}>{t(p.status)}</Badge></Td>
              <Td>
                {p.status === "pending" && (
                  <div className="flex gap-2">
                    <form action={reviewPerk}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="decision" value="approve" />
                      <button className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">{t("Approve")}</button></form>
                    <Link href={`/admin/perks/${p.id}#review`} className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-semibold">{t("Review")}</Link>
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
