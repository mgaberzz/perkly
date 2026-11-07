import Link from "next/link";
import { inScope, requireStaff } from "@/lib/auth";
import { Badge, Button, Input, PageHeader, Select, Table, Td } from "@/components/ui";
import { ExportButtons } from "@/components/export-buttons";
import { dateTime, egp } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { setRedemptionStatus } from "../actions";
import { settlementLabel } from "@/lib/types";

export const metadata = { title: "Transactions" };

type Row = {
  id: string; created_at: string; verification_code: string; original_amount: number | null; discount_amount: number | null; final_amount: number | null;
  status: string; flag_reason: string | null; xp_awarded: number; channel: string; payment_method: string; first_time_at_merchant: boolean;
  merchant: { id: string; name: string; merchant_code: string }; perk: { title: string }; branch: { name: string } | null;
  qr: { label: string; cashier_name: string | null } | null;
  student: { full_name: string | null; student_code: string | null; user_code: string } | null;
  settle_amount: number | null; settlement: { status: string } | null;
};

export default async function AdminRedemptionsPage({ searchParams }: PageProps<"/admin/redemptions">) {
  const sp = await searchParams;
  const g = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const f = { status: g("status"), channel: g("channel"), payment: g("payment"), from: g("from"), to: g("to"), merchant: g("merchant") };
  const { supabase, can, merchantScope } = await requireStaff("redemptions_view");
  const t = await getT();
  let query = inScope(supabase.from("redemptions")
    .select("id, created_at, verification_code, original_amount, discount_amount, final_amount, status, flag_reason, xp_awarded, channel, payment_method, first_time_at_merchant, merchant:merchants(id, name, merchant_code), perk:perks(title), branch:merchant_branches(name), qr:branch_qr_codes(label, cashier_name), student:profiles(full_name, student_code, user_code), settle_amount, settlement:settlements(status)")
    .order("created_at", { ascending: false }).limit(200), merchantScope);
  if (f.status) query = query.eq("status", f.status);
  if (f.channel) query = query.eq("channel", f.channel);
  if (f.payment) query = query.eq("payment_method", f.payment);
  if (f.merchant) query = query.eq("merchant_id", f.merchant);
  if (f.from) query = query.gte("created_at", `${f.from}T00:00:00+02:00`);
  if (f.to) query = query.lte("created_at", `${f.to}T23:59:59+02:00`);
  const [{ data }, { data: merchants }] = await Promise.all([
    query.returns<Row[]>(),
    inScope(supabase.from("merchants").select("id, name").order("name").limit(1000), merchantScope, "id"),
  ]);
  const review = can("redemptions_review");
  return (
    <>
      <PageHeader title={t("Transactions")} subtitle={t("Flagged = no location shared or scanned 300m+ from the branch. Review and reverse fraud.")}
        actions={<ExportButtons kind="transactions" params={f} />} />
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <Select name="merchant" defaultValue={f.merchant} className="w-48"><option value="">{t("All merchants")}</option>{(merchants ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>
        <Select name="status" defaultValue={f.status} className="w-36"><option value="">{t("All statuses")}</option>{["success", "flagged", "reversed"].map((s) => <option key={s} value={s}>{t(s)}</option>)}</Select>
        <Select name="channel" defaultValue={f.channel} className="w-36"><option value="">{t("All channels")}</option><option value="in_store">{t("In-store")}</option><option value="online">{t("Online")}</option></Select>
        <Select name="payment" defaultValue={f.payment} className="w-40"><option value="">{t("All payments")}</option><option value="merchant">{t("Paid at cashier")}</option><option value="in_app">{t("Paid in app")}</option></Select>
        <label className="text-xs text-zinc-500">{t("From")}<Input type="date" name="from" defaultValue={f.from} className="w-40" /></label>
        <label className="text-xs text-zinc-500">{t("To")}<Input type="date" name="to" defaultValue={f.to} className="w-40" /></label>
        <Button variant="secondary">{t("Filter")}</Button>
      </form>
      <Table head={[t("Time"), t("Student"), t("Merchant"), t("Branch / cashier"), t("Perk"), t("Bill"), t("Discount"), t("Payment"), t("To settle"), t("Status"), ""]} empty={t("No transactions.")}>
        {(data ?? []).map((r) => (
          <tr key={r.id}>
            <Td className="whitespace-nowrap">{dateTime(r.created_at)}<div className="font-mono text-xs text-zinc-500">{r.verification_code}</div></Td>
            <Td>{r.student?.full_name ?? "—"}<div className="font-mono text-xs text-zinc-500">{r.student?.student_code ?? r.student?.user_code}</div></Td>
            <Td><Link href={`/admin/merchants/${r.merchant.id}`} className="hover:underline">{r.merchant.name}</Link><div className="font-mono text-xs text-zinc-500">{r.merchant.merchant_code}</div></Td>
            <Td>{r.branch?.name ?? `🌐 ${t("Online")}`}<div className="text-xs text-zinc-500">{r.qr?.cashier_name ?? r.qr?.label}</div></Td>
            <Td>{r.perk.title}</Td>
            <Td>{egp(r.original_amount)}</Td>
            <Td>{egp(r.discount_amount)}</Td>
            <Td><Badge tone={r.payment_method === "in_app" ? "active" : "paused"}>{r.payment_method === "in_app" ? t("In app") : t("Cashier")}</Badge></Td>
            <Td className="whitespace-nowrap">{r.status === "reversed" ? "—" : <>{egp(r.settle_amount)}<div className="mt-1"><Badge tone={r.settlement?.status === "paid" ? "paid" : r.settlement?.status === "partially_paid" ? "pending" : "paused"}>{t(settlementLabel(r.settlement?.status))}</Badge></div></>}</Td>
            <Td><Badge tone={r.status}>{t(r.status)}</Badge>{r.flag_reason && <div className="mt-1 text-xs text-zinc-500">{r.flag_reason}</div>}</Td>
            <Td className="whitespace-nowrap text-end">
              {review && r.status !== "success" && (
                <form action={setRedemptionStatus} className="inline"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="success" />
                  <button className="me-3 text-xs font-semibold text-emerald-700 hover:underline">{t("Mark OK")}</button></form>
              )}
              {review && r.status !== "reversed" && (
                <form action={setRedemptionStatus} className="inline"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="reversed" /><input type="hidden" name="reason" value="reversed by Perkly" />
                  <button className="text-xs font-semibold text-red-600 hover:underline">{t("Reverse")}</button></form>
              )}
            </Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
