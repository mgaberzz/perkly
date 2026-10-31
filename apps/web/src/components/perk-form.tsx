import { ActionForm, SubmitButton } from "./action-form";
import { Field, Input, Select, Textarea } from "./ui";
import { DAYS } from "@/lib/format";
import { isoToCairoLocal } from "@/lib/cairo-time";
import type { ActionState, Branch, Perk } from "@/lib/types";

export function PerkForm({
  action, perk, branches, submitLabel = "Save perk",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  perk?: Perk;
  branches: Pick<Branch, "id" | "name">[];
  submitLabel?: string;
}) {
  const days = perk?.valid_days ?? [0, 1, 2, 3, 4, 5, 6];
  return (
    <ActionForm action={action} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Title" className="md:col-span-2"><Input name="title" defaultValue={perk?.title} placeholder="20% off all drinks" required /></Field>
        <Field label="Discount type">
          <Select name="discount_type" defaultValue={perk?.discount_type ?? "percentage"}>
            <option value="percentage">Percentage off</option>
            <option value="amount">Fixed EGP off</option>
            <option value="bogo">Buy 1 get 1</option>
            <option value="bundle">Bundle deal</option>
          </Select>
        </Field>
        <Field label="Discount value" hint="% for percentage, EGP for fixed. Tiers: 10% Bronze · 15–20% Silver · 25–30% Gold · 35–40% Hero (needs approval)">
          <Input name="discount_value" type="number" step="0.01" min="0" defaultValue={perk?.discount_value ?? 10} />
        </Field>
        <Field label="Max discount (EGP)" hint="Optional cap per redemption"><Input name="max_discount_amount" type="number" step="0.01" min="0" defaultValue={perk?.max_discount_amount ?? ""} /></Field>
        <Field label="Minimum spend (EGP)"><Input name="min_spend" type="number" step="0.01" min="0" defaultValue={perk?.min_spend ?? 0} /></Field>
        <Field label="Uses per student" hint="Lifetime limit. Empty = unlimited (still max 2/day per merchant)"><Input name="max_uses_per_user" type="number" min="1" defaultValue={perk?.max_uses_per_user ?? ""} /></Field>
        <Field label="Daily cap" hint="Total redemptions per day, all students"><Input name="daily_cap" type="number" min="1" defaultValue={perk?.daily_cap ?? ""} /></Field>
        <Field label="Starts (Cairo time)"><Input name="start_at" type="datetime-local" defaultValue={isoToCairoLocal(perk?.start_at)} /></Field>
        <Field label="Ends (Cairo time)"><Input name="end_at" type="datetime-local" defaultValue={isoToCairoLocal(perk?.end_at)} /></Field>
        <Field label="Branch">
          <Select name="branch_id" defaultValue={perk?.branch_id ?? ""}>
            <option value="">All branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label="Valid days">
          <div className="flex flex-wrap gap-2 pt-1">
            {DAYS.map((d, i) => (
              <label key={d} className="flex items-center gap-1 rounded-lg border border-zinc-300 px-2 py-1 text-sm has-[:checked]:border-perk-purple has-[:checked]:bg-perk-purple/10">
                <input type="checkbox" name="valid_days" value={i} defaultChecked={days.includes(i)} className="accent-perk-purple" />{d}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Description" className="md:col-span-2"><Textarea name="description" defaultValue={perk?.description ?? ""} placeholder="What students get" /></Field>
        <Field label="Notes for cashier / terms" className="md:col-span-2"><Textarea name="terms" defaultValue={perk?.terms ?? ""} placeholder="Not valid with other offers. Dine-in only." /></Field>
        <label className="flex items-center gap-2 text-sm font-semibold md:col-span-2">
          <input type="checkbox" name="is_flash" defaultChecked={perk?.is_flash} className="h-4 w-4 accent-perk-pink" />
          ⚡ Flash perk (shown in &quot;Ending soon&quot; — set an end date)
        </label>
      </div>
      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
