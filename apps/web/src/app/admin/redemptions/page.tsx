import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Badge, LinkButton, PageHeader, Table, Td } from "@/components/ui";
import { dateTime, egp } from "@/lib/format";
import { setRedemptionStatus } from "../actions";

export const metadata = { title: "Redemptions" };

type Row = {
  id: string; created_at: string; verification_code: string; original_amount: number | null; discount_amount: number | null;
  status: string; flag_reason: string | null; distance_m: number | null; xp_awarded: number;
  merchant: { id: string; name: string }; perk: { title: string }; student: { full_name: string | null; email: string | null; phone: string | null } | null;
};

export default async function AdminRedemptionsPage({ searchParams }: PageProps<"/admin/redemptions">) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "all";
  const { supabase } = await requireAdmin();
  let query = supabase.from("redemptions")
    .select("id, created_at, verification_code, original_amount, discount_amount, status, flag_reason, distance_m, xp_awarded, merchant:merchants(id, name), perk:perks(title), student:profiles(full_name, email, phone)")
    .order("created_at", { ascending: false }).limit(200);
  if (status !== "all") query = query.eq("status", status);
  const { data } = await query.returns<Row[]>();
  return (
    <>
      <PageHeader title="Redemptions" subtitle="Flagged = no location shared or scanned 300m+ from the branch. Review and reverse fraud."
        actions={["all", "flagged", "success", "reversed"].map((s) => <LinkButton key={s} href={`/admin/redemptions?status=${s}`} variant={s === status ? "primary" : "secondary"} className="capitalize">{s}</LinkButton>)} />
      <Table head={["Time", "Student", "Merchant", "Perk", "Bill", "Discount", "XP", "Status", ""]}>
        {(data ?? []).map((r) => (
          <tr key={r.id}>
            <Td className="whitespace-nowrap">{dateTime(r.created_at)}<div className="font-mono text-xs text-zinc-500">{r.verification_code}</div></Td>
            <Td>{r.student?.full_name ?? "—"}<div className="text-xs text-zinc-500">{r.student?.phone ?? r.student?.email}</div></Td>
            <Td><Link href={`/admin/merchants/${r.merchant.id}`} className="hover:underline">{r.merchant.name}</Link></Td>
            <Td>{r.perk.title}</Td>
            <Td>{egp(r.original_amount)}</Td>
            <Td>{egp(r.discount_amount)}</Td>
            <Td>{r.xp_awarded}</Td>
            <Td><Badge>{r.status}</Badge>{r.flag_reason && <div className="mt-1 text-xs text-zinc-500">{r.flag_reason}</div>}</Td>
            <Td className="whitespace-nowrap text-right">
              {r.status !== "success" && (
                <form action={setRedemptionStatus} className="inline"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="success" />
                  <button className="mr-3 text-xs font-semibold text-emerald-700 hover:underline">Mark OK</button></form>
              )}
              {r.status !== "reversed" && (
                <form action={setRedemptionStatus} className="inline"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="reversed" /><input type="hidden" name="reason" value="reversed by admin" />
                  <button className="text-xs font-semibold text-red-600 hover:underline">Reverse</button></form>
              )}
            </Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
