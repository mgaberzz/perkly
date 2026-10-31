import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMerchant } from "@/lib/auth";
import { Badge, Button, Card, Input, PageHeader } from "@/components/ui";
import { BranchForm } from "@/components/branch-form";
import { QrImage } from "@/components/qr-image";
import type { Branch, QrCode } from "@/lib/types";
import { createQr, toggleQr, updateBranch } from "../../actions";

export const metadata = { title: "Branch" };

export default async function BranchPage({ params }: PageProps<"/merchant/branches/[id]">) {
  const { id } = await params;
  const { supabase, merchant, canManage } = await requireMerchant();
  const { data: branch } = await supabase.from("merchant_branches").select("*").eq("id", id).eq("merchant_id", merchant.id).maybeSingle<Branch>();
  if (!branch) notFound();
  const [{ data: qrs }, { data: campuses }] = await Promise.all([
    supabase.from("branch_qr_codes").select("*").eq("branch_id", id).order("created_at").returns<QrCode[]>(),
    supabase.from("campuses").select("id,name").order("name"),
  ]);
  return (
    <>
      <PageHeader title={branch.name} subtitle={branch.address} />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card title="Cashier QR codes" className="lg:col-span-3"
          actions={canManage && (
            <form action={createQr} className="flex gap-2">
              <input type="hidden" name="branch_id" value={id} />
              <Input name="label" placeholder="Label, e.g. Counter 2" className="w-40" />
              <Button variant="secondary">+ Add</Button>
            </form>
          )}>
          <div className="grid gap-4 sm:grid-cols-2">
            {(qrs ?? []).map((q) => (
              <div key={q.id} className={`rounded-2xl border p-4 text-center ${q.is_active ? "border-zinc-200" : "border-dashed border-zinc-300 opacity-60"}`}>
                <div className="mb-2 flex items-center justify-between"><span className="font-semibold">{q.label}</span><Badge tone={q.is_active ? "active" : "paused"}>{q.is_active ? "active" : "disabled"}</Badge></div>
                <div className="flex justify-center"><QrImage value={q.code} size={160} /></div>
                <div className="mt-2 font-mono text-xs text-zinc-500">{q.code}</div>
                <div className="mt-3 flex justify-center gap-3 text-sm font-semibold">
                  {q.is_active && <Link href={`/merchant/branches/${id}/qr/${q.id}`} className="text-perk-purple hover:underline">Print poster</Link>}
                  {canManage && (
                    <form action={toggleQr}>
                      <input type="hidden" name="id" value={q.id} /><input type="hidden" name="branch_id" value={id} />
                      <input type="hidden" name="active" value={String(!q.is_active)} />
                      <button className="text-zinc-500 hover:underline">{q.is_active ? "Disable" : "Enable"}</button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-zinc-500">If a QR photo leaks or gets misused, disable it and print a new one — old copies stop working instantly.</p>
        </Card>
        <Card title="Branch details" className="lg:col-span-2">
          {canManage ? <BranchForm action={updateBranch.bind(null, id)} branch={branch} campuses={campuses ?? []} /> : <p className="text-sm text-zinc-500">Only owners and managers can edit branches.</p>}
        </Card>
      </div>
    </>
  );
}
