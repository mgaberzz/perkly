"use client";
import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/types";
import { useT } from "./i18n";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/** Mobile number with SMS verification: enter the number, get a code by SMS, enter the code. */
export function PhoneSettings({ phone, verified, send, verify }: { phone: string | null; verified: boolean; send: Action; verify: Action }) {
  const t = useT();
  const [editing, setEditing] = useState(!phone);
  const [number, setNumber] = useState("");
  const [sent, sendAction, sending] = useActionState(send, undefined);
  const [done, verifyAction, verifying] = useActionState(verify, undefined);
  const input = "w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-perk-purple";
  const btn = "rounded-xl perk-gradient px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
  const msg = (s: ActionState) => s?.error ? <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{t(s.error)}</p>
    : s?.ok ? <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{t(s.ok)}</p> : null;
  if (done?.ok) return msg(done);
  return (
    <div>
      {phone && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold" dir="ltr">{phone}
            <span className={`ms-2 rounded-full px-2 py-0.5 text-xs font-bold ${verified ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{verified ? t("Verified") : t("Not verified")}</span>
          </span>
          {!editing && <button type="button" onClick={() => setEditing(true)} className="text-sm font-semibold text-perk-purple hover:underline">{verified ? t("Change") : t("Verify")}</button>}
        </div>
      )}
      {editing && !sent?.ok && (
        <form action={sendAction} className="mt-3">
          <label className="mb-1 block text-xs font-semibold text-zinc-500">{t("Mobile number")}</label>
          <div className="flex gap-2">
            <input name="phone" type="tel" inputMode="tel" dir="ltr" required placeholder="01x xxxx xxxx" defaultValue={!verified && phone ? phone : ""} onChange={(e) => setNumber(e.target.value)} className={input} />
            <button disabled={sending} className={`${btn} shrink-0`}>{t("Send code")}</button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">{t("We'll text you a 6-digit code to confirm the number is yours.")}</p>
          {msg(sent)}
        </form>
      )}
      {editing && sent?.ok && (
        <form action={verifyAction} className="mt-3">
          {msg(sent)}
          <label className="mb-1 mt-3 block text-xs font-semibold text-zinc-500">{t("Code from the SMS")}</label>
          <div className="flex gap-2">
            <input type="hidden" name="phone" value={number} />
            <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required dir="ltr" placeholder="123456" className={`${input} tracking-widest`} />
            <button disabled={verifying} className={`${btn} shrink-0`}>{t("Confirm")}</button>
          </div>
          {msg(done)}
        </form>
      )}
    </div>
  );
}
