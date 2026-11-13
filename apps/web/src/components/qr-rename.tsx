"use client";
import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/types";
import { useT } from "./i18n";

/** "Edit cashier name" on a QR card: opens a small form and closes again once the name is saved. */
export function QrRename({ action, id, branchId, name }: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>; id: string; branchId: string; name: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const res = await action(prev, fd);
    if (res?.ok) setOpen(false);
    return res;
  }, undefined);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-2 text-sm font-semibold text-perk-purple hover:underline">{t("Edit cashier name")}</button>;
  return (
    <form action={formAction} className="mt-2 text-start">
      <input type="hidden" name="id" value={id} /><input type="hidden" name="branch_id" value={branchId} />
      <div className="flex gap-2">
        <input name="cashier_name" defaultValue={name} required maxLength={60} autoFocus aria-label={t("Cashier name")}
          className="w-full min-w-0 rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-perk-purple" />
        <button disabled={pending} className="shrink-0 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-50">{t("Save")}</button>
        <button type="button" onClick={() => setOpen(false)} className="shrink-0 text-sm text-zinc-500 hover:underline">{t("Cancel")}</button>
      </div>
      {state?.error && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{t(state.error)}</p>}
    </form>
  );
}
