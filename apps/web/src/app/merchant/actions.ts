"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MERCHANT_COOKIE, requireMerchant } from "@/lib/auth";
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
  // Every branch gets a cashier QR straight away
  await supabase.from("branch_qr_codes").insert({ branch_id: data.id, label: "Cashier" });
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

export async function createQr(fd: FormData) {
  const { supabase } = await manager();
  const branchId = str(fd, "branch_id");
  await supabase.from("branch_qr_codes").insert({ branch_id: branchId, label: str(fd, "label") || "Cashier" });
  revalidatePath(`/merchant/branches/${branchId}`);
}

export async function toggleQr(fd: FormData) {
  const { supabase } = await manager();
  await supabase.from("branch_qr_codes").update({ is_active: fd.get("active") === "true" }).eq("id", str(fd, "id"));
  revalidatePath(`/merchant/branches/${str(fd, "branch_id")}`);
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
  if (!["manager", "cashier"].includes(role)) return { error: "Pick a role." };
  return addMember(merchant.id, email, role);
}

export async function removeStaff(fd: FormData) {
  const { merchant, memberRole, user } = await requireMerchant();
  const userId = str(fd, "user_id");
  if (memberRole !== "owner" || userId === user.id) return;
  await createAdminClient().from("merchant_members").delete().eq("merchant_id", merchant.id).eq("user_id", userId);
  revalidatePath("/merchant/team");
}
