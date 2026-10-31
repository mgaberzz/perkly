"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { addMember } from "@/lib/members";
import { parsePerkForm } from "@/lib/perk-form";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState, MemberRole } from "@/lib/types";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// ───────── Merchants ─────────
function merchantRow(fd: FormData) {
  return {
    name: str(fd, "name"),
    category: str(fd, "category"),
    subcategory: str(fd, "subcategory") || null,
    brand_type: str(fd, "brand_type") || "local",
    description: str(fd, "description") || null,
    logo_url: str(fd, "logo_url") || null,
    contact_name: str(fd, "contact_name") || null,
    contact_phone: str(fd, "contact_phone") || null,
    contact_email: str(fd, "contact_email") || null,
    status: str(fd, "status") || "pending",
    plan: str(fd, "plan") || "free",
    commission_pct: Number(str(fd, "commission_pct") || 5),
  };
}

export async function createMerchant(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const row = merchantRow(fd);
  if (!row.name || !row.category) return { error: "Name and category are required." };
  const { data, error } = await supabase.from("merchants").insert(row).select("id").single();
  if (error) return { error: error.message };
  const owner = str(fd, "owner_email").toLowerCase();
  if (owner) {
    const res = await addMember(data.id, owner, "owner");
    if (res?.error) redirect(`/admin/merchants/${data.id}?invite_error=${encodeURIComponent(res.error)}`);
  }
  revalidatePath("/admin/merchants");
  redirect(`/admin/merchants/${data.id}`);
}

export async function updateMerchant(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const row = merchantRow(fd);
  if (!row.name || !row.category) return { error: "Name and category are required." };
  if (!(row.commission_pct >= 0 && row.commission_pct <= 100)) return { error: "Commission must be 0–100." };
  const { error } = await supabase.from("merchants").update(row).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/merchants", "layout");
  return { ok: "Merchant saved." };
}

export async function setMerchantStatus(fd: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("merchants").update({ status: str(fd, "status") }).eq("id", str(fd, "id"));
  revalidatePath("/admin/merchants", "layout");
}

export async function adminAddMember(merchantId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const email = str(fd, "email").toLowerCase();
  const role = str(fd, "member_role") as MemberRole;
  if (!email.includes("@")) return { error: "Enter a valid email." };
  if (!["owner", "manager", "cashier"].includes(role)) return { error: "Pick a role." };
  return addMember(merchantId, email, role);
}

export async function adminRemoveMember(fd: FormData) {
  const { supabase } = await requireAdmin();
  const merchantId = str(fd, "merchant_id");
  await supabase.from("merchant_members").delete().eq("merchant_id", merchantId).eq("user_id", str(fd, "user_id"));
  revalidatePath(`/admin/merchants/${merchantId}`);
}

export async function adminCreateBranch(merchantId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const name = str(fd, "name");
  if (!name) return { error: "Branch name is required." };
  const num = (k: string) => (str(fd, k) === "" ? null : Number(str(fd, k)));
  const { data, error } = await supabase.from("merchant_branches").insert({
    merchant_id: merchantId, name, address: str(fd, "address") || null, city: str(fd, "city") || null,
    campus_id: str(fd, "campus_id") || null, lat: num("lat"), lng: num("lng"),
  }).select("id").single();
  if (error) return { error: error.message };
  await supabase.from("branch_qr_codes").insert({ branch_id: data.id, label: "Cashier" });
  revalidatePath(`/admin/merchants/${merchantId}`);
  return { ok: "Branch added with a cashier QR." };
}

// ───────── Perks ─────────
export async function reviewPerk(fd: FormData) {
  const { supabase } = await requireAdmin();
  const decision = str(fd, "decision");
  const update = decision === "approve"
    ? { status: "active", review_note: null }
    : { status: "rejected", review_note: str(fd, "note") || "Not approved" };
  await supabase.from("perks").update(update).eq("id", str(fd, "id"));
  revalidatePath("/admin/perks", "layout");
  revalidatePath("/admin");
}

export async function adminUpdatePerk(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = parsePerkForm(fd);
  if ("error" in parsed) return parsed;
  const status = str(fd, "status");
  const row = { ...parsed.row, ...(status ? { status } : {}), priority_score: Number(str(fd, "priority_score") || 0) };
  const { error } = await supabase.from("perks").update(row).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/perks", "layout");
  return { ok: "Perk saved." };
}

// ───────── Redemptions ─────────
export async function setRedemptionStatus(fd: FormData) {
  const { supabase } = await requireAdmin();
  const status = str(fd, "status");
  if (!["success", "flagged", "reversed"].includes(status)) return;
  await supabase.from("redemptions").update({ status, flag_reason: status === "success" ? null : str(fd, "reason") || undefined }).eq("id", str(fd, "id"));
  revalidatePath("/admin/redemptions");
}

// ───────── Users ─────────
export async function setUserStatus(fd: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = str(fd, "id");
  if (id === user.id) return;
  await supabase.from("profiles").update({ status: str(fd, "status") }).eq("id", id);
  if (str(fd, "status") === "banned") await createAdminClient().auth.admin.signOut(id).catch(() => {});
  revalidatePath("/admin/users");
}

export async function setUserRole(fd: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = str(fd, "id");
  const role = str(fd, "role");
  if (id === user.id || !["student", "merchant", "admin"].includes(role)) return;
  await supabase.from("profiles").update({ role }).eq("id", id);
  revalidatePath("/admin/users");
}

// ───────── Campuses ─────────
export async function createCampus(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const name = str(fd, "name"), city = str(fd, "city");
  if (!name || !city) return { error: "Name and city are required." };
  const num = (k: string) => (str(fd, k) === "" ? null : Number(str(fd, k)));
  const { error } = await supabase.from("campuses").insert({
    name, city, short_name: str(fd, "short_name") || null, type: str(fd, "type") || "university", lat: num("lat"), lng: num("lng"),
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/campuses");
  return { ok: `${name} added.` };
}

export async function toggleCampus(fd: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("campuses").update({ is_active: str(fd, "active") === "true" }).eq("id", str(fd, "id"));
  revalidatePath("/admin/campuses");
}

// ───────── Quests ─────────
export async function createQuest(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const title = str(fd, "title");
  const target = Number(str(fd, "target")), xp = Number(str(fd, "xp_reward"));
  if (!title || !(target > 0) || !(xp > 0)) return { error: "Title, target and XP are required." };
  const { error } = await supabase.from("quests").insert({
    title, description: str(fd, "description") || null, emoji: str(fd, "emoji") || "🎯",
    quest_type: str(fd, "quest_type"), metric: str(fd, "metric"), target, xp_reward: xp,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/quests");
  return { ok: "Quest created." };
}

export async function toggleQuest(fd: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("quests").update({ is_active: str(fd, "active") === "true" }).eq("id", str(fd, "id"));
  revalidatePath("/admin/quests");
}
