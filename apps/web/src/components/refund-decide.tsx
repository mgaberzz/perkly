import { ActionForm, SubmitButton } from "./action-form";
import { Input } from "./ui";
import type { ActionState } from "@/lib/types";
import type { TFn } from "@/lib/i18n";

/** Approve / reject box shown next to a waiting refund request. */
export function RefundDecide({ id, action, t }: { id: string; action: (prev: ActionState, fd: FormData) => Promise<ActionState>; t: TFn }) {
  return (
    <ActionForm action={action} className="space-y-2 rounded-xl bg-zinc-50 p-3">
      <input type="hidden" name="id" value={id} />
      <Input name="note" maxLength={500} placeholder={t("Note to the student (needed to reject)")} />
      <div className="grid grid-cols-2 gap-2">
        <button name="decision" value="approve" className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">{t("Approve refund")}</button>
        <button name="decision" value="reject" className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50">{t("Reject")}</button>
      </div>
    </ActionForm>
  );
}

export function RefundPay({ id, action, t }: { id: string; action: (prev: ActionState, fd: FormData) => Promise<ActionState>; t: TFn }) {
  return (
    <ActionForm action={action} className="space-y-2 rounded-xl bg-zinc-50 p-3">
      <input type="hidden" name="id" value={id} />
      <Input name="reference" required maxLength={80} placeholder={t("Payment reference")} />
      <SubmitButton className="w-full">{t("Mark refund as paid")}</SubmitButton>
    </ActionForm>
  );
}
