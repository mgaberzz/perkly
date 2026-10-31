import { cairoLocalToISO } from "./cairo-time";
import type { DiscountType } from "./types";

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

/** Parses + validates the shared perk form. Returns the row to write or an error message. */
export function parsePerkForm(fd: FormData): { error: string } | { row: Record<string, unknown> } {
  const title = String(fd.get("title") ?? "").trim();
  const discount_type = String(fd.get("discount_type") ?? "percentage") as DiscountType;
  const discount_value = num(fd.get("discount_value")) ?? 0;
  const max_discount_amount = num(fd.get("max_discount_amount"));
  const min_spend = num(fd.get("min_spend")) ?? 0;
  const max_uses_per_user = num(fd.get("max_uses_per_user"));
  const daily_cap = num(fd.get("daily_cap"));
  const days = fd.getAll("valid_days").map(Number).filter((d) => d >= 0 && d <= 6);
  const start_at = cairoLocalToISO(String(fd.get("start_at") ?? ""));
  const end_at = cairoLocalToISO(String(fd.get("end_at") ?? ""));
  const branch_id = String(fd.get("branch_id") ?? "") || null;

  if (!title) return { error: "Give the perk a title." };
  if (!["percentage", "amount", "bogo", "bundle"].includes(discount_type)) return { error: "Pick a discount type." };
  for (const [k, v] of Object.entries({ discount_value, max_discount_amount, min_spend, max_uses_per_user, daily_cap })) {
    if (Number.isNaN(v) || (v != null && v < 0)) return { error: `"${k.replaceAll("_", " ")}" must be a positive number.` };
  }
  if (discount_type === "percentage" && (discount_value <= 0 || discount_value > 100)) return { error: "Percentage must be between 1 and 100." };
  if (discount_type === "amount" && discount_value <= 0) return { error: "Enter the EGP amount off." };
  if (discount_type === "percentage" && discount_value > 30 && (!end_at || !max_uses_per_user || !daily_cap)) {
    return { error: "Perks above 30% need an end date, a per-student limit and a daily cap. They also need Perkly approval." };
  }
  if (start_at && end_at && end_at <= start_at) return { error: "End date must be after start date." };

  return {
    row: {
      title,
      description: String(fd.get("description") ?? "").trim() || null,
      terms: String(fd.get("terms") ?? "").trim() || null,
      discount_type, discount_value, max_discount_amount, min_spend, max_uses_per_user, daily_cap,
      valid_days: days.length === 0 || days.length === 7 ? null : days,
      start_at, end_at, branch_id,
      is_flash: fd.get("is_flash") === "on",
    },
  };
}
