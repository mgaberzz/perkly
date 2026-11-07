import { ActionForm, SubmitButton } from "./action-form";
import { Field, Input, Select } from "./ui";
import type { ActionState, Branch, Campus } from "@/lib/types";
import { getT } from "@/lib/i18n/server";

export async function BranchForm({ action, branch, campuses, submitLabel }: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  branch?: Branch; campuses: Pick<Campus, "id" | "name">[]; submitLabel?: string;
}) {
  const t = await getT();
  return (
    <ActionForm action={action} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("Branch name")} className="md:col-span-2"><Input name="name" defaultValue={branch?.name} placeholder="Costa – AUC Gate 4" required /></Field>
        <Field label={t("Address")} className="md:col-span-2"><Input name="address" defaultValue={branch?.address ?? ""} /></Field>
        <Field label={t("City")}><Input name="city" defaultValue={branch?.city ?? ""} /></Field>
        <Field label={t("Nearest campus")}>
          <Select name="campus_id" defaultValue={branch?.campus_id ?? ""}>
            <option value="">—</option>
            {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label={t("Latitude")} hint={t("Used for “nearby” and the anti-fraud location check. Copy from Google Maps.")}>
          <Input name="lat" type="number" step="any" defaultValue={branch?.lat ?? ""} />
        </Field>
        <Field label={t("Longitude")}><Input name="lng" type="number" step="any" defaultValue={branch?.lng ?? ""} /></Field>
        {!branch && <Field label={t("First cashier name")} hint={t("Gets the first QR code (approved by Perkly).")}><Input name="cashier_name" placeholder={t("e.g. Mona or Till 1")} /></Field>}
        {branch && (
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="is_active" defaultChecked={branch.is_active} className="h-4 w-4 accent-perk-purple" /> {t("Branch is open on Perkly")}
          </label>
        )}
      </div>
      <SubmitButton>{submitLabel ?? t("Save branch")}</SubmitButton>
    </ActionForm>
  );
}
