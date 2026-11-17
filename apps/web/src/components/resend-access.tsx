import { ActionForm } from "./action-form";
import type { ActionState } from "@/lib/types";
import type { TFn } from "@/lib/i18n";

/** "Resend invite" and "Send password reset" for one person. */
export function ResendAccess({ action, email, t }: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>; email: string; t: TFn;
}) {
  return (
    <ActionForm action={action} className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <input type="hidden" name="email" value={email} />
      <button name="kind" value="invite" className="text-xs font-semibold text-perk-purple hover:underline">{t("Resend invite")}</button>
      <button name="kind" value="reset" className="text-xs font-semibold text-perk-purple hover:underline">{t("Send password reset")}</button>
    </ActionForm>
  );
}
