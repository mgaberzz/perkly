import { ActionForm, SubmitButton } from "./action-form";
import { Field, Input, Select, Textarea } from "./ui";
import { CATEGORIES, type ActionState, type Merchant } from "@/lib/types";

export function MerchantAdminForm({ action, merchant, withOwner = false, submitLabel = "Save" }: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>; merchant?: Merchant; withOwner?: boolean; submitLabel?: string;
}) {
  return (
    <ActionForm action={action} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name"><Input name="name" defaultValue={merchant?.name} required /></Field>
        <Field label="Category">
          <Select name="category" defaultValue={merchant?.category ?? "Food"}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Subcategory"><Input name="subcategory" defaultValue={merchant?.subcategory ?? ""} placeholder="Specialty coffee" /></Field>
        <Field label="Brand type">
          <Select name="brand_type" defaultValue={merchant?.brand_type ?? "local"}>
            <option value="local">Local</option><option value="chain">Chain</option><option value="national_brand">National brand</option>
          </Select>
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={merchant?.status ?? "pending"}>
            <option value="pending">Pending</option><option value="live">Live</option><option value="paused">Paused</option><option value="churned">Churned</option>
          </Select>
        </Field>
        <Field label="Plan">
          <Select name="plan" defaultValue={merchant?.plan ?? "free"}><option value="free">Free</option><option value="pro">Pro</option></Select>
        </Field>
        <Field label="Commission %" hint="Perkly's cut per redemption (3–7% typical)"><Input name="commission_pct" type="number" step="0.1" min="0" max="100" defaultValue={merchant?.commission_pct ?? 5} /></Field>
        <Field label="Logo URL"><Input name="logo_url" type="url" defaultValue={merchant?.logo_url ?? ""} /></Field>
        <Field label="Contact name"><Input name="contact_name" defaultValue={merchant?.contact_name ?? ""} /></Field>
        <Field label="Contact phone"><Input name="contact_phone" defaultValue={merchant?.contact_phone ?? ""} /></Field>
        <Field label="Contact email"><Input name="contact_email" type="email" defaultValue={merchant?.contact_email ?? ""} /></Field>
        {withOwner && <Field label="Owner email" hint="They get an invite to set a password and log in to the merchant portal"><Input name="owner_email" type="email" /></Field>}
        <Field label="Description" className="md:col-span-2"><Textarea name="description" defaultValue={merchant?.description ?? ""} /></Field>
      </div>
      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
