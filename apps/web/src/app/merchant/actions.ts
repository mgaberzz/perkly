"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MERCHANT_COOKIE, requireMerchant, requireMerchantArea } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { addMember } from "@/lib/members";
import { parsePerkForm } from "@/lib/perk-form";
import type { ActionState, MemberRole } from "@/lib/types";

async function manager() {
  const ctx = await requireMerchant();
  if (!ctx.canManage) throw new Error("Only owners and managers can change this.");
  return ctx;
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const numOrNull = (fd: FormData, k: string) => {
  const s = str(fd, k);
  return s === "" || Number.isNaN(Number(s)) ? null : Number(s);
};

export async function switchMerchant(formData: FormData) {
  const id = str(formData, "merchant_id");
  const { memberships } = await requireMerchant();
  if (memberships.some((m) => m.merchant.id === id)) {
    (await cookies()).set(MERCHANT_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  revalidatePath("/merchant", "layout");
}

// ───────── Perks ─────────
export async function createPerk(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, merchant } = await manager();
  const parsed = parsePerkForm(fd);
  if ("error" in parsed) return parsed;
  const { data, error } = await supabase.from("perks")
    .insert({ ...parsed.row, merchant_id: merchant.id, status: "active" }).select("id,status").single();
  if (error) return { error: error.message };
  revalidatePath("/merchant/perks");
  redirect(`/merchant/perks/${data.id}?created=${data.status}`);
}

export async function updatePerk(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, merchant } = await manager();
  const parsed = parsePerkForm(fd);
  if ("error" in parsed) return parsed;
  const { data, error } = await supabase.from("perks").update(parsed.row)
    .eq("id", id).eq("merchant_id", merchant.id).select("status").single();
  if (error) return { error: error.message };
  revalidatePath("/merchant/perks");
  return { ok: data.status === "pending" ? "Saved — waiting for Perkly approval." : "Saved." };
}

export async function setPerkStatus(fd: FormData) {
  const { supabase, merchant } = await manager();
  const status = str(fd, "status");
  if (!["active", "paused"].includes(status)) return;
  await supabase.from("perks").update({ status }).eq("id", str(fd, "id")).eq("merchant_id", merchant.id);
  revalidatePath("/merchant/perks", "layout");
}

// ───────── Branches & QR ─────────
function branchRow(fd: FormData) {
  return {
    name: str(fd, "name"),
    address: str(fd, "address") || null,
    city: str(fd, "city") || null,
    campus_id: str(fd, "campus_id") || null,
    lat: numOrNull(fd, "lat"),
    lng: numOrNull(fd, "lng"),
    is_active: fd.get("is_active") !== null ? fd.get("is_active") === "on" : true,
  };
}

export async function createBranch(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, merchant } = await manager();
  const row = branchRow(fd);
  if (!row.name) return { error: "Branch name is required." };
  const { data, error } = await supabase.from("merchant_branches").insert({ ...row, merchant_id: merchant.id }).select("id").single();
  if (error) return { error: error.message };
  // Every branch gets a first cashier QR (pending until Perkly approves it)
  await supabase.from("branch_qr_codes").insert({ branch_id: data.id, label: "Cashier 1", cashier_name: str(fd, "cashier_name") || "Cashier 1" });
  revalidatePath("/merchant/branches");
  redirect(`/merchant/branches/${data.id}`);
}

export async function updateBranch(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, merchant } = await manager();
  const row = branchRow(fd);
  if (!row.name) return { error: "Branch name is required." };
  const { error } = await supabase.from("merchant_branches").update(row).eq("id", id).eq("merchant_id", merchant.id);
  if (error) return { error: error.message };
  revalidatePath("/merchant/branches", "layout");
  return { ok: "Branch saved." };
}

