import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireMerchant } from "@/lib/auth";
import { Badge, Card, Field, Input, PageHeader } from "@/components/ui";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/action-form";
import { BranchForm } from "@/components/branch-form";
import { QrImage } from "@/components/qr-image";
import { getT } from "@/lib/i18n/server";
import type { Branch, QrCode } from "@/lib/types";
import { createQr, removeBranch, removeQr, toggleQr, updateBranch } from "../../actions";

export const metadata = { title: "Branch" };

export default async function BranchPage({ params }: PageProps<"/merchant/branches/[id]">) {
  const { id } = await params;
  const { supabase, merchant, canManage, branchScope, memberRole } = await requireMerchant();
  if (branchScope && branchScope.id !== id) redirect(`/merchant/branches/${branchScope.id}`);
  const t = await getT();
  const { data: branch } = await supabase.from("merchant_branches").select("*").eq("id", id).eq("merchant_id", merchant.id).maybeSingle<Branch>();
  if (!branch) notFound();
  const [{ data: qrs }, { data: campuses }] = await Promise.all([
    supabase.from("branch_qr_codes").select("*").eq("branch_id", id).order("created_at").returns<QrCode[]>(),
    supabase.from("campuses").select("id,name").order("name"),
  ]);
  const canQr = canManage || branchScope?.id === id;
  return (
    <>
      <PageHeader title={branch.name} subtitle={branch.address} />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card title={t("Cashier QR codes")} className="lg:col-span-3">
          <div className="grid gap-4 sm:grid-cols-2">
            {(qrs ?? []).map((q) => {
              const usable = q.is_active && q.status === "approved";
              return (
                <div key={q.id} className={`rounded-2xl border p-4 text-center ${usable ? "border-zinc-200" : "border-dashed border-zinc-300"}`}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{q.cashier_name ?? q.label}</span>
                    <Badge tone={!q.is_active ? "paused" : q.status}>{!q.is_active ? t("disabled") : t(q.status)}</Badge>
                  </div>
                  <div className={`flex justify-center ${usable ? "" : "opacity-30 blur-[2px]"}`}><QrImage value={q.code} size={150} /></div>
                  <div className="mt-2 font-mono text-xs text-zinc-500">{q.code}</div>
                  {q.status === "pending" && <p className="mt-2 text-xs text-amber-700">{t("Waiting for Perkly approval — it can't be scanned yet.")}</p>}
                  {q.status === "rejected" && <p className="mt-2 text-xs text-red-600">{t("Not approved")}{q.review_note && `: ${q.review_note}`}</p>}
                  <div className="mt-3 flex justify-center gap-3 text-sm font-semibold">
                    {usable && <Link href={`/merchant/branches/${id}/qr/${q.id}`} className="text-perk-purple hover:underline">{t("Print poster")}</Link>}
                    {canQr && q.status === "approved" && (
                      <form action={toggleQr}>
                        <input type="hidden" name="id" value={q.id} /><input type="hidden" name="branch_id" value={id} />
                        <input type="hidden" name="active" value={String(!q.is_active)} />
                        <button className="text-zinc-500 hover:underline">{q.is_active ? t("Disable") : t("Enable")}</button>
                      </form>
                    )}
                    {canQr && (
                      <form action={removeQr}>
                        <input type="hidden" name="id" value={q.id} /><input type="hidden" name="branch_id" value={id} />
                        <ConfirmButton message={t("Remove this QR code? Codes that were already used are switched off instead.")} className="text-red-600 hover:underline">{t("Remove")}</ConfirmButton>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {canQr && (
            <div className="mt-5 rounded-2xl bg-zinc-50 p-4">
              <h3 className="mb-2 text-sm font-bold">+ {t("Request a QR for a cashier")}</h3>
              <ActionForm action={createQr} className="flex flex-wrap items-end gap-2" resetOnSuccess>
                <input type="hidden" name="branch_id" value={id} />
                <Field label={t("Cashier name")}><Input name="cashier_name" placeholder={t("e.g. Mona or Till 2")} required className="w-48" /></Field>
                <SubmitButton variant="secondary">{t("Request QR")}</SubmitButton>
              </ActionForm>
            </div>
          )}
          <p className="mt-4 text-xs text-zinc-500">{t("If a QR photo leaks or gets misused, disable it and request a new one — old copies stop working instantly.")}</p>
        </Card>
        <Card title={t("Branch details")} className="lg:col-span-2">
          {canManage ? <BranchForm action={updateBranch.bind(null, id)} branch={branch} campuses={campuses ?? []} /> : <p className="text-sm text-zinc-500">{t("Only owners and managers can edit branches.")}</p>}
          {memberRole === "owner" && (
            <form action={removeBranch} className="mt-6 border-t border-zinc-100 pt-4">
              <input type="hidden" name="id" value={id} />
              <ConfirmButton message={t("Remove this branch? If it has transactions it will be closed instead, and its QR codes switched off.")} className="text-sm font-semibold text-red-600 hover:underline">{t("Remove branch")}</ConfirmButton>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
