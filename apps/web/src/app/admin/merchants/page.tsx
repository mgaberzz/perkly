import { Icon } from "@/components/icons";
import Link from "next/link";
import { inScope, requireStaff } from "@/lib/auth";
import { Amount, Badge, PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { FilterBar } from "@/components/filter-bar";
import { PageTabs } from "@/components/page-tabs";
import { merchantListTabs } from "@/lib/merchant-tabs";
import { Avatar } from "@/components/expand-list";
import { short } from "@/lib/format";
import { BRAND_TYPE_LABEL, CHANNEL_LABEL } from "@/lib/labels";
import { BRAND_TYPES, CATEGORIES, type Balance, type Merchant } from "@/lib/types";

export const metadata = { title: "Merchants" };

const STATUSES = ["live", "pending", "paused", "churned"] as const;
const SORTS = { name: "Name (A–Z)", newest: "Newest first", active: "Most transactions (30 days)", gmv: "Highest GMV (30 days)", dues: "Highest dues", rating: "Lowest rating" } as const;
const PAGE = 48;
type Row = Merchant & { partner_id?: string | null; created_at: string; branches: { count: number }[]; perks: { count: number }[] };
type Act = { key: string; transactions: number; gmv: number };

export default async function MerchantsPage({ searchParams }: PageProps<"/admin/merchants">) {
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const [q, status, category, brand, channel, due, partner] = ["q", "status", "category", "brand", "channel", "due", "partner"].map(s);
  const sort = (s("sort") in SORTS ? s("sort") : "name") as keyof typeof SORTS;
  const page = Math.max(1, Number(s("page")) || 1);
  const { supabase, can, merchantScope, role } = await requireStaff("merchants_view");
  const t = await getT();

  // Everything except the status filter is applied in the query, so the status tabs can show counts
  let query = inScope(supabase.from("merchants").select("*, branches:merchant_branches(count), perks(count)").order("name").limit(3000), merchantScope, "id");
  if (q) { const clean = q.replace(/[,()%]/g, ""); query = query.or(`name.ilike.%${clean}%,merchant_code.ilike.%${clean}%`); }
  if (category) query = query.eq("category", category);
  if (brand) query = query.eq("brand_type", brand);
  if (channel) query = query.eq("channel", channel);
  if (partner === "none") query = query.is("partner_id", null);
  else if (partner === "any") query = query.not("partner_id", "is", null);
  else if (partner) query = query.eq("partner_id", partner);
  const [{ data: list }, { data: bal }, { data: act }, { data: partners }, { count: applications }] = await Promise.all([
    query.returns<Row[]>(),
    supabase.rpc("merchant_balances"),
    supabase.rpc("insights", { p_dimension: "merchant", p_days: 30 }),
    can("partners_view") ? supabase.from("partners").select("id, name").order("name") : Promise.resolve({ data: null }),
    can("merchants_create") ? supabase.from("merchant_applications").select("*", { count: "exact", head: true }).eq("status", "pending") : Promise.resolve({ count: 0 }),
  ]);
  const balances = new Map(((bal ?? []) as Balance[]).map((b) => [b.merchant_id, b]));
  const activity = new Map(((act ?? []) as Act[]).map((a) => [a.key, a]));
  const partnerName = new Map((partners ?? []).map((p) => [p.id, p.name]));
  const owedTo = (id: string) => { const b = balances.get(id); return b ? Math.max(Number(b.net_to_settle), 0) + Math.max(Number(b.pending_settlements), 0) : 0; };
  const owedBy = (id: string) => { const b = balances.get(id); return b ? -Math.min(Number(b.net_to_settle), 0) - Math.min(Number(b.pending_settlements), 0) : 0; };
  const tx = (id: string) => Number(activity.get(id)?.transactions ?? 0);
  const gmv = (id: string) => Number(activity.get(id)?.gmv ?? 0);

  let base = list ?? [];
  if (due) base = base.filter((m) => owedTo(m.id) > 0 || owedBy(m.id) > 0);
  const counts = Object.fromEntries(STATUSES.map((st) => [st, base.filter((m) => m.status === st).length]));
  let rows = status ? base.filter((m) => m.status === status) : base;
  rows = [...rows].sort((a, b) =>
    sort === "newest" ? b.created_at.localeCompare(a.created_at)
      : sort === "active" ? tx(b.id) - tx(a.id) || a.name.localeCompare(b.name)
      : sort === "gmv" ? gmv(b.id) - gmv(a.id) || a.name.localeCompare(b.name)
      : sort === "rating" ? (a.rating_count ? Number(a.rating_avg) : 9) - (b.rating_count ? Number(b.rating_avg) : 9) || a.name.localeCompare(b.name)
      : sort === "dues" ? (owedTo(b.id) + owedBy(b.id)) - (owedTo(a.id) + owedBy(a.id)) || a.name.localeCompare(b.name)
      : a.name.localeCompare(b.name));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);
  const totalOwedTo = rows.reduce((a, m) => a + owedTo(m.id), 0);

  const params = { q, status, category, brand, channel, due, partner, sort: sort === "name" ? "" : sort };
  const href = (over: Record<string, string>) => {
    const u = new URLSearchParams(Object.entries({ ...params, ...over }).filter(([, v]) => v));
    return `/admin/merchants${u.toString() ? `?${u}` : ""}`;
  };
  return (
    <>
      <PageHeader title={role === "account_manager" ? t("My merchants") : t("Merchants")} subtitle={t("{n} merchants", { n: rows.length })} />
      {can("merchants_create") && <PageTabs tabs={merchantListTabs(t, applications ?? 0)} />}

      <FilterBar path="/admin/merchants" search={{ name: "q", value: q, placeholder: t("Search name or Merchant ID") }} fields={[
        { name: "status", label: t("Status"), type: "select", value: status, all: t("All statuses ({n})", { n: base.length }),
          options: STATUSES.map((st) => ({ value: st, label: `${t(st)} (${counts[st]})` })) },
        { name: "sort", label: t("Sort"), type: "select", value: params.sort, all: t(SORTS.name),
          options: (Object.keys(SORTS) as (keyof typeof SORTS)[]).filter((k) => k !== "name").map((k) => ({ value: k, label: t(SORTS[k]) })) },
        { name: "category", label: t("Category"), type: "select", value: category, all: t("All categories"), options: CATEGORIES.map((c) => ({ value: c, label: t(c) })) },
        { name: "brand", label: t("Brand type"), type: "select", value: brand, all: t("All brand types"), options: BRAND_TYPES.map((b) => ({ value: b, label: t(BRAND_TYPE_LABEL[b]) })) },
        { name: "channel", label: t("Channel"), type: "select", value: channel, all: t("All channels"), options: Object.entries(CHANNEL_LABEL).map(([k, v]) => ({ value: k, label: t(v) })) },
        ...(partners ? [{ name: "partner", label: t("Partner"), type: "select" as const, value: partner, all: t("All merchants"),
          options: [{ value: "any", label: t("Any partner") }, { value: "none", label: t("No partner (Perkly)") }, ...partners.map((p) => ({ value: p.id, label: p.name }))] }] : []),
        { name: "due", label: t("With amounts due"), type: "toggle", value: due },
      ]} />
      {due && <p className="mb-4 text-sm text-zinc-600">{t("To be paid to these merchants")}: <Link href="/admin/explain?metric=to_be_paid" className="font-bold hover:underline"><Amount v={totalOwedTo} /></Link></p>}

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">{t("No merchants match these filters.")}</div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((m) => {
            const to = owedTo(m.id), by = owedBy(m.id), pName = m.partner_id ? partnerName.get(m.partner_id) : null;
            return (
              <li key={m.id}>
                <Link href={`/admin/merchants/${m.id}`}
                  className={`flex h-full flex-col rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${to > 0 ? "border-perk-purple/40" : by > 0 ? "border-amber-300" : "border-zinc-200"}`}>
                  <div className="flex items-center gap-3">
                    <Avatar name={m.name} src={m.logo_url} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><span className="truncate font-bold">{m.name}</span><Badge tone={m.status} className="shrink-0 !px-2 !text-[10px]">{t(m.status)}</Badge></div>
                      <div className="truncate text-xs text-zinc-500">{t(m.category)} · <span className="font-mono">{m.merchant_code}</span>{!!m.rating_count && <span className={`ms-1 font-semibold ${Number(m.rating_avg) < 3.5 ? "text-red-600" : "text-amber-600"}`}> · ★ {Number(m.rating_avg).toFixed(1)} ({m.rating_count})</span>}</div>
                      {pName && <div className="truncate text-xs text-zinc-500"><Icon name="handshake" size={12} className="me-1 inline-block align-[-2px]" />{pName}</div>}
                    </div>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3 border-t border-zinc-100 pt-3 text-xs">
                    <div>
                      <div className="text-zinc-400">{t("Last 30 days")}</div>
                      {tx(m.id) > 0 ? <div className="text-zinc-700"><b><Amount v={gmv(m.id)} /></b> · {t("{n} transactions", { n: short(tx(m.id)) })}</div> : <div className="text-zinc-400">{t("No activity")}</div>}
                    </div>
                    {to > 0 ? <div className="text-end"><div className="text-zinc-400">{t("to be paid")}</div><b className="text-perk-purple"><Amount v={to} /></b></div>
                      : by > 0 ? <div className="text-end"><div className="text-zinc-400">{t("owed to Perkly")}</div><b className="text-amber-700"><Amount v={by} /></b></div> : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* Pages */}
      {rows.length > PAGE && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-zinc-500">{t("{a}–{b} of {n}", { a: (page - 1) * PAGE + 1, b: Math.min(page * PAGE, rows.length), n: rows.length })}</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={href({ page: String(page - 1) })} className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 font-semibold hover:bg-zinc-50">← {t("Previous")}</Link>}
            {page < pages && <Link href={href({ page: String(page + 1) })} className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 font-semibold hover:bg-zinc-50">{t("Next")} →</Link>}
          </div>
        </div>
      )}
    </>
  );
}
