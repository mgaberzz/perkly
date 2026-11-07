"use client";
import { ActionForm, SubmitButton } from "./action-form";
import { useT } from "./i18n";
import { Field, Input, Select, Textarea } from "./ui";
import { BRAND_TYPE_LABEL, CHANNEL_LABEL } from "@/lib/labels";
import { BRAND_TYPES, CATEGORIES, type ActionState, type Merchant } from "@/lib/types";

export function MerchantAdminForm({ action, merchant, withOwner = false, commercial = true, readOnly = false, submitLabel }: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>; merchant?: Merchant; withOwner?: boolean;
  /** plan + commission editable (admin / operations) */ commercial?: boolean; readOnly?: boolean; submitLabel?: string;
}) {
  const t = useT();
  return (
    <ActionForm action={action} className="space-y-4">
      <fieldset disabled={readOnly} className="grid gap-4 md:grid-cols-2">
        <Field label={t("Name")}><Input name="name" defaultValue={merchant?.name} required /></Field>
        <Field label={t("Category")}>
          <Select name="category" defaultValue={merchant?.category ?? "Food"}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{t(c)}</option>)}
          </Select>
        </Field>
        <Field label={t("Subcategory")}><Input name="subcategory" defaultValue={merchant?.subcategory ?? ""} placeholder="Specialty coffee" /></Field>
        <Field label={t("Brand type")} hint={t("Local = single shop · Chain = several branches · Mega account = national brand with a dedicated account manager")}>
          <Select name="brand_type" defaultValue={merchant?.brand_type ?? "local"}>
            {BRAND_TYPES.map((b) => <option key={b} value={b}>{t(BRAND_TYPE_LABEL[b])}</option>)}
          </Select>
        </Field>
        <Field label={t("Status")}>
          <Select name="status" defaultValue={merchant?.status ?? "pending"}>
            {["pending", "live", "paused", "churned"].map((s) => <option key={s} value={s}>{t(s)}</option>)}
          </Select>
        </Field>
        <Field label={t("Sells")}>
          <Select name="channel" defaultValue={merchant?.channel ?? "in_store"}>
            {Object.entries(CHANNEL_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
          </Select>
        </Field>
        <Field label={t("Plan")}>
          <Select name="plan" defaultValue={merchant?.plan ?? "free"} disabled={!commercial}><option value="free">Free</option><option value="pro">Pro</option></Select>
        </Field>
        <Field label={t("Commission %")} hint={commercial ? t("Perkly's cut per redemption (3–7% typical)") : t("Set by Operations / Admin")}>
          <Input name="commission_pct" type="number" step="0.1" min="0" max="100" defaultValue={merchant?.commission_pct ?? 5} disabled={!commercial} />
        </Field>
        <label className="flex items-start gap-3 rounded-xl border border-zinc-200 p-3 md:col-span-2">
          <input type="checkbox" name="vat_enabled" defaultChecked={merchant?.vat_enabled ?? true} disabled={!commercial} className="mt-1 h-4 w-4 accent-perk-purple" />
          <span><span className="block text-sm font-semibold">{t("Charge VAT on Perkly commission")}</span>
            <span className="block text-xs text-zinc-500">{commercial ? t("Turn off for VAT-exempt merchants. Changing it recalculates their transactions that are not settled yet.") : t("Set by Operations / Admin")}</span></span>
        </label>
        <Field label={t("Website (online merchants)")}><Input name="website_url" type="url" defaultValue={merchant?.website_url ?? ""} placeholder="https://" /></Field>
        <Field label={t("Tracked link / affiliate URL")} hint={t("Perkly adds ?perkly_ref=… so the shop can report orders for cashback")}><Input name="affiliate_url" type="url" defaultValue={merchant?.affiliate_url ?? ""} placeholder="https://" /></Field>
        <Field label={t("Logo URL")}><Input name="logo_url" type="url" defaultValue={merchant?.logo_url ?? ""} /></Field>
        <Field label={t("Contact name")}><Input name="contact_name" defaultValue={merchant?.contact_name ?? ""} /></Field>
        <Field label={t("Contact phone")}><Input name="contact_phone" defaultValue={merchant?.contact_phone ?? ""} /></Field>
        <Field label={t("Contact email")}><Input name="contact_email" type="email" defaultValue={merchant?.contact_email ?? ""} /></Field>
        {withOwner && <Field label={t("Owner email")} hint={t("They get an invite to set a password and log in to the merchant portal")}><Input name="owner_email" type="email" /></Field>}
        <Field label={t("Description")} className="md:col-span-2"><Textarea name="description" defaultValue={merchant?.description ?? ""} /></Field>
      </fieldset>
      {!readOnly && <SubmitButton>{submitLabel ?? t("Save")}</SubmitButton>}
    </ActionForm>
  );
}
