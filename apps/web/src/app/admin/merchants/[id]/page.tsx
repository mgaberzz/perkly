import { CardGrid } from "@/components/card-grid";
import { Icon } from "@/components/icons";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { Amount, Badge, Button, Card, Field, Input, Notice, PageHeader, Select, Stat, Table, Td } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PageTabs } from "@/components/page-tabs";
import { merchantTabs } from "@/lib/merchant-tabs";
import { resolvePeriod } from "@/lib/periods";
import { QrImage } from "@/components/qr-image";
import { discountLabel } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { dealLabel } from "@/components/partner-form";
import { BRAND_TYPE_LABEL, CHANNEL_LABEL } from "@/lib/labels";
import type { Balance, Merchant, Perk, QrCode } from "@/lib/types";
import { BANKS } from "@/lib/banks";
import { adminCreateBranch, adminCreateQr, adminRejectBank, adminRenameQr, adminSaveBank, adminSetPerkStatus, adminToggleQr, adminUpdateBranch, resolveRequest } from "../../actions";

export const metadata = { title: "Merchant" };

type BranchRow = { id: string; name: string; address: string | null; city: string | null; campus_id: string | null; is_active: boolean; lat: number | null; lng: number | null; qr: QrCode[] };
type Bank = { bank_name: string | null; account_name: string | null; iban: string | null; payout_schedule: string; status: string; review_note: string | null };