/** Owners/managers: any branch. Branch managers: only their own branch. */
async function branchEditor(branchId: string) {
  const ctx = await requireMerchant();
  const { data: branch } = await ctx.supabase.from("merchant_branches").select("id").eq("id", branchId).eq("merchant_id", ctx.merchant.id).maybeSingle();
  if (!branch) throw new Error("Branch not found.");
  if (!(ctx.canManage || ctx.branchScope?.id === branchId)) throw new Error("Not allowed.");
  return ctx;
}

/** A new cashier QR starts as "pending" until the Perkly team approves it (notification center). */
export async function createQr(_: ActionState, fd: FormData): Promise<ActionState> {
  const branchId = str(fd, "branch_id");
  const { supabase } = await branchEditor(branchId);
  const cashier = str(fd, "cashier_name");
  if (!cashier) return { error: "Enter the cashier's name (or till number)." };
  const { error } = await supabase.from("branch_qr_codes").insert({ branch_id: branchId, cashier_name: cashier, label: str(fd, "label") || cashier });
  if (error) return { error: error.message };
  revalidatePath(`/merchant/branches/${branchId}`);
  revalidatePath("/merchant/branches");
  return { ok: "QR requested — it works as soon as Perkly approves it." };
}

export async function toggleQr(fd: FormData) {
  const branchId = str(fd, "branch_id");
  const { supabase } = await branchEditor(branchId);
  await supabase.from("branch_qr_codes").update({ is_active: fd.get("active") === "true" }).eq("id", str(fd, "id")).eq("branch_id", branchId);
  revalidatePath(`/merchant/branches/${branchId}`);
}

/** Remove a QR. Codes that were already used are kept for the records and just switched off. */
export async function removeQr(fd: FormData) {
  const branchId = str(fd, "branch_id"), id = str(fd, "id");
  const { supabase, memberRole } = await branchEditor(branchId);
  const { count } = await supabase.from("redemptions").select("id", { count: "exact", head: true }).eq("qr_code_id", id);
  if (!count && memberRole === "owner") {
    const { error } = await supabase.from("branch_qr_codes").delete().eq("id", id).eq("branch_id", branchId);
    if (!error) { revalidatePath(`/merchant/branches/${branchId}`); return; }
  }
  await supabase.from("branch_qr_codes").update({ is_active: false }).eq("id", id).eq("branch_id", branchId);
  revalidatePath(`/merchant/branches/${branchId}`);
}

/** Remove a branch: deleted if it never had a redemption, otherwise closed (history is kept). */
export async function removeBranch(fd: FormData) {
  const { supabase, merchant, memberRole } = await requireMerchant();
  if (memberRole !== "owner") return;
  const id = str(fd, "id");
  const { count } = await supabase.from("redemptions").select("id", { count: "exact", head: true }).eq("branch_id", id);
  let removed = false;
  if (!count) {
    const { error } = await supabase.from("merchant_branches").delete().eq("id", id).eq("merchant_id", merchant.id);
    removed = !error;
  }
  if (!removed) {
    await supabase.from("merchant_branches").update({ is_active: false }).eq("id", id).eq("merchant_id", merchant.id);
    await supabase.from("branch_qr_codes").update({ is_active: false }).eq("branch_id", id);
  }
  revalidatePath("/merchant/branches", "layout");
  redirect("/merchant/branches");
}

