import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { Amount, Badge, Card, Field, Input, PageHeader, Select, Stat, Table, Td } from "@/components/ui";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/action-form";
import { PartnerForm, dealLabel } from "@/components/partner-form";
import { getT } from "@/lib/i18n/server";
import { date, dateTime, short } from "@/lib/format";
import type { Partner, PartnerBalance } from "@/lib/types";
import { recordPartnerPayout, setMerchantPartner, updatePartner } from "../../actions";

export const metadata = { title: "Partner" };

type Earning = { redemption_id: string; merchant_id: string; cut_type: string; cut_value: number; commission: number; cut: number; created_at: string;
  redemption: { tx_code: string; original_amount: number | null; status: string } | null; merchant: { name: string } | null };

export default async function PartnerPage({ params }: PageProps<"/admin/partners/[id]">) {
  const { id } = await params;
  const { supabase, can } = await requireStaff("partners_view");
  const t = await getT();
  const [{ data: partner }, { data: bal }, { data: merchants }, { data: others }, { data: earnings }, { data: payouts }] = await Promise.all([
    supabase.from("partners").select("*").eq("id", id).maybeSingle<Partner>(),
    supabase.rpc("partner_balances", { p_partner_id: id }),
    supabase.from("merchants").select("id, name, merchant_code, commission_pct, status").eq("partner_id", id).order("name"),
    supabase.from("merchants").select("id, name, merchant_code, partner_id").or(`partner_id.is.null,partner_id.neq.${id}`).order("name").limit(1000),
    supabase.from("partner_earnings").select("redemption_id, merchant_id, cut_type, cut_value, commission, cut, created_at, redemption:redemptions(tx_code, original_amount, status), merchant:merchants(name)")
      .eq("partner_id", id).order("created_at", { ascending: false }).limit(1000).returns<Earning[]>(),
    supabase.from("partner_payouts").select("id, amount, reference, note, paid_at").eq("partner_id", id).order("paid_at", { ascending: false }),
  ]);
  if (!partner) notFound();
  const b = ((bal ?? []) as PartnerBalance[])[0];
  const manage = can("partners_manage");
  const live = (earnings ?? []).filter((e) => e.redemption?.status !== "reversed");
  const byMerchant = new Map<string, { cut: number; n: number }>();
  for (const e of live) { const x = byMerchant.get(e.merchant_id) ?? { cut: 0, n: 0 }; x.cut += Number(e.cut); x.n += 1; byMerchant.set(e.merchant_id, x); }

  return (
    <>
      <PageHeader title={partner.name} subtitle={<><span className="font-mono">{partner.partner_code}</span> · {dealLabel(partner, t)} · <Badge tone={partner.status}>{t(partner.status)}</Badge></>}
        actions={<Link href="/admin/partners" className="text-sm font-semibold text-zinc-500 hover:text-perk-purple">← {t("All partners")}</Link>} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat accent label={t("Due to partner")} value={<Amount v={b?.due ?? 0} />} hint={t("Earned minus paid")} />
        <Stat label={t("Earned")} value={<Amount v={b?.earned ?? 0} />} hint={t("{n} transactions", { n: short(b?.transactions ?? 0) })} />
        <Stat label={t("Paid")} value={<Amount v={b?.paid ?? 0} />} hint={b?.last_paid_at ? t("Last paid {date}", { date: date(b.last_paid_at) }) : t("Nothing paid yet")} />
        <Stat label={t("Commission from their merchants")} value={<Amount v={b?.commission ?? 0} />} hint={t("Total GMV {amount}", { amount: `${short(b?.gmv ?? 0)} EGP` })} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card title={t("Merchants")} className="lg:col-span-2">
          <Table head={[t("Merchant"), t("Commission"), t("Transactions"), t("Partner earned"), ""]} empty={t("No merchants linked yet.")}>
            {(merchants ?? []).map((m) => (
              <tr key={m.id}>
                <Td><Link href={`/admin/merchants/${m.id}`} className="font-semibold hover:text-perk-purple">{m.name}</Link><div className="font-mono text-xs font-normal text-zinc-500">{m.merchant_code}</div></Td>
                <Td>{m.commission_pct}%</Td>
                <Td>{byMerchant.get(m.id)?.n ?? 0}</Td>
                <Td phone="sum" className="font-semibold"><Amount v={byMerchant.get(m.id)?.cut ?? 0} /></Td>
                <Td className="text-end">{manage && (
                  <form action={setMerchantPartner}><input type="hidden" name="merchant_id" value={m.id} /><input type="hidden" name="partner_id" value="" />
                    <ConfirmButton message={t("Unlink this merchant? Their new transactions will no longer earn this partner a cut.")} className="text-xs font-semibold text-red-600 hover:underline">{t("Unlink")}</ConfirmButton></form>
                )}</Td>
              </tr>
            ))}
          </Table>
          {manage && (
            <form action={setMerchantPartner} className="mt-4 flex flex-wrap gap-2">
              <input type="hidden" name="partner_id" value={id} />
              <Select name="merchant_id" required className="min-w-0 flex-1" defaultValue="">
                <option value="" disabled>{t("Link a merchant…")}</option>
                {(others ?? []).map((m) => <option key={m.id} value={m.id}>{m.name} · {m.merchant_code}{m.partner_id ? ` (${t("moves from another partner")})` : ""}</option>)}
              </Select>
              <SubmitButton variant="secondary">{t("Link merchant")}</SubmitButton>
            </form>
          )}
          <p className="mt-2 text-xs text-zinc-500">{t("Only transactions made after a merchant is linked earn the partner a cut.")}</p>
        </Card>

        <div className="space-y-6">
          {can("partner_payouts") && (
            <Card title={t("Pay partner")}>
              <p className="mb-3 text-sm">{t("Owed now")}: <b><Amount v={b?.due ?? 0} /></b></p>
              <ActionForm action={recordPartnerPayout.bind(null, id)} className="space-y-3" resetOnSuccess>
                <Field label={t("Amount")} hint={t("Leave empty to pay everything owed")}><Input name="amount" type="number" step="0.01" min="0.01" /></Field>
                <Field label={t("Bank reference")}><Input name="reference" required /></Field>
                <Field label={t("Note")}><Input name="note" /></Field>
                <SubmitButton className="w-full">{t("Record payment")}</SubmitButton>
              </ActionForm>
            </Card>
          )}
          <Card title={manage ? t("Deal & contact") : t("Contact")}>
            {manage ? <PartnerForm action={updatePartner.bind(null, id)} partner={partner} t={t} submit={t("Save")} /> : (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-zinc-500">{t("Deal")}</dt><dd className="font-semibold">{dealLabel(partner, t)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-zinc-500">{t("Contact name")}</dt><dd>{partner.contact_name ?? "—"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-zinc-500">{t("Phone")}</dt><dd>{partner.contact_phone ?? "—"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-zinc-500">{t("Email")}</dt><dd>{partner.contact_email ?? "—"}</dd></div>
                {partner.notes && <p className="text-zinc-600">{partner.notes}</p>}
              </dl>
            )}
          </Card>
        </div>
      </div>

      <h2 className="mb-3 font-bold">{t("Payments to partner")}</h2>
      <div className="mb-6">
        <Table head={[t("Paid at"), t("Bank reference"), t("Note"), t("Amount")]} empty={t("No payments yet.")}>
          {(payouts ?? []).map((p) => (
            <tr key={p.id}><Td>{dateTime(p.paid_at)}</Td><Td className="font-mono">{p.reference}</Td><Td>{p.note ?? "—"}</Td><Td phone="sum" className="font-semibold"><Amount v={p.amount} /></Td></tr>
          ))}
        </Table>
      </div>

      <h2 className="mb-3 font-bold">{t("Earnings by transaction")}</h2>
      <Table head={[t("Time / ID"), t("Merchant"), t("Total GMV"), t("Perkly commission"), t("Deal"), t("Partner cut"), t("Status")]} empty={t("No transactions at this partner's merchants yet.")}>
        {(earnings ?? []).slice(0, 200).map((e) => (
          <tr key={e.redemption_id}>
            <Td className="whitespace-nowrap">{dateTime(e.created_at)}<div className="font-mono text-xs font-semibold text-perk-purple">{e.redemption?.tx_code}</div></Td>
            <Td phone="lead">{e.merchant?.name}</Td>
            <Td><Amount v={e.redemption?.original_amount} /></Td>
            <Td><Amount v={e.commission} /></Td>
            <Td>{dealLabel(e, t)}</Td>
            <Td phone="sum" className={e.redemption?.status === "reversed" ? "text-zinc-400 line-through" : "font-semibold text-perk-purple"}><Amount v={e.cut} /></Td>
            <Td phone="sum"><Badge tone={e.redemption?.status}>{t(e.redemption?.status ?? "")}</Badge></Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
