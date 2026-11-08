"use client";
import { useState } from "react";
import { ActionForm } from "./action-form";
import { useT } from "./i18n";
import { Input, Select } from "./ui";
import type { ActionState } from "@/lib/types";

/** Ready-made reasons; the student sees the chosen one in the app (translated there). */
export const REJECT_REASONS = [
  "The photo is blurry or too dark.",
  "The name on the card doesn't match your profile.",
  "The card is expired or not for this academic year.",
  "This isn't a student ID card.",
  "The university doesn't match your campus.",
];

export function VerificationReview({ id, action }: { id: string; action: (s: ActionState, fd: FormData) => Promise<ActionState> }) {
  const t = useT();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const btn = "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50";
  return (
    <ActionForm action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      {!rejecting ? (
        <div className="flex gap-2">
          <button name="decision" value="approve" className={`${btn} flex-1 bg-emerald-600 text-white hover:bg-emerald-700`}>{t("Approve")}</button>
          <button type="button" onClick={() => setRejecting(true)} className={`${btn} flex-1 border border-zinc-300 bg-white hover:bg-zinc-50`}>{t("Reject…")}</button>
        </div>
      ) : (
        <>
          <Select name="reason" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full">
            {REJECT_REASONS.map((r) => <option key={r} value={r}>{t(r)}</option>)}
            <option value="other">{t("Other reason…")}</option>
          </Select>
          {reason === "other" && <Input name="other" maxLength={300} placeholder={t("Tell the student what to fix")} required autoFocus />}
          <div className="flex gap-2">
            <button name="decision" value="reject" className={`${btn} flex-1 bg-red-600 text-white hover:bg-red-700`}>{t("Reject")}</button>
            <button type="button" onClick={() => setRejecting(false)} className={`${btn} border border-zinc-300 bg-white hover:bg-zinc-50`}>{t("Cancel")}</button>
          </div>
        </>
      )}
    </ActionForm>
  );
}
