import { Field, Select } from "./ui";
import type { TFn } from "@/lib/i18n";

/** "Invite email language" dropdown for every form that sends a staff invite. */
export function InviteLangField({ t }: { t: TFn }) {
  return (
    <Field label={t("Invite email language")} hint={t("The invite is written in this language.")}>
      <Select name="lang" defaultValue="en">
        <option value="en">English</option>
        <option value="ar">العربية (Arabic)</option>
      </Select>
    </Field>
  );
}
