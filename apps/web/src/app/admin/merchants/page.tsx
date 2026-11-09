import { Icon } from "@/components/icons";
import Link from "next/link";
import { inScope, requireStaff } from "@/lib/auth";
import { Amount, Badge, PageHeader, Table, Td } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { FilterBar } from "@/components/filter-bar";
import { PageTabs } from "@/components/page-tabs";
import { Avatar, DetailRow, ExpandItem, ExpandList } from "@/components/expand-list";
import { short } from "@/lib/format";
import { BRAND_TYPE_LABEL, CHANNEL_LABEL } from "@/lib/labels";
import { BRAND_TYPES, CATEGORIES, type Balance, type Merchant } from "@/lib/types";

export const metadata = { title: "Merchants" };

const STATUSES = ["live", "pending", "paused", "churned"] as const;
const SORTS = { name: "Name (A–Z)", newest: "Newest first", active: "Most transactions (30 days)", gmv: "Highest GMV (30 days)", dues: "Highest dues" } as const;
const PAGE = 50;
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
  else if (partner) query = query.eq("partner_id", partner);
  const [{ data: list }, { data: bal }, { data: act }, { data: partners }] = await Promise.all([
    query.returns<Row[]>(),
    supabase.rpc("merchant_balances"),
    supabase.rpc("insights", { p_dimension: "merchant", p_days: 30 }),
    can("partners_view") ? supabase.from("partners").select("id, name").order("name") : Promise.resolve({ data: null }),
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
  const pill = (on: boolean) => `whitespace-nowrap rounded-full capitalize px-3.5 py-1.5 text-sm font-semibold transition ${on ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"}`;

  return (
    <>
      <PageHeader title={role === "account_manager" ? t("My merchants") : t("Merchants")} subtitle={t("{n} merchants", { n: base.length })} />
      {can("merchants_create") && <PageTabs tabs={[{ href: "/admin/merchants", label: t("All merchants") }, { href: "/admin/merchants/new", label: t("New merchant") }]} />}

      <FilterBar path="/admin/merchants" keep={Object.fromEntries(Object.entries({ status, sort: params.sort }).filter(([, v]) => v))}
        search={{ name: "q", value: q, placeholder: t("Search name or Merchant ID") }} fields={[
        { name: "category", label: t("Category"), type: "select", value: category, all: t("All categories"), options: CATEGORIES.map((c) => ({ value: c, label: t(c) })) },
        { name: "brand", label: t("Brand type"), type: "select", value: brand, all: t("All brand types"), options: BRAND_TYPES.map((b) => ({ value: b, label: t(BRAND_TYPE_LABEL[b]) })) },
        { name: "channel", label: t("Channel"), type: "select", value: channel, all: t("All channels"), options: Object.entries(CHANNEL_LABEL).map(([k, v]) => ({ value: k, label: t(v) })) },
        ...(partners ? [{ name: "partner", label: t("Partner"), type: "select" as const, value: partner, all: t("Any partner"),
          options: [{ value: "none", label: t("No partner (Perkly)") }, ...partners.map((p) => ({ value: p.id, label: p.name }))] }] : []),
        { name: "due", label: t("With amounts due"), type: "toggle", value: due },
      ]} />

      {/* Status tabs with counts + sort */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Link href={href({ status: "", page: "" })} className={pill(!status)}>{t("All")} <span className="opacity-60">{base.length}</span></Link>
          {STATUSES.map((st) => (
            <Link key={st} href={href({ status: st, page: "" })} className={pill(status === st)}>{t(st)} <span className="opacity-60">{counts[st]}</span></Link>
          ))}
        </div>
        <div className="-mx-1 flex w-full items-center gap-1 overflow-x-auto px-1 text-sm sm:w-auto">
          <span className="shrink-0 text-zinc-500">{t("Sort")}:</span>
          <div className="flex gap-1">
            {(Object.keys(SORTS) as (keyof typeof SORTS)[]).map((k) => (
              <Link key={k} href={href({ sort: k === "name" ? "" : k, page: "" })}
                className={`whitespace-nowrap rounded-lg px-2 py-1 text-xs font-semibold ${sort === k ? "bg-perk-purple/10 text-perk-purple" : "text-zinc-500 hover:bg-zinc-100"}`}>{t(SORTS[k])}</Link>
            ))}
          </div>
        </div>
      </div>
      {due && <p className="mb-4 text-sm text-zinc-600">{t("To be paid to these merchants")}: <Link href="/admin/explain?metric=to_be_paid" className="font-bold hover:underline"><Amount v={totalOwedTo} /></Link></p>}

      {/* Phone: tap-to-open cards */}
      <ExpandList empty={t("No merchants match these filters.")}>
        {shown.map((m) => {
          const to = owedTo(m.id), by = owedBy(m.id), paid = Number(balances.get(m.id)?.paid_out ?? 0);
          return (
            <ExpandItem key={m.id} accent={to > 0 ? "purple" : by > 0 ? "amber" : undefined} summary={
              <div className="flex items-center gap-3">
                <Avatar name={m.name} src={m.logo_url} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="truncate font-bold">{m.name}</span><Badge tone={m.status} className="shrink-0 !px-2 !text-[10px]">{t(m.status)}</Badge></div>
                  <div className="truncate text-xs text-zinc-500">{t(m.category)} · <span className="font-mono">{m.merchant_code}</span>{m.partner_id && partnerName.get(m.partner_id) ? <> · <Icon name="handshake" size={12} className="me-1 inline-block align-[-2px]" />{partnerName.get(m.partner_id)}</> : ""}</div>
                  <div className="mt-1 flex gap-3 text-xs">
                    <span className="text-zinc-600"><b>{short(tx(m.id))}</b> {t("tx")} · <b><Amount v={gmv(m.id)} /></b> <span className="text-zinc-400">{t("30d")}</span></span>
                    {to > 0 ? <span className="font-bold text-perk-purple">{t("Due")} <Amount v={to} /></span> : by > 0 ? <span className="font-bold text-amber-700">{t("Owes")} <Amount v={by} /></span> : null}
                  </div>
                </div>
              </div>}>
              <DetailRow label={t("Brand type")}>{t(BRAND_TYPE_LABEL[m.brand_type] ?? m.brand_type)}</DetailRow>
              <DetailRow label={t("Channel")}>{t(CHANNEL_LABEL[m.channel])}</DetailRow>
              <DetailRow label={t("Branches / perks")}>{m.branches[0]?.count ?? 0} / {m.perks[0]?.count ?? 0}</DetailRow>
              <DetailRow label={t("Commission")}>{m.commission_pct}%</DetailRow>
              <DetailRow label={t("To be paid to merchant")}>{to > 0 ? <Link href={`/admin/explain?metric=net_to_settle&merchant=${m.id}`} className="text-perk-purple underline"><Amount v={to} /></Link> : "—"}</DetailRow>
              <DetailRow label={t("Owed to Perkly")}>{by > 0 ? <Link href={`/admin/explain?metric=net_to_settle&merchant=${m.id}`} className="text-amber-700 underline"><Amount v={by} /></Link> : "—"}</DetailRow>
              <DetailRow label={t("Paid to merchant")}>{paid > 0 ? <Link href={`/admin/explain?metric=paid_to_merchants&merchant=${m.id}`} className="underline"><Amount v={paid} /></Link> : "—"}</DetailRow>
              <Link href={`/admin/merchants/${m.id}`} className="perk-gradient my-2 flex items-center justify-center rounded-xl py-2.5 text-sm font-semibold text-white">{t("Open merchant")} →</Link>
            </ExpandItem>
          );
        })}
      </ExpandList>

      {/* Desktop table */}
      <Table className="hidden sm:block" head={[t("Merchant"), t("Status"), t("Partner"), t("Last 30 days"), t("Commission"), t("Dues"), t("Branches / perks")]} empty={t("No merchants match these filters.")}>
        {shown.map((m) => {
          const to = owedTo(m.id), by = owedBy(m.id);
          return (
            <tr key={m.id} className="hover:bg-zinc-50">
              <Td>
                <Link href={`/admin/merchants/${m.id}`} className="group flex items-center gap-3">
                  <Avatar name={m.name} src={m.logo_url} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold group-hover:text-perk-purple">{m.name}</span>
                    <span className="block truncate text-xs text-zinc-500">{t(m.category)} · {t(BRAND_TYPE_LABEL[m.brand_type] ?? m.brand_type)} · <span className="font-mono">{m.merchant_code}</span></span>
                  </span>
                </Link>
              </Td>
              <Td><Badge tone={m.status}>{t(m.status)}</Badge></Td>
              <Td className="text-sm">{m.partner_id && partnerName.get(m.partner_id)
                ? <Link href={`/admin/partners/${m.partner_id}`} className="hover:text-perk-purple hover:underline">{partnerName.get(m.partner_id)}</Link>
                : <span className="text-zinc-400">—</span>}</Td>
              <Td>
                {tx(m.id) > 0 ? (
                  <Link href={`/admin/redemptions?merchant=${m.id}`} className="hover:underline">
                    <span className="font-semibold"><Amount v={gmv(m.id)} /></span>
                    <span className="block text-xs text-zinc-500">{t("{n} transactions", { n: short(tx(m.id)) })}</span>
                  </Link>
                ) : <span className="text-xs text-zinc-400">{t("No activity")}</span>}
              </Td>
              <Td>{m.commission_pct}%</Td>
              <Td>
                {to > 0 ? <Link href={`/admin/explain?metric=net_to_settle&merchant=${m.id}`} className="font-bold text-perk-purple hover:underline"><Amount v={to} /><span className="block text-xs font-normal text-zinc-500">{t("to be paid")}</span></Link>
                  : by > 0 ? <Link href={`/admin/explain?metric=net_to_settle&merchant=${m.id}`} className="font-semibold text-amber-700 hover:underline"><Amount v={by} /><span className="block text-xs font-normal text-zinc-500">{t("owed to Perkly")}</span></Link>
                  : <span className="text-zinc-400">—</span>}
              </Td>
              <Td className="text-sm text-zinc-600">{m.branches[0]?.count ?? 0} / {m.perks[0]?.count ?? 0}</Td>
            </tr>
          );
        })}
      </Table>

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
