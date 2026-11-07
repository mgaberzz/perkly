import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { Badge, LinkButton, PageHeader } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { REQUEST_KIND_LABEL } from "@/lib/labels";
import type { AdminRequest } from "@/lib/types";
import { resolveRequest } from "../actions";

export const metadata = { title: "Notifications" };
const ICON: Record<string, string> = { qr_code: "🔳", perk: "🎁", cashback: "💸", payout: "🏦" };

export default async function NotificationsPage({ searchParams }: PageProps<"/admin/notifications">) {
  const { supabase, can } = await requireStaff("notifications");
  const t = await getT();
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "pending";
  const kind = typeof sp.kind === "string" ? sp.kind : "";
  let q = supabase.from("admin_requests").select("*, merchant:merchants(id, name, merchant_code)")
    .order("created_at", { ascending: false }).limit(200);
  if (status !== "all") q = q.eq("status", status);
  if (kind) q = q.eq("kind", kind);
  const { data } = await q.returns<(AdminRequest & { merchant: { id: string; name: string; merchant_code: string } | null })[]>();
  const href = (s: string, k: string) => `/admin/notifications?status=${s}${k ? `&kind=${k}` : ""}`;
  const decides = (k: string) => (k === "cashback" || k === "payout" ? can("finance") : can("merchants_edit"));

  return (
    <>
      <PageHeader title={t("Notification center")} subtitle={t("Every request that needs a decision from the Perkly team.")}
        actions={["pending", "approved", "rejected", "all"].map((s) => (
          <LinkButton key={s} href={href(s, kind)} variant={s === status ? "primary" : "secondary"}>{t(s[0].toUpperCase() + s.slice(1))}</LinkButton>
        ))} />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {["", "qr_code", "perk", "cashback", "payout"].map((k) => (
          <Link key={k} href={href(status, k)} className={`rounded-full px-3 py-1 font-semibold ${k === kind ? "bg-perk-ink text-white" : "bg-white ring-1 ring-zinc-200"}`}>
            {k ? `${ICON[k]} ${t(REQUEST_KIND_LABEL[k])}` : t("All types")}
          </Link>
        ))}
      </div>
      <ul className="space-y-3">
        {(data ?? []).map((r) => (
          <li key={r.id} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
            <div className="text-2xl">{ICON[r.kind]}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{r.title}</span>
                <Badge>{t(REQUEST_KIND_LABEL[r.kind])}</Badge>
                {r.status !== "pending" && <Badge>{t(r.status)}</Badge>}
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {r.merchant && <Link href={`/admin/merchants/${r.merchant.id}`} className="hover:underline">{r.merchant.name} · {r.merchant.merchant_code}</Link>}
                {" · "}{dateTime(r.created_at)}
                {r.note && <> · “{r.note}”</>}
              </div>
              {r.kind === "perk" && <Link href={`/admin/perks/${r.ref_id}`} className="text-xs font-semibold text-perk-purple hover:underline">{t("Open perk")}</Link>}
            </div>
            {r.status === "pending" && decides(r.kind) && (
              <div className="flex flex-wrap items-center gap-2">
                <form action={resolveRequest}>
                  <input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="approve" />
                  <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">✓ {t("Approve")}</button>
                </form>
                <form action={resolveRequest} className="flex gap-2">
                  <input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="reject" />
                  <input name="note" placeholder={t("Reason (optional)")} className="w-40 rounded-lg border border-zinc-300 px-2 py-1 text-xs" />
                  <button className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white">{t("Reject")}</button>
                </form>
              </div>
            )}
          </li>
        ))}
        {(data ?? []).length === 0 && <li className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">{t("All caught up 🎉")}</li>}
      </ul>
    </>
  );
}
