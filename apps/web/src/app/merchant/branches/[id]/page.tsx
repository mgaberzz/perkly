import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireMerchantArea } from "@/lib/auth";
import { Badge, Card, Field, Input, PageHeader } from "@/components/ui";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/action-form";
import { QrImage } from "@/components/qr-image";
import { getT } from "@/lib/i18n/server";
import type { Branch, QrCode } from "@/lib/types";
import { createQr, removeBranch, removeQr, renameQr, toggleQr, reopenBranch } from "../../actions";

export const metadata = { title: "Branch" };

export default async function BranchPage({ params }: PageProps<"/merchant/branches/[id]">) {
  const { id } = await params;
  const { supabase, merchant, canManage, branchScope, memberRole } = await requireMerchantArea("branches");
  if (branchScope && branchScope.id !== id) redirect(`/merchant/branches/${branchScope.id}`);
  const t = await getT();
  const { data: branch } = await supabase.from("merchant_branches").select("*").eq("id", id).eq("merchant_id", merchant.id).maybeSingle<Branch>();
  if (!branch) notFound();
  const [{ data: qrs }, { data: campus }] = await Promise.all([
    supabase.from("branch_qr_codes").select("*").eq("branch_id", id).order("created_at").returns<QrCode[]>(),
    branch.campus_id ? supabase.from("campuses").select("name").eq("id", branch.campus_id).maybeSingle() : Promise.resolve({ data: null }),
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
                  {canQr && (
                    <details className="mt-2 text-start">
                      <summary className="cursor-pointer text-center text-sm font-semibold text-perk-purple">{t("Edit cashier name")}</summary>
                      <ActionForm action={renameQr} className="mt-2 flex items-end gap-2">
                        <input type="hidden" name="id" value={q.id} /><input type="hidden" name="branch_id" value={id} />
                        <Input name="cashier_name" defaultValue={q.cashier_name ?? q.label} required maxLength={60} aria-label={t("Cashier name")} />
                        <SubmitButton variant="secondary">{t("Save")}</SubmitButton>
                      </ActionForm>
                    </details>
                  )}
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
          <dl className="space-y-2 text-sm">
            {([[t("Branch name"), branch.name], [t("Address"), branch.address], [t("City"), branch.city], [t("Nearest campus"), campus?.name],
              [t("Location"), branch.lat != null ? t("Set") : t("Missing")]] as const).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-zinc-100 pb-2"><dt className="text-zinc-500">{k}</dt><dd className="text-end font-semibold">{v || "—"}</dd></div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-zinc-500">{t("To change these details, contact Perkly. The Perkly team updates them for you.")}</p>
          {memberRole === "owner" && (branch.is_active ? (
            <form action={removeBranch} className="mt-6 border-t border-zinc-100 pt-4">
              <input type="hidden" name="id" value={id} />
              <ConfirmButton message={t("Remove this branch? Students will no longer see it or be able to use Perkly there. Its QR codes and history are kept, and you can reopen it later.")} className="text-sm font-semibold text-red-600 hover:underline">{t("Remove branch")}</ConfirmButton>
            </form>
          ) : (
            <form action={reopenBranch} className="mt-6 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4">
              <input type="hidden" name="id" value={id} />
              <span className="text-sm text-zinc-500">{t("This branch is removed: students can't see it.")}</span>
              <button className="text-sm font-semibold text-emerald-700 hover:underline">{t("Reopen branch")}</button>
            </form>
          ))}
        </Card>
      </div>
    </>
  );
}
