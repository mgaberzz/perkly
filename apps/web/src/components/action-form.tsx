"use client";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import type { ActionState } from "@/lib/types";
import { useT } from "./i18n";

/** Form wrapper for server actions that return { error } / { ok }. */
export function ActionForm({
  action, children, className = "", resetOnSuccess = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  // A dropped connection (fetch fails) becomes a clear message instead of a silent failure
  const safeAction = async (prev: ActionState, fd: FormData): Promise<ActionState> => {
    try { return await action(prev, fd); }
    catch (e) {
      if (e instanceof TypeError) return { error: "Couldn't reach Perkly. Check your connection and try again — nothing was saved." };
      throw e;
    }
  };
  const [state, formAction, pending] = useActionState(safeAction, undefined);
  const t = useT();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok && resetOnSuccess) ref.current?.reset(); }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction}>
      <fieldset disabled={pending} className={className}>{children}</fieldset>
      {state?.error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{t(state.error)}</p>}
      {state?.ok && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{t(state.ok)}</p>}
    </form>
  );
}

export function SubmitButton({ children, variant = "primary", className = "" }: { children: ReactNode; variant?: "primary" | "secondary" | "danger"; className?: string }) {
  const cls = {
    primary: "perk-gradient text-white hover:opacity-90",
    secondary: "border border-zinc-300 bg-white hover:bg-zinc-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
  }[variant];
  return (
    <button type="submit" className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${cls} ${className}`}>
      {children}
    </button>
  );
}

export function ConfirmButton({ children, message, className = "" }: { children: ReactNode; message: string; className?: string }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}
    >
      {children}
    </button>
  );
}