export default async function AdminMerchantPage({ params, searchParams }: PageProps<"/admin/merchants/[id]">) {
  const { id } = await params;
  const { invite_error } = await searchParams;
  const { supabase, can, merchantScope, role } = await requireStaff("merchants_view");
  if (merchantScope && !merchantScope.includes(id)) notFound();
  const t = await getT();
  const { data: merchant } = await supabase.from("merchants").select("*").eq("id", id).maybeSingle<Merchant>();
  if (!merchant) notFound();
  const editable = can("merchants_edit");
  const partnerId = (merchant as Merchant & { partner_id?: string | null }).partner_id ?? null;
  const { data: partnerList } = can("partners_view")
    ? await supabase.from("partners").select("id, name, partner_code, cut_type, cut_value, status").order("name")
    : { data: null };
  const partner = (partnerList ?? []).find((p) => p.id === partnerId);

  const bankEditor = role === "admin" || role === "operations";
  const { data: bank } = bankEditor || role === "finance"
    ? await supabase.from("merchant_bank_accounts").select("bank_name, account_name, iban, payout_schedule, status, review_note").eq("merchant_id", id).maybeSingle<Bank>()
    : { data: null };
  const [{ data: branches }, { data: perks }, { data: campuses }, { data: stats }, { data: balance }, { data: requests }] = await Promise.all([
    supabase.from("merchant_branches").select("id, name, address, city, campus_id, is_active, lat, lng, qr:branch_qr_codes(*)").eq("merchant_id", id).order("name").returns<BranchRow[]>(),
    supabase.from("perks").select("*").eq("merchant_id", id).order("created_at", { ascending: false }).returns<Perk[]>(),
    supabase.from("campuses").select("id, name").order("name"),
    supabase.rpc("merchant_stats", { p_merchant_id: id, p_days: 30 }),
    supabase.rpc("merchant_balances", { p_merchant_id: id }).maybeSingle<Balance>(),
    supabase.from("admin_requests").select("id, ref_id").eq("merchant_id", id).eq("kind", "qr_code").eq("status", "pending"),
  ]);
  const requestFor = new Map((requests ?? []).map((r) => [r.ref_id, r.id]));
  const from30 = resolvePeriod("30d").from;
  const s = (stats ?? {}) as { redemptions?: number; unique_students?: number; new_customer_pct?: number; recurring_customer_pct?: number; revenue_after_discount?: number };

  return (
    <>
      <PageHeader title={merchant.name}
        subtitle={<span className="flex flex-wrap items-center gap-2"><span className="font-mono">{merchant.merchant_code}</span> · {t(merchant.category)} · {t(BRAND_TYPE_LABEL[merchant.brand_type])} · {t(CHANNEL_LABEL[merchant.channel])} <Badge tone={merchant.status}>{t(merchant.status)}</Badge></span>} />
      <PageTabs tabs={merchantTabs(id, editable, t)} />
      {typeof invite_error === "string" && <div className="mb-4"><Notice tone="error">{t("Merchant created, but the owner invite failed:")} {invite_error}</Notice></div>}

      {partnerList && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
          <span className="font-semibold"><Icon name="handshake" size={14} className="me-1 inline-block align-[-2px]" />{t("Partner")}:</span>
          {partner
            ? <Link href={`/admin/partners/${partner.id}`} className="font-semibold text-perk-purple hover:underline">{partner.name} <span className="font-mono text-xs text-zinc-500">{partner.partner_code}</span></Link>
            : <span className="text-zinc-500">{t("None (onboarded by Perkly)")}</span>}
          {partner && <Badge tone="active">{dealLabel(partner, t)}</Badge>}
        </div>
      )}

      <CardGrid className="grid grid-cols-2 gap-4 lg:grid-cols-5" items={[
        { key: "r", title: t("Last 30 days"), tx: { merchant: id, from: from30 }, card: <Stat accent label={t("Redemptions (30d)")} value={s.redemptions ?? 0} /> },
        { key: "s", title: t("Last 30 days"), tx: { merchant: id, from: from30 }, card: <Stat label={t("Unique students")} value={s.unique_students ?? 0} /> },
        { key: "n", title: t("New customers"), tx: { merchant: id, from: from30, customer: "new" }, card: <Stat label={t("New vs recurring")} value={`${s.new_customer_pct ?? 0}% / ${s.recurring_customer_pct ?? 0}%`} hint={t("Opens new customers")} /> },
        { key: "v", title: t("Last 30 days"), tx: { merchant: id, from: from30 }, card: <Stat label={t("Revenue after discount")} value={<Amount v={s.revenue_after_discount} />} /> },
        { key: "u", title: t("Not yet in a settlement"), tx: { merchant: id, unsettled: "1" }, card: <Stat label={t("Net to settle")} value={<Amount v={balance?.net_to_settle ?? 0} />} hint={Number(balance?.net_to_settle ?? 0) >= 0 ? t("Perkly pays merchant") : t("Merchant pays Perkly commission")} /> },
      ]} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={t("Details")} className="lg:col-span-3"
          actions={editable && <Link href={`/admin/merchants/${id}/edit`} className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm font-semibold hover:bg-zinc-50">{t("Edit")}</Link>}>
          <dl className="grid gap-x-8 text-sm sm:grid-cols-2">
            {([
              [t("Category"), `${t(merchant.category)}${merchant.subcategory ? ` · ${merchant.subcategory}` : ""}`],
              [t("Brand type"), t(BRAND_TYPE_LABEL[merchant.brand_type] ?? merchant.brand_type)],
              [t("Channel"), t(CHANNEL_LABEL[merchant.channel])],
              [t("Plan"), merchant.plan === "pro" ? "Pro" : t("Free")],
              [t("Commission"), `${merchant.commission_pct}%`],
              [t("VAT on commission"), merchant.vat_enabled ? t("Yes") : t("Exempt")],
              [t("Contact name"), merchant.contact_name],
              [t("Contact phone"), merchant.contact_phone],
              [t("Contact email"), merchant.contact_email],
              [t("Website"), merchant.website_url],
            ] as [string, string | null][]).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-zinc-100 py-2.5">
                <dt className="shrink-0 text-zinc-500">{k}</dt>
                <dd className="min-w-0 truncate text-end font-medium">{v || <span className="text-zinc-400">—</span>}</dd>
              </div>
            ))}
          </dl>
          {merchant.description && <p className="mt-4 whitespace-pre-line text-sm text-zinc-600">{merchant.description}</p>}
        </Card>

        <Card title={t("Branches & cashier QR codes")} className="lg:col-span-3">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(branches ?? []).map((b) => (
              <div key={b.id} className="rounded-2xl border border-zinc-200 p-4">
                <div className="flex items-center justify-between"><span className="font-semibold">{b.name}</span><Badge tone={b.is_active ? "active" : "paused"}>{b.is_active ? t("open") : t("closed")}</Badge></div>
                <div className="text-xs text-zinc-500">{b.address} {b.lat == null && <span className="text-amber-600">· {t("no location")}</span>}</div>
                <ul className="mt-3 space-y-2">
                  {b.qr.map((q) => (
                    <li key={q.id} className={`flex items-center gap-3 rounded-xl border p-2 ${q.is_active ? "border-zinc-200" : "border-dashed border-zinc-300 opacity-60"}`}>
                      {q.status === "approved" && q.is_active ? <QrImage value={q.code} size={56} /> : <div className="grid h-14 w-14 place-items-center rounded-lg bg-zinc-100 text-zinc-400"><Icon name="qr" size={24} /></div>}
                      <div className="min-w-0 flex-1 text-xs">
                        <div className="truncate font-semibold">{q.cashier_name ?? q.label}</div>
                        <div className="font-mono text-zinc-500">{q.code}</div>
                        <div className="mt-1 flex gap-1"><Badge tone={q.status}>{t(q.status)}</Badge>{!q.is_active && <Badge tone="paused">{t("disabled")}</Badge>}</div>
                        {editable && (
                          <details className="mt-1">
                            <summary className="cursor-pointer font-semibold text-perk-purple">{t("Edit cashier name")}</summary>
                            <form action={adminRenameQr} className="mt-1 flex gap-1">
                              <input type="hidden" name="id" value={q.id} /><input type="hidden" name="merchant_id" value={id} />
                              <input name="cashier_name" defaultValue={q.cashier_name ?? q.label} aria-label={t("Cashier name")} className="w-full min-w-0 rounded border border-zinc-300 px-1 py-0.5" />
                              <button className="font-semibold text-perk-purple hover:underline">{t("Save")}</button>
                            </form>
                          </details>
                        )}
                      </div>
                      {editable && (
                        <div className="flex flex-col items-end gap-1 text-xs font-semibold">
                          {q.status === "pending" && requestFor.get(q.id) && (
                            <form action={resolveRequest}><input type="hidden" name="id" value={requestFor.get(q.id)} /><input type="hidden" name="decision" value="approve" />
                              <button className="text-emerald-700 hover:underline"><Icon name="check" size={14} className="me-1 inline-block align-[-2px]" />{t("Approve")}</button></form>
                          )}
                          <form action={adminToggleQr}>
                            <input type="hidden" name="id" value={q.id} /><input type="hidden" name="merchant_id" value={id} /><input type="hidden" name="active" value={String(!q.is_active)} />
                            <button className="text-zinc-500 hover:underline">{q.is_active ? t("Disable") : t("Enable")}</button>
                          </form>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                {editable && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-perk-purple">{t("Edit branch details")}</summary>
                    <ActionForm action={adminUpdateBranch.bind(null, id, b.id)} className="mt-2 grid gap-2">
                      <Field label={t("Name")}><Input name="name" defaultValue={b.name} required /></Field>
                      <Field label={t("Address")}><Input name="address" defaultValue={b.address ?? ""} /></Field>
                      <Field label={t("City")}><Input name="city" defaultValue={b.city ?? ""} /></Field>
                      <Field label={t("Campus")}><Select name="campus_id" defaultValue={b.campus_id ?? ""}><option value="">—</option>{(campuses ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label={t("Latitude")}><Input name="lat" type="number" step="any" defaultValue={b.lat ?? ""} /></Field>
                        <Field label={t("Longitude")}><Input name="lng" type="number" step="any" defaultValue={b.lng ?? ""} /></Field>
                      </div>
                      <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" name="is_active" defaultChecked={b.is_active} className="h-4 w-4 accent-perk-purple" /> {t("Branch is open on Perkly")}</label>
                      <SubmitButton variant="secondary">{t("Save branch")}</SubmitButton>
                    </ActionForm>
                  </details>
                )}
                {editable && (
                  <form action={adminCreateQr} className="mt-3 flex gap-2">
                    <input type="hidden" name="branch_id" value={b.id} /><input type="hidden" name="merchant_id" value={id} />
                    <Input name="cashier_name" placeholder={t("Cashier name")} className="text-xs" />
                    <Button variant="secondary" className="shrink-0 text-xs">+ QR</Button>
                  </form>
                )}
              </div>
            ))}
          </div>
          {editable && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold text-perk-purple">+ {t("Add branch")}</summary>
              <ActionForm action={adminCreateBranch.bind(null, id)} className="mt-3 grid gap-3 md:grid-cols-3" resetOnSuccess>
                <Field label={t("Name")}><Input name="name" required /></Field>
                <Field label={t("Address")}><Input name="address" /></Field>
                <Field label={t("City")}><Input name="city" /></Field>
                <Field label={t("Campus")}><Select name="campus_id"><option value="">—</option>{(campuses ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
                <Field label={t("Latitude")}><Input name="lat" type="number" step="any" /></Field>
                <Field label={t("Longitude")}><Input name="lng" type="number" step="any" /></Field>
                <Field label={t("First cashier name")}><Input name="cashier_name" /></Field>
                <div className="flex items-end"><SubmitButton>{t("Add branch")}</SubmitButton></div>
              </ActionForm>
            </details>
          )}
        </Card>

        {(bankEditor || role === "finance") && (
          <Card title={t("Bank account & payout cycle")} className="lg:col-span-3">
            <div id="bank" className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              {bank ? <Badge tone={bank.status === "approved" ? "active" : bank.status}>{t(bank.status === "pending" ? "Pending approval" : bank.status === "approved" ? "Approved" : "Rejected")}</Badge> : <span className="text-zinc-500">{t("The merchant hasn't added bank details yet.")}</span>}
              {bank?.status === "rejected" && bank.review_note && <span className="text-xs text-red-600">{bank.review_note}</span>}
            </div>
            {bankEditor ? (
              <>
                <ActionForm action={adminSaveBank.bind(null, id)} className="grid gap-3 md:grid-cols-4">
                  <Field label={t("Bank")}>
                    <Select name="bank_name" defaultValue={bank?.bank_name ?? ""} required>
                      <option value="" disabled>{t("Choose your bank")}</option>
                      {bank?.bank_name && !BANKS.includes(bank.bank_name) && <option value={bank.bank_name} disabled>{bank.bank_name}</option>}
                      {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                    </Select>
                  </Field>
                  <Field label={t("Account holder")}><Input name="account_name" defaultValue={bank?.account_name ?? ""} required /></Field>
                  <Field label="IBAN"><Input name="iban" defaultValue={bank?.iban ?? ""} dir="ltr" required /></Field>
                  <Field label={t("Payout cycle")}>
                    <Select name="payout_schedule" defaultValue={bank?.payout_schedule ?? "weekly"}>{["weekly", "biweekly", "monthly"].map((c) => <option key={c} value={c}>{t(c)}</option>)}</Select>
                  </Field>
                  <div className="flex flex-wrap gap-2 md:col-span-4">
                    {bank?.status !== "approved" && <button name="decision" value="approve" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">{t("Save & approve")}</button>}
                    <SubmitButton variant="secondary">{t("Save")}</SubmitButton>
                  </div>
                </ActionForm>
                {bank?.status === "pending" && (
                  <ActionForm action={adminRejectBank.bind(null, id)} className="mt-3 flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-3">
                    <Field label={t("Send back to the merchant")}><Input name="note" placeholder={t("What should they correct?")} required className="w-72" /></Field>
                    <SubmitButton variant="danger">{t("Reject")}</SubmitButton>
                  </ActionForm>
                )}
              </>
            ) : bank && (
              <p className="text-sm">{bank.bank_name} · {bank.account_name} · <span className="font-mono" dir="ltr">{bank.iban}</span> · {t(bank.payout_schedule)}</p>
            )}
          </Card>
        )}

        <div className="lg:col-span-3">
          <h2 className="mb-3 font-bold">{t("Perks")}</h2>
          <Table head={[t("Perk"), t("Discount"), t("Status"), ""]} empty={t("No perks.")}>
            {(perks ?? []).map((p) => (
              <tr key={p.id}>
                <Td>{can("perks") ? <Link href={`/admin/perks/${p.id}`} className="font-semibold hover:text-perk-purple">{p.is_flash && <Icon name="zap" size={14} className="me-1 inline-block align-[-2px]" />}{p.title}</Link> : p.title}</Td>
                <Td phone="sum">{discountLabel(p, t)}</Td>
                <Td phone="sum"><Badge tone={p.status}>{t(p.status)}</Badge></Td>
                <Td className="text-end">
                  {can("perks") && (p.status === "active" || p.status === "paused") && (
                    <form action={adminSetPerkStatus}>
                      <input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value={p.status === "active" ? "paused" : "active"} />
                      <button className="text-sm font-semibold text-perk-purple hover:underline">{p.status === "active" ? t("Pause") : t("Activate")}</button>
                    </form>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        </div>
      </div>
    </>
  );
}
