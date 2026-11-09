"use client";
import { ActionForm, SubmitButton } from "./action-form";
import { useT } from "./i18n";
import { saveReceiptRef } from "@/app/receipt-actions";

/** Inline field for the shop's receipt / order number on a transaction. */
export function ReceiptRefForm({ id, value }: { id: string; value: string | null }) {
  const t = useT();
  return (
    <ActionForm action={saveReceiptRef} className="flex gap-2">
      <input type="hidden" name="id" value={id} />
      <input name="receipt_ref" defaultValue={value ?? ""} maxLength={40} placeholder={t("e.g. INV-0042")}
        className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2.5 font-mono text-sm outline-none focus:border-perk-purple" />
      <SubmitButton variant="secondary" className="!px-3 !py-1.5 text-xs">{t("Save")}</SubmitButton>
    </ActionForm>
  );
}
