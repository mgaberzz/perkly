"use client";
import { useState } from "react";
import { ActionForm, SubmitButton } from "./action-form";
import { useT } from "./i18n";
import { MultiSelect } from "./multi-select";
import type { SearchOption } from "./search-select";
import { Field, Select } from "./ui";
import type { ActionState } from "@/lib/types";

/** Assign a merchant or a whole campus to an account manager. */
export function AssignForm({ action, managers, merchants, campuses, defaultManager }: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  managers: { id: string; label: string }[]; merchants: SearchOption[]; campuses: { id: string; name: string }[]; defaultManager?: string;
}) {
  const t = useT();
  const [what, setWhat] = useState<"merchant" | "campus">("merchant");
  const seg = (on: boolean) => `flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${on ? "bg-white text-perk-purple shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`;
  return (
    <ActionForm action={action} className="space-y-4" resetOnSuccess>
      <Field label={t("Account manager")}>
        <Select name="user_id" defaultValue={defaultManager ?? managers[0]?.id}>{managers.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</Select>
      </Field>
      <div>
        <span className="mb-1.5 block text-sm font-medium">{t("What to assign")}</span>
        <div className="flex gap-1 rounded-xl bg-zinc-100 p-1">
          <button type="button" className={seg(what === "merchant")} onClick={() => setWhat("merchant")}>{t("A merchant")}</button>
          <button type="button" className={seg(what === "campus")} onClick={() => setWhat("campus")}>{t("A whole campus")}</button>
        </div>
      </div>
      {what === "merchant" ? (
        <Field label={t("Merchants")} hint={t("Tick as many as you need.")}>
          <MultiSelect name="merchant_id" options={merchants} placeholder={t("Search by merchant name or ID")} />
        </Field>
      ) : (
        <Field label={t("Campuses")} hint={t("They get every merchant with a branch at these campuses, including new ones.")}>
          <MultiSelect name="campus_id" options={campuses.map((c) => ({ value: c.id, label: c.name }))} placeholder={t("Search campuses")} />
        </Field>
      )}
      <SubmitButton className="w-full">{t("Assign")}</SubmitButton>
    </ActionForm>
  );
}
