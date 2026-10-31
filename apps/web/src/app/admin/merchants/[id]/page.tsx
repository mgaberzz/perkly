import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge, Card, Field, Input, Notice, PageHeader, Select, Stat, Table, Td } from "@/components/ui";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/action-form";
import { MerchantAdminForm } from "@/components/merchant-admin-form";
import { QrImage } from "@/components/qr-image";
import { discountLabel, egp } from "@/lib/format";
import type { Merchant, Perk } from "@/lib/types";
import { adminAddMember, adminCreateBranch, adminRemoveMember, updateMerchant } from "../../actions";

export const metadata = { title: "Merchant" };

type BranchRow = { id: string; name: string; address: string | null; is_active: boolean; lat: number | null; qr: { id: string; code: string; label: string; is_active: boolean }[] };

export default async function AdminMerchantPage({ params, searchParams }: PageProps<"/admin/merchants/[id]">) {
  const { id } = await params;
  const { invite_error } = await searchParams;
  const { supabase } = await requireAdmin();
  const { data: merchant } = await supabase.from("merchants").select("*").eq("id", id).maybeSingle<Merchant>();
  if (!merchant) notFound();

  const [{ data: branches }, { data: perks }, { data: members }, { data: campuses }, { data: stats }] = await Promise.all([
    supabase.from("merchant_branches").select("id, name, address, is_active, lat, qr:branch_qr_codes(id, code, label, is_active)").eq("merchant_id", id).order("name").returns<BranchRow[]>(),
    supabase.from("perks").select("*").eq("merchant_id", id).order("created_at", { ascending: false }).returns<Perk[]>(),
    supabase.from("merchant_members").select("user_id, member_role").eq("merchant_id", id),
    supabase.from("campuses").select("id, name").order("name"),
    supabase.rpc("merchant_stats", { p_merchant_id: id, p_days: 30 }),
  ]);
  const ids = (members ?? []).map((m) => m.user_id);
  const { data: people } = ids.length ? await createAdminClient().from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
  const byId = new Map((people ?? []).map((p) => [p.id, p]));
  const s = (stats ?? {}) as { redemptions?: number; unique_students?: number; discount_given?: number; revenue_after_discount?: number };

  return (
    <>
      <PageHeader title={merchant.name} subtitle={<span className="flex items-center gap-2">{merchant.category} · {merchant.subcategory} <Badge>{merchant.status}</Badge></span>} />
      {typeof invite_error === "string" && <div className="mb-4"><Notice tone="error">Merchant created, but the owner invite failed: {invite_error}</Notice></div>}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat accent label="Redemptions (30d)" value={s.redemptions ?? 0} />
        <Stat label="Unique students" value={s.unique_students ?? 0} />
        <Stat label="Discount given" value={egp(s.discount_given)} />
        <Stat label="Revenue after discount" value={egp(s.revenue_after_discount)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Details" className="lg:col-span-2"><MerchantAdminForm action={updateMerchant.bind(null, id)} merchant={merchant} /></Card>

        <Card title="Portal access">
          <ul className="mb-4 space-y-2">
            {(members ?? []).map((m) => {
              const p = byId.get(m.user_id);
              return (
                <li key={m.user_id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0"><div className="truncate font-semibold">{p?.full_name ?? p?.email}</div><div className="truncate text-xs text-zinc-500">{p?.email}</div></div>
                  <div className="flex items-center gap-2">
                    <Badge>{m.member_role}</Badge>
                    <form action={adminRemoveMember}>
                      <input type="hidden" name="merchant_id" value={id} /><input type="hidden" name="user_id" value={m.user_id} />
                      <ConfirmButton message="Remove portal access?" className="text-xs text-red-600 hover:underline">✕</ConfirmButton>
                    </form>
                  </div>
                </li>
              );
            })}
            {(members ?? []).length === 0 && <li className="text-sm text-zinc-500">No one can log in for this merchant yet.</li>}
          </ul>
          <ActionForm action={adminAddMember.bind(null, id)} className="space-y-3" resetOnSuccess>
            <Input name="email" type="email" placeholder="email@business.com" required />
            <Select name="member_role" defaultValue="owner"><option value="owner">Owner</option><option value="manager">Manager</option><option value="cashier">Cashier</option></Select>
            <SubmitButton variant="secondary" className="w-full">Invite / add</SubmitButton>
          </ActionForm>
        </Card>

        <Card title="Branches & cashier QR codes" className="lg:col-span-3">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(branches ?? []).map((b) => (
              <div key={b.id} className="rounded-2xl border border-zinc-200 p-4">
                <div className="flex items-center justify-between"><span className="font-semibold">{b.name}</span><Badge tone={b.is_active ? "active" : "paused"}>{b.is_active ? "open" : "closed"}</Badge></div>
                <div className="text-xs text-zinc-500">{b.address} {b.lat == null && <span className="text-amber-600">· no location</span>}</div>
                <div className="mt-3 flex flex-wrap gap-3">
                  {b.qr.filter((q) => q.is_active).map((q) => (
                    <div key={q.id} className="text-center"><QrImage value={q.code} size={96} /><div className="mt-1 font-mono text-[10px] text-zinc-500">{q.label}</div></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold text-perk-purple">+ Add branch</summary>
            <ActionForm action={adminCreateBranch.bind(null, id)} className="mt-3 grid gap-3 md:grid-cols-3" resetOnSuccess>
              <Field label="Name"><Input name="name" required /></Field>
              <Field label="Address"><Input name="address" /></Field>
              <Field label="City"><Input name="city" /></Field>
              <Field label="Campus"><Select name="campus_id"><option value="">—</option>{(campuses ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
              <Field label="Latitude"><Input name="lat" type="number" step="any" /></Field>
              <Field label="Longitude"><Input name="lng" type="number" step="any" /></Field>
              <div><SubmitButton>Add branch</SubmitButton></div>
            </ActionForm>
          </details>
        </Card>

        <div className="lg:col-span-3">
          <h2 className="mb-3 font-bold">Perks</h2>
          <Table head={["Perk", "Discount", "Status"]}>
            {(perks ?? []).map((p) => (
              <tr key={p.id}>
                <Td><Link href={`/admin/perks/${p.id}`} className="font-semibold hover:text-perk-purple">{p.is_flash && "⚡ "}{p.title}</Link></Td>
                <Td>{discountLabel(p)}</Td>
                <Td><Badge>{p.status}</Badge></Td>
              </tr>
            ))}
          </Table>
        </div>
      </div>
    </>
  );
}
