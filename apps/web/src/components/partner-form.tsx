import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui";
import type { ActionState, Partner } from "@/lib/types";

/** Partner details + deal (percentage of Perkly's commission, or fixed EGP per transaction). */
export function PartnerForm({ action, partner, t, submit }: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>; partner?: Partner | null;
  t: (s: string, v?: Record<string, string | number>) => string; submit: string;
}) {
  return (
    <ActionForm action={action} className="space-y-3" resetOnSuccess={!partner}>
      <Field label={t("Partner name")}><Input name="name" required defaultValue={partner?.name} placeholder="Cairo Growth Co." /></Field>
      <div className="space-y-3">
        <Field label={t("Deal type")}>
          <Select name="cut_type" defaultValue={partner?.cut_type ?? "percentage"}>
            <option value="percentage">{t("% of Perkly commission")}</option>
            <option value="fixed">{t("Fixed EGP per transaction")}</option>
          </Select>
        </Field>
        <Field label={t("Cut")} hint={t("e.g. 20 = 20% of commission, or 5 EGP per transaction")}>
          <Input name="cut_value" type="number" step="0.01" min="0" required defaultValue={partner?.cut_value ?? 20} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("Contact name")}><Input name="contact_name" defaultValue={partner?.contact_name ?? ""} /></Field>
        <Field label={t("Phone")}><Input name="contact_phone" defaultValue={partner?.contact_phone ?? ""} /></Field>
      </div>
      <Field label={t("Email")}><Input name="contact_email" type="email" defaultValue={partner?.contact_email ?? ""} /></Field>
      {partner && (
        <Field label={t("Status")}>
          <Select name="status" defaultValue={partner.status}><option value="active">{t("active")}</option><option value="paused">{t("paused")}</option></Select>
        </Field>
      )}
      <Field label={t("Notes")}><Textarea name="notes" defaultValue={partner?.notes ?? ""} placeholder={t("Contract date, payment terms…")} /></Field>
      <p className="text-xs text-zinc-500">{t("The cut is taken from Perkly's commission (VAT not included). A fixed cut never exceeds a transaction's commission. Changes apply to new transactions only.")}</p>
      <SubmitButton className="w-full">{submit}</SubmitButton>
    </ActionForm>
  );
}

export function dealLabel(p: { cut_type: string; cut_value: number }, t: (s: string, v?: Record<string, string | number>) => string) {
  return p.cut_type === "fixed"
    ? t("{amount} EGP per transaction", { amount: Number(p.cut_value).toLocaleString("en-EG") })
    : t("{pct}% of commission", { pct: Number(p.cut_value) });
}
