import { Icon } from "@/components/icons";
import Link from "next/link";
import { inScope, requireStaff } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { Badge, PageHeader, Table, Td } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { date, discountLabel, tierFor } from "@/lib/format";
import type { Perk } from "@/lib/types";
import { adminSetPerkStatus, reviewPerk } from "../actions";

export const metadata = { title: "Perks" };
const STATUSES = ["pending", "active", "paused", "rejected", "expired"];
// Tier = percentage discount band (same bands as the tier badge)
const TIERS: Record<string, [number, number]> = { bronze: [0, 15], silver: [15, 25], gold: [25, 30.0001], hero: [30.0001, 101] };

export default async function AdminPerksPage({ searchParams }: PageProps<"/admin/perks">) {
  const sp = await searchParams;
  const g = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const status = STATUSES.includes(g("status")) ? g("status") : "";
  const merchant = g("merchant"), tier = TIERS[g("tier")] ? g("tier") : "", flash = g("flash"), q = g("q").trim();
  const { supabase, merchantScope } = await requireStaff("perks");
  const t = await getT();
  let query = inScope(supabase.from("perks").select("*, merchant:merchants(id, name)").order("created_at", { ascending: false }).limit(300), merchantScope);
  if (status) query = query.eq("status", status);
  if (merchant) query = query.eq("merchant_id", merchant);
  if (flash) query = query.eq("is_flash", true);
  if (tier) query = query.eq("discount_type", "percentage").gte("discount_value", TIERS[tier][0]).lt("discount_value", TIERS[tier][1]);
  // Search the perk title or the merchant name
  let matchIds: string[] = [];
  if (q) {
    const like = `%${q.replace(/[%_,()]/g, " ")}%`;
    const { data: ms } = await inScope(supabase.from("merchants").select("id").ilike("name", like).limit(200), merchantScope, "id");
    matchIds = (ms ?? []).map((m) => m.id as string);
    query = query.or(matchIds.length ? `title.ilike.${like},merchant_id.in.(${matchIds.join(",")})` : `title.ilike.${like}`);
  }
  type Row = Perk & { merchant: { id: string; name: string } };
  const merchantsQ = inScope(supabase.from("merchants").select("id, name").order("name").limit(1000), merchantScope, "id");
  let waitingQ = supabase.from("perks").select("id", { count: "exact", head: true }).eq("status", "pending");
  if (merchantScope) waitingQ = waitingQ.in("merchant_id", merchantScope.length ? merchantScope : ["00000000-0000-0000-0000-000000000000"]);
  const { data: rows } = (await query) as unknown as { data: Row[] | null };
  const { data: merchants } = (await merchantsQ) as unknown as { data: { id: string; name: string }[] | null };
  const { count: waiting } = (await waitingQ) as unknown as { count: number | null };
  // Waiting-for-approval perks first, then newest
  const data = [...(rows ?? [])].sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending"));
  return (
    <>
      <PageHeader title={t("Campaigns & perks")} subtitle={t("Every new perk and every discount change waits here for approval.")}
        actions={(waiting ?? 0) > 0 && status !== "pending" ? <Link href="/admin/perks?status=pending" className="rounded-full bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-800 hover:bg-amber-200">{t("{n} waiting for approval", { n: waiting ?? 0 })}</Link> : undefined} />
      <FilterBar path="/admin/perks" search={{ name: "q", value: q, placeholder: t("Search perk or merchant") }} fields={[
        { name: "status", label: t("Status"), type: "select", value: status, all: t("All statuses"), options: STATUSES.map((x) => ({ value: x, label: t(x) })) },
        { name: "merchant", label: t("Merchant"), type: "select", value: merchant, all: t("All merchants"), options: (merchants ?? []).map((m) => ({ value: m.id, label: m.name })) },
        { name: "tier", label: t("Tier"), type: "select", value: tier, all: t("All tiers"), options: [
          { value: "bronze", label: `${t("Bronze")} (<15%)` }, { value: "silver", label: `${t("Silver")} (15–24%)` },
          { value: "gold", label: `${t("Gold")} (25–30%)` }, { value: "hero", label: `${t("Hero")} (>30%)` }] },
        { name: "flash", label: t("Flash perks only"), type: "toggle", value: flash },
      ]} />
      <Table head={[t("Perk"), t("Merchant"), t("Discount"), t("Limits"), t("Ends"), t("Status"), ""]} empty={status === "pending" ? t("Nothing waiting for approval") : t("No perks match these filters.")}>
        {data.map((p) => {
          const tier = tierFor(p);
          return (
            <tr key={p.id}>
              <Td><Link href={`/admin/perks/${p.id}`} className="font-semibold hover:text-perk-purple">{p.is_flash && <Icon name="zap" size={14} className="me-1 inline-block align-[-2px]" />}{p.title}</Link></Td>
              <Td><Link href={`/admin/merchants/${p.merchant.id}`} className="hover:underline">{p.merchant.name}</Link></Td>
              <Td phone="sum">{discountLabel(p, t)} {tier && <span className={`ms-1 rounded-full px-2 py-0.5 text-xs font-bold ${tier.cls}`}>{t(tier.name)}</span>}</Td>
              <Td className="text-xs text-zinc-500">{p.max_uses_per_user ?? "∞"}/{t("student")} · {p.daily_cap ?? "∞"}/{t("day")}</Td>
              <Td>{date(p.end_at)}</Td>
              <Td phone="sum"><Badge tone={p.status}>{t(p.status)}</Badge></Td>
              <Td>
                {p.status === "pending" && (
                  <div className="flex gap-2">
                    <form action={reviewPerk}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="decision" value="approve" />
                      <button className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">{t("Approve")}</button></form>
                    <Link href={`/admin/perks/${p.id}#review`} className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-semibold">{t("Review")}</Link>
                  </div>
                )}
                {(p.status === "active" || p.status === "paused") && (
                  <form action={adminSetPerkStatus}>
                    <input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value={p.status === "active" ? "paused" : "active"} />
                    <button className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-semibold">{p.status === "active" ? t("Pause") : t("Activate")}</button>
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
