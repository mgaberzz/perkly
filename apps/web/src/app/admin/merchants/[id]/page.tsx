import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Amount, Badge, Button, Card, Field, Input, Notice, PageHeader, Select, Stat, Table, Td } from "@/components/ui";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/action-form";
import { MerchantAdminForm } from "@/components/merchant-admin-form";
import { QrImage } from "@/components/qr-image";
import { discountLabel } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { BRAND_TYPE_LABEL, CHANNEL_LABEL, MEMBER_ROLE_LABEL } from "@/lib/labels";
import type { Balance, Merchant, Perk, QrCode } from "@/lib/types";
import { adminAddMember, adminCreateBranch, adminCreateQr, adminRemoveMember, adminToggleQr, resolveRequest, updateMerchant } from "../../actions";

export const metadata = { title: "Merchant" };

type BranchRow = { id: string; name: string; address: string | null; is_active: boolean; lat: number | null; qr: QrCode[] };

export default async function AdminMerchantPage({ params, searchParams }: PageProps<"/admin/merchants/[id]">) {
  const { id } = await params;
  const { invite_error } = await searchParams;
  const { supabase, can, merchantScope } = await requireStaff("merchants_view");
  if (merchantScope && !merchantScope.includes(id)) notFound();
  const t = await getT();
  const { data: merchant } = await supabase.from("merchants").select("*").eq("id", id).maybeSingle<Merchant>();
  if (!merchant) notFound();
  const editable = can("merchants_edit");

  const [{ data: branches }, { data: perks }, { data: members }, { data: campuses }, { data: stats }, { data: balance }, { data: requests }] = await Promise.all([
    supabase.from("merchant_branches").select("id, name, address, is_active, lat, qr:branch_qr_codes(*)").eq("merchant_id", id).order("name").returns<BranchRow[]>(),
    supabase.from("perks").select("*").eq("merchant_id", id).order("created_at", { ascending: false }).returns<Perk[]>(),
    supabase.from("merchant_members").select("user_id, member_role, branch_id").eq("merchant_id", id),
    supabase.from("campuses").select("id, name").order("name"),
    supabase.rpc("merchant_stats", { p_merchant_id: id, p_days: 30 }),
    supabase.rpc("merchant_balances", { p_merchant_id: id }).maybeSingle<Balance>(),
    supabase.from("admin_requests").select("id, ref_id").eq("merchant_id", id).eq("kind", "qr_code").eq("status", "pending"),
  ]);
  const requestFor = new Map((requests ?? []).map((r) => [r.ref_id, r.id]));
  const ids = (members ?? []).map((m) => m.user_id);
  const { data: people } = ids.length && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? await createAdminClient().from("profiles").select("id, full_name, email, user_code").in("id", ids)
    : { data: [] as { id: string; full_name: string | null; email: string | null; user_code: string }[] };
  const byId = new Map((people ?? []).map((p) => [p.id, p]));
  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));
  const s = (stats ?? {}) as { redemptions?: number; unique_students?: number; new_customer_pct?: number; recurring_customer_pct?: number; revenue_after_discount?: number };

  return (
    <>
      <PageHeader title={merchant.name}
        subtitle={<span className="flex flex-wrap items-center gap-2"><span className="font-mono">{merchant.merchant_code}</span> · {t(merchant.category)} · {t(BRAND_TYPE_LABEL[merchant.brand_type])} · {t(CHANNEL_LABEL[merchant.channel])} <Badge tone={merchant.status}>{t(merchant.status)}</Badge></span>} />
      {typeof invite_error === "string" && <div className="mb-4"><Notice tone="error">{t("Merchant created, but the owner invite failed:")} {invite_error}</Notice></div>}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat accent label={t("Redemptions (30d)")} value={s.redemptions ?? 0} />
        <Stat label={t("Unique students")} value={s.unique_students ?? 0} />
        <Stat label={t("New vs recurring")} value={`${s.new_customer_pct ?? 0}% / ${s.recurring_customer_pct ?? 0}%`} />
        <Stat label={t("Revenue after discount")} value={<Amount v={s.revenue_after_discount} />} />
        <Stat label={t("Net to settle")} value={<Amount v={balance?.net_to_settle ?? 0} />} hint={Number(balance?.net_to_settle ?? 0) >= 0 ? t("Perkly pays merchant") : t("Merchant pays Perkly commission")} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={t("Details")} className="lg:col-span-2">
          <MerchantAdminForm action={updateMerchant.bind(null, id)} merchant={merchant} commercial={can("commercial_terms")} readOnly={!editable} />
        </Card>

        <Card title={t("Portal access")}>
          <ul className="mb-4 space-y-2">
            {(members ?? []).map((m) => {
              const p = byId.get(m.user_id);
              return (
                <li key={m.user_id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{p?.full_name ?? p?.email ?? t("Invited")}</div>
                    <div className="truncate text-xs text-zinc-500">{p?.email} {p?.user_code && `· ${p.user_code}`}</div>
                    {m.branch_id && <div className="text-xs text-zinc-500">📍 {branchName.get(m.branch_id)}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={m.member_role}>{t(MEMBER_ROLE_LABEL[m.member_role])}</Badge>
                    {editable && (
                      <form action={adminRemoveMember}>
                        <input type="hidden" name="merchant_id" value={id} /><input type="hidden" name="user_id" value={m.user_id} />
                        <ConfirmButton message={t("Remove portal access?")} className="text-xs text-red-600 hover:underline">✕</ConfirmButton>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
            {(members ?? []).length === 0 && <li className="text-sm text-zinc-500">{t("No one can log in for this merchant yet.")}</li>}
          </ul>
          {editable && (
            <ActionForm action={adminAddMember.bind(null, id)} className="space-y-3" resetOnSuccess>
              <Input name="email" type="email" placeholder="email@business.com" required />
              <Select name="member_role" defaultValue="owner">
                {Object.entries(MEMBER_ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
              </Select>
              <Select name="branch_id" defaultValue="">
                <option value="">{t("Branch (for branch managers)")}</option>
                {(branches ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
              <SubmitButton variant="secondary" className="w-full">{t("Invite / add")}</SubmitButton>
            </ActionForm>
          )}
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
                      {q.status === "approved" && q.is_active ? <QrImage value={q.code} size={56} /> : <div className="grid h-14 w-14 place-items-center rounded-lg bg-zinc-100 text-xl">🔳</div>}
                      <div className="min-w-0 flex-1 text-xs">
                        <div className="truncate font-semibold">{q.cashier_name ?? q.label}</div>
                        <div className="font-mono text-zinc-500">{q.code}</div>
                        <div className="mt-1 flex gap-1"><Badge tone={q.status}>{t(q.status)}</Badge>{!q.is_active && <Badge tone="paused">{t("disabled")}</Badge>}</div>
                      </div>
                      {editable && (
                        <div className="flex flex-col items-end gap-1 text-xs font-semibold">
                          {q.status === "pending" && requestFor.get(q.id) && (
                            <form action={resolveRequest}><input type="hidden" name="id" value={requestFor.get(q.id)} /><input type="hidden" name="decision" value="approve" />
                              <button className="text-emerald-700 hover:underline">✓ {t("Approve")}</button></form>
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

        <div className="lg:col-span-3">
          <h2 className="mb-3 font-bold">{t("Perks")}</h2>
          <Table head={[t("Perk"), t("Discount"), t("Status")]} empty={t("No perks.")}>
            {(perks ?? []).map((p) => (
              <tr key={p.id}>
                <Td>{can("perks") ? <Link href={`/admin/perks/${p.id}`} className="font-semibold hover:text-perk-purple">{p.is_flash && "⚡ "}{p.title}</Link> : p.title}</Td>
                <Td>{discountLabel(p, t)}</Td>
                <Td><Badge tone={p.status}>{t(p.status)}</Badge></Td>
              </tr>
            ))}
          </Table>
        </div>
      </div>
    </>
  );
}