// ───────── Payouts ─────────
export async function saveBankAccount(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, merchant, memberRole } = await requireMerchant();
  if (memberRole !== "owner") return { error: "Only the owner can change bank details." };
  const iban = str(fd, "iban").replace(/\s+/g, "").toUpperCase();
  if (iban && !/^EG\d{27}$/.test(iban)) return { error: "Egyptian IBANs start with EG followed by 27 digits." };
  const { error } = await supabase.from("merchant_bank_accounts").upsert({
    merchant_id: merchant.id, bank_name: str(fd, "bank_name") || null, account_name: str(fd, "account_name") || null,
    iban: iban || null, payout_schedule: str(fd, "payout_schedule") || "weekly", updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  revalidatePath("/merchant/payouts");
  return { ok: "Bank details saved." };
}

// ───────── Online ─────────
const ONLINE_ERRORS: Record<string, string> = {
  invalid_code: "That code doesn't exist.", already_used: "That code was already used.", expired_code: "That code has expired (codes last 30 minutes).",
  not_allowed: "Not allowed.", too_soon: "This student redeemed with you in the last 15 minutes.", daily_merchant_limit: "This student reached today's limit with you.",
  below_min_spend: "The order is below the perk's minimum spend.", perk_unavailable: "That perk isn't running right now.", amount_required: "Enter the order amount.",
  invalid_ref: "That Perkly reference doesn't exist for your shop.", ref_expired: "That reference is older than 30 days.", duplicate_order: "That order was already reported.",
  invalid_amount: "Enter a valid amount.",
};

export async function confirmOnlineCode(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireMerchantArea("online");
  const amount = Number(str(fd, "amount"));
  const { data, error } = await supabase.rpc("confirm_online_code", { p_code: str(fd, "code"), p_amount: amount > 0 ? amount : null });
  if (error) return { error: error.message };
  const r = data as { ok: boolean; error?: string; discount_amount?: number; final_amount?: number; perk_title?: string; verification_code?: string };
  if (!r.ok) return { error: ONLINE_ERRORS[r.error ?? ""] ?? r.error };
  revalidatePath("/merchant/online");
  return { ok: `✓ ${r.perk_title}: discount ${r.discount_amount ?? 0} EGP → customer pays ${r.final_amount ?? "—"} EGP (receipt ${r.verification_code}).` };
}

export async function reportOnlineOrder(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, merchant } = await requireMerchantArea("online");
  const { data, error } = await supabase.rpc("report_online_order", {
    p_merchant_id: merchant.id, p_ref: str(fd, "ref"), p_order_ref: str(fd, "order_ref"), p_amount: Number(str(fd, "amount")),
  });
  if (error) return { error: error.message };
  const r = data as { ok: boolean; error?: string; cashback_amount?: number };
  if (!r.ok) return { error: ONLINE_ERRORS[r.error ?? ""] ?? r.error };
  revalidatePath("/merchant/online");
  return { ok: `Order reported. ${r.cashback_amount} EGP cashback is pending Perkly approval.` };
}

// ───────── Profile ─────────
export async function updateProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, merchant } = await manager();
  const name = str(fd, "name");
  if (!name) return { error: "Name is required." };
  const { error } = await supabase.from("merchants").update({
    name,
    description: str(fd, "description") || null,
    logo_url: str(fd, "logo_url") || null,
    cover_url: str(fd, "cover_url") || null,
    contact_name: str(fd, "contact_name") || null,
    contact_phone: str(fd, "contact_phone") || null,
    contact_email: str(fd, "contact_email") || null,
  }).eq("id", merchant.id);
  if (error) return { error: error.message };
  revalidatePath("/merchant", "layout");
  return { ok: "Profile saved." };
}

// ───────── Team ─────────
export async function inviteStaff(_: ActionState, fd: FormData): Promise<ActionState> {
  const { merchant, memberRole } = await requireMerchant();
  if (memberRole !== "owner") return { error: "Only the owner can add staff." };
  const email = str(fd, "email").toLowerCase();
  const role = str(fd, "member_role") as MemberRole;
  if (!email.includes("@")) return { error: "Enter a valid email." };
  if (!["manager", "branch_manager", "cashier"].includes(role)) return { error: "Pick a role." };
  const branchId = str(fd, "branch_id") || null;
  if (role === "branch_manager" && !branchId) return { error: "Pick the branch this manager runs." };
  return addMember(merchant.id, email, role, role === "branch_manager" ? branchId : null);
}

export async function removeStaff(fd: FormData) {
  const { merchant, memberRole, user } = await requireMerchant();
  const userId = str(fd, "user_id");
  if (memberRole !== "owner" || userId === user.id) return;
  await createAdminClient().from("merchant_members").delete().eq("merchant_id", merchant.id).eq("user_id", userId);
  revalidatePath("/merchant/team");
}
