"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

/** Save the shop's own receipt / order number on a transaction (permission is checked in the database). */
export async function saveReceiptRef(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_receipt_ref", { p_redemption_id: String(fd.get("id") ?? ""), p_ref: String(fd.get("receipt_ref") ?? "") });
  const r = data as { ok: boolean; error?: string } | null;
  if (error || !r?.ok) {
    return { error: r?.error === "bad_ref" ? "Use up to 40 letters, numbers, spaces or # / . _ -" : r?.error === "not_allowed" ? "You can't change this transaction." : error?.message ?? "Could not save." };
  }
  revalidatePath("/admin/redemptions"); revalidatePath("/merchant/redemptions");
  return { ok: "Saved." };
}
