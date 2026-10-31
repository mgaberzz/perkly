import { ActionForm, SubmitButton } from "./action-form";
import { Field, Input, Select } from "./ui";
import type { ActionState, Branch, Campus } from "@/lib/types";

export function BranchForm({ action, branch, campuses, submitLabel = "Save branch" }: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  branch?: Branch; campuses: Pick<Campus, "id" | "name">[]; submitLabel?: string;
}) {
  return (
    <ActionForm action={action} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Branch name" className="md:col-span-2"><Input name="name" defaultValue={branch?.name} placeholder="Costa – AUC Gate 4" required /></Field>
        <Field label="Address" className="md:col-span-2"><Input name="address" defaultValue={branch?.address ?? ""} /></Field>
        <Field label="City"><Input name="city" defaultValue={branch?.city ?? ""} /></Field>
        <Field label="Nearest campus">
          <Select name="campus_id" defaultValue={branch?.campus_id ?? ""}>
            <option value="">—</option>
            {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Latitude" hint="Used for “nearby” and the anti-fraud location check. Copy from Google Maps.">
          <Input name="lat" type="number" step="any" defaultValue={branch?.lat ?? ""} />
        </Field>
        <Field label="Longitude"><Input name="lng" type="number" step="any" defaultValue={branch?.lng ?? ""} /></Field>
        {branch && (
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="is_active" defaultChecked={branch.is_active} className="h-4 w-4 accent-perk-purple" /> Branch is open on Perkly
          </label>
        )}
      </div>
      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
