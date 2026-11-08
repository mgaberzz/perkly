"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { addMember, addPartnerMember } from "@/lib/members";
import { parsePerkForm } from "@/lib/perk-form";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/env";
import { BRAND_TYPES, STAFF_ROLES, type ActionState, type MemberRole } from "@/lib/types";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// ───────── Merchants ─────────
function merchantRow(fd: FormData) {
  return {
    name: str(fd, "name"),
    category: str(fd, "category"),
    subcategory: str(fd, "subcategory") || null,
    brand_type: (BRAND_TYPES as readonly string[]).includes(str(fd, "brand_type")) ? str(fd, "brand_type") : "local",
    channel: ["in_store", "online", "both"].includes(str(fd, "channel")) ? str(fd, "channel") : "in_store",
    website_url: str(fd, "website_url") || null,
    affiliate_url: str(fd, "affiliate_url") || null,
    description: str(fd, "description") || null,
    logo_url: str(fd, "logo_url") || null,
    contact_name: str(fd, "contact_name") || null,
    contact_phone: str(fd, "contact_phone") || null,
    contact_email: str(fd, "contact_email") || null,
    status: str(fd, "status") || "pending",
    plan: str(fd, "plan") || "free",
    commission_pct: Number(str(fd, "commission_pct") || 5),
    vat_enabled: fd.get("vat_enabled") === "on",
  };
}

export async function createMerchant(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff("merchants_create");
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
  const { supabase, can } = await requireStaff("merchants_edit");
  const full = merchantRow(fd);
  // Plan & commission are commercial terms: admin/operations only (the database enforces this too)
  const row: Partial<typeof full> = { ...full };
  if (!can("commercial_terms")) { delete row.plan; delete row.commission_pct; delete row.vat_enabled; }
  if (!row.name || !row.category) return { error: "Name and category are required." };
  if (!(full.commission_pct >= 0 && full.commission_pct <= 100)) return { error: "Commission must be 0–100." };
  const { error } = await supabase.from("merchants").update(row).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/merchants", "layout");
  return { ok: "Merchant saved." };
}

export async function setMerchantStatus(fd: FormData) {
  const { supabase } = await requireStaff("merchants_edit");
  await supabase.from("merchants").update({ status: str(fd, "status") }).eq("id", str(fd, "id"));
  revalidatePath("/admin/merchants", "layout");
}

export async function adminAddMember(merchantId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff("merchants_edit");
  // RLS: account managers only see (and so only manage) their assigned merchants
  const { data: visible } = await supabase.from("merchants").select("id").eq("id", merchantId).maybeSingle();
  if (!visible) return { error: "Not allowed." };
  const email = str(fd, "email").toLowerCase();
  const role = str(fd, "member_role") as MemberRole;
  const branchId = str(fd, "branch_id") || null;
  if (!email.includes("@")) return { error: "Enter a valid email." };
  if (!["owner", "manager", "branch_manager", "cashier"].includes(role)) return { error: "Pick a role." };
  if (role === "branch_manager" && !branchId) return { error: "Pick the branch this manager runs." };
  return addMember(merchantId, email, role, role === "branch_manager" ? branchId : null);
}

export async function adminRemoveMember(fd: FormData) {
  const { supabase } = await requireStaff("merchants_edit");
  const merchantId = str(fd, "merchant_id");
  await supabase.from("merchant_members").delete().eq("merchant_id", merchantId).eq("user_id", str(fd, "user_id"));
  revalidatePath(`/admin/merchants/${merchantId}`);
}

export async function adminCreateBranch(merchantId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff("merchants_edit");
  const name = str(fd, "name");
  if (!name) return { error: "Branch name is required." };
  const num = (k: string) => (str(fd, k) === "" ? null : Number(str(fd, k)));
  const { data, error } = await supabase.from("merchant_branches").insert({
    merchant_id: merchantId, name, address: str(fd, "address") || null, city: str(fd, "city") || null,
    campus_id: str(fd, "campus_id") || null, lat: num("lat"), lng: num("lng"),
  }).select("id").single();
  if (error) return { error: error.message };
  await supabase.from("branch_qr_codes").insert({ branch_id: data.id, label: "Cashier 1", cashier_name: str(fd, "cashier_name") || null });
  revalidatePath(`/admin/merchants/${merchantId}`);
  return { ok: "Branch added with a cashier QR." };
}

export async function adminCreateQr(fd: FormData) {
  const { supabase } = await requireStaff("merchants_edit");
  await supabase.from("branch_qr_codes").insert({
    branch_id: str(fd, "branch_id"), label: str(fd, "label") || "Cashier", cashier_name: str(fd, "cashier_name") || null, status: "approved",
  });
  revalidatePath(`/admin/merchants/${str(fd, "merchant_id")}`);
}

export async function adminToggleQr(fd: FormData) {
  const { supabase } = await requireStaff("merchants_edit");
  await supabase.from("branch_qr_codes").update({ is_active: str(fd, "active") === "true" }).eq("id", str(fd, "id"));
  revalidatePath(`/admin/merchants/${str(fd, "merchant_id")}`);
}

// ───────── Notification center ─────────
export async function resolveRequest(fd: FormData) {
  const { supabase } = await requireStaff("notifications");
  await supabase.rpc("resolve_request", { p_id: str(fd, "id"), p_approve: str(fd, "decision") === "approve", p_note: str(fd, "note") || null });
  revalidatePath("/admin", "layout");
}

// ───────── Student verification ─────────
export async function reviewVerification(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff("verifications");
  const approve = str(fd, "decision") === "approve";
  const reason = str(fd, "reason") === "other" ? str(fd, "other") : str(fd, "reason");
  if (!approve && !reason) return { error: "Choose or write a reason so the student knows what to fix." };
  const { data, error } = await supabase.rpc("review_student_verification", { p_id: str(fd, "id"), p_approve: approve, p_reason: reason || null });
  const res = data as { ok: boolean; error?: string } | null;
  if (error || !res?.ok) return { error: error?.message ?? (res?.error === "not_pending" ? "Someone already reviewed this one." : "Could not save.") };
  revalidatePath("/admin", "layout");
  return { ok: approve ? "Approved: the student is verified for 12 months." : "Rejected: the student can send a new photo." };
}

export async function setVerificationRules(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff("settings");
  const free = Math.floor(Number(str(fd, "free_redemptions") || 0));
  if (!(free >= 0 && free <= 20)) return { error: "Enter a number between 0 and 20." };
  const { data, error } = await supabase.rpc("set_verification_rules", { p_required: fd.get("required") === "on", p_free: free });
  if (error || !(data as { ok: boolean } | null)?.ok) return { error: error?.message ?? "Could not save." };
  revalidatePath("/admin/settings");
  return { ok: "Saved." };
}

// ───────── Push notifications ─────────
const BROADCAST_ERRORS: Record<string, string> = {
  missing_text: "Write a title and a message.",
  too_long: "Keep the title under 80 characters and the message under 240.",
  too_soon: "A notification was just sent. Wait 2 minutes before sending another.",
  not_allowed: "You don't have permission to send notifications.",
};
export async function sendBroadcast(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff("broadcasts");
  const { data, error } = await supabase.rpc("send_broadcast", {
    p_title: str(fd, "title"), p_body: str(fd, "body"), p_title_ar: str(fd, "title_ar") || null, p_body_ar: str(fd, "body_ar") || null,
    p_campus_id: str(fd, "campus_id") || null, p_perk_id: str(fd, "perk_id") || null,
  });
  const res = data as { ok: boolean; error?: string; recipients?: number } | null;
  if (error || !res?.ok) return { error: error?.message ?? BROADCAST_ERRORS[res?.error ?? ""] ?? "Could not send." };
  revalidatePath("/admin/broadcasts");
  return { ok: "Sent! Students get it within a few seconds; see the count under Sent." };
}

// ───────── Perks ─────────
export async function reviewPerk(fd: FormData) {
  const { supabase } = await requireStaff("perks");
  const decision = str(fd, "decision");
  const update = decision === "approve"
    ? { status: "active", review_note: null }
    : { status: "rejected", review_note: str(fd, "note") || "Not approved" };
  await supabase.from("perks").update(update).eq("id", str(fd, "id"));
  revalidatePath("/admin/perks", "layout");
  revalidatePath("/admin");
}

export async function adminUpdatePerk(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff("perks");
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
  const { supabase } = await requireStaff("redemptions_review");
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
  if (id === user.id || !["student", "merchant", ...STAFF_ROLES].includes(role)) return;
  await supabase.from("profiles").update({ role }).eq("id", id);
  revalidatePath("/admin/users");
  revalidatePath("/admin/team");
}

// ───────── Team: account manager assignments ─────────
export async function addAssignment(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const user_id = str(fd, "user_id"), merchant_id = str(fd, "merchant_id") || null, campus_id = str(fd, "campus_id") || null;
  if (!user_id || (!merchant_id && !campus_id)) return { error: "Pick a merchant or a campus." };
  const { error } = await supabase.from("staff_assignments").insert({ user_id, merchant_id, campus_id });
  if (error) return { error: error.code === "23505" ? "Already assigned." : error.message };
  revalidatePath("/admin/team");
  return { ok: "Assigned." };
}

export async function removeAssignment(fd: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("staff_assignments").delete().eq("id", str(fd, "id"));
  revalidatePath("/admin/team");
}

// ───────── Finance ─────────
export async function createSettlements(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff("finance");
  const { data, error } = await supabase.rpc("create_settlements", { p_until: str(fd, "until") || null, p_merchant_id: str(fd, "merchant_id") || null });
  if (error) return { error: error.message };
  const r = data as { ok: boolean; error?: string; settlements?: number; total?: number };
  if (!r.ok) return { error: r.error };
  revalidatePath("/admin/finance");
  return { ok: r.settlements ? `${r.settlements} settlement(s) created · ${r.total} EGP` : "Nothing due to settle." };
}

/** Finance approval: record a full or partial payment against a settlement. */
export async function markSettlementPaid(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff("finance");
  const raw = str(fd, "amount");
  const amount = raw === "" ? null : Number(raw);
  if (amount != null && !(amount > 0)) return { error: "Enter a valid amount." };
  const { data, error } = await supabase.rpc("record_settlement_payment", { p_id: str(fd, "id"), p_amount: amount, p_reference: str(fd, "reference") });
  if (error) return { error: error.message };
  const r = data as { ok: boolean; error?: string; status?: string; remaining?: number };
  if (!r.ok) {
    if (r.error === "reference_required") return { error: "Enter the bank transfer reference." };
    if (r.error === "more_than_remaining") return { error: `That's more than the remaining ${r.remaining} EGP.` };
    return { error: r.error };
  }
  revalidatePath("/admin/finance");
  return { ok: r.status === "paid" ? "Settled in full." : `Partially settled — ${r.remaining} EGP remaining.` };
}

/** Admin: platform VAT rate on Perkly commission (0 = no VAT). Recalculates unsettled transactions. */
export async function setVatRate(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff("settings");
  const pct = Number(str(fd, "vat_pct"));
  if (!(pct >= 0 && pct <= 100)) return { error: "Enter a rate between 0 and 100." };
  const { data, error } = await supabase.rpc("set_vat_rate", { p_pct: pct });
  if (error) return { error: error.message };
  const r = data as { ok: boolean; error?: string; recalculated?: number };
  if (!r.ok) return { error: r.error };
  revalidatePath("/admin", "layout");
  return { ok: pct === 0 ? "VAT switched off. Unsettled transactions recalculated." : `VAT set to ${pct}%. Unsettled transactions recalculated.` };
}

export async function setRedemptionRules(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff("settings");
  const n = Math.floor(Number(str(fd, "max_per_day")));
  if (!(n >= 1 && n <= 50)) return { error: "Enter a number between 1 and 50." };
  const { data: cur } = await supabase.from("app_settings").select("value").eq("key", "redemption_rules").maybeSingle<{ value: Record<string, unknown> }>();
  const { error } = await supabase.from("app_settings").update({ value: { ...(cur?.value ?? {}), max_per_merchant_per_day: n }, updated_at: new Date().toISOString() }).eq("key", "redemption_rules");
  if (error) return { error: error.message };
  revalidatePath("/admin/settings");
  return { ok: `Saved: ${n} per merchant per day.` };
}

export async function setPaymentsMode(fd: FormData) {
  const { supabase } = await requireStaff("settings");
  const mode = str(fd, "mode");
  if (!["off", "test", "live"].includes(mode)) return;
  await supabase.from("app_settings").update({ value: { mode, provider: str(fd, "provider") || null }, updated_at: new Date().toISOString() }).eq("key", "payments");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/finance");
}

// ───────── Campuses ─────────
export async function createCampus(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff("campuses_edit");
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
  const { supabase } = await requireStaff("campuses_edit");
  await supabase.from("campuses").update({ is_active: str(fd, "active") === "true" }).eq("id", str(fd, "id"));
  revalidatePath("/admin/campuses");
}

// ───────── Quests ─────────
export async function createQuest(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff("quests");
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
  const { supabase } = await requireStaff("quests");
  await supabase.from("quests").update({ is_active: str(fd, "active") === "true" }).eq("id", str(fd, "id"));
  revalidatePath("/admin/quests");
}

// ───────── Partners ─────────
function partnerRow(fd: FormData) {
  const cut_type = str(fd, "cut_type") === "fixed" ? "fixed" : "percentage";
  return {
    name: str(fd, "name"),
    contact_name: str(fd, "contact_name") || null,
    contact_phone: str(fd, "contact_phone") || null,
    contact_email: str(fd, "contact_email") || null,
    cut_type,
    cut_value: Number(str(fd, "cut_value") || 0),
    status: str(fd, "status") === "paused" ? "paused" : "active",
    notes: str(fd, "notes") || null,
  };
}
function checkDeal(row: ReturnType<typeof partnerRow>) {
  if (row.name.length < 2) return "Partner name is required.";
  if (!(row.cut_value >= 0)) return "The cut must be 0 or more.";
  if (row.cut_type === "percentage" && row.cut_value > 100) return "A percentage cut can't be more than 100%.";
  return null;
}

export async function createPartner(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await requireStaff("partners_manage");
  const row = partnerRow(fd);
  const bad = checkDeal(row);
  if (bad) return { error: bad };
  const { data, error } = await supabase.from("partners").insert({ ...row, created_by: user.id }).select("id").single();
  if (error) return { error: error.message };
  revalidatePath("/admin/partners");
  redirect(`/admin/partners/${data.id}`);
}

export async function updatePartner(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff("partners_manage");
  const row = partnerRow(fd);
  const bad = checkDeal(row);
  if (bad) return { error: bad };
  const { error } = await supabase.from("partners").update(row).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/partners", "layout");
  return { ok: "Saved. The new deal applies to new transactions." };
}

/** Link or unlink a merchant (partner_id empty = unlink) */
export async function setMerchantPartner(fd: FormData) {
  const { supabase } = await requireStaff("partners_manage");
  const merchantId = str(fd, "merchant_id");
  const partnerId = str(fd, "partner_id") || null;
  await supabase.from("merchants").update({ partner_id: partnerId }).eq("id", merchantId);
  revalidatePath("/admin/partners", "layout");
  revalidatePath(`/admin/merchants/${merchantId}`);
}

export async function recordPartnerPayout(partnerId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff("partner_payouts");
  const amount = str(fd, "amount");
  const { data, error } = await supabase.rpc("record_partner_payout", {
    p_partner_id: partnerId, p_amount: amount ? Number(amount) : null, p_reference: str(fd, "reference"), p_note: str(fd, "note") || null,
  });
  if (error) return { error: error.message };
  const r = data as { ok: boolean; error?: string; due?: number };
  if (!r.ok) return { error: r.error === "more_than_due" ? "That's more than the partner is owed." : r.error === "reference_required" ? "Add the bank reference." : r.error === "invalid_amount" ? "Nothing is owed to this partner." : "Not allowed." };
  revalidatePath("/admin/partners", "layout");
  return { ok: "Payment recorded." };
}

export async function adminAddPartnerUser(partnerId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("partners_manage");
  const email = str(fd, "email").toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email." };
  return addPartnerMember(partnerId, email);
}

export async function adminRemovePartnerUser(fd: FormData) {
  await requireStaff("partners_manage");
  const partnerId = str(fd, "partner_id");
  await createAdminClient().from("partner_members").delete().eq("partner_id", partnerId).eq("user_id", str(fd, "user_id"));
  revalidatePath(`/admin/partners/${partnerId}`);
}

/** Invite a Perkly team member (admin only). */
export async function inviteTeamMember(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const email = str(fd, "email").toLowerCase(), full_name = str(fd, "full_name"), role = str(fd, "role");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email." };
  if (!(STAFF_ROLES as readonly string[]).includes(role)) return { error: "Pick a role." };
  const admin = createAdminClient();
  const { data: existing } = await admin.from("profiles").select("id, role").ilike("email", email).maybeSingle();
  if (existing) {
    if (existing.role !== "student" && !(STAFF_ROLES as readonly string[]).includes(existing.role)) return { error: "This email already belongs to a merchant or partner account." };
    await admin.from("profiles").update({ role, ...(full_name ? { full_name } : {}) }).eq("id", existing.id);
    revalidatePath("/admin/users"); revalidatePath("/admin/team");
    return { ok: `${email} is now ${role.replace("_", " ")}.` };
  }
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name }, redirectTo: `${SITE_URL}/auth/callback?next=/account/password`,
  });
  if (error || !data.user) return { error: error?.message ?? "Couldn't send invite." };
  await admin.from("profiles").update({ role, full_name: full_name || null }).eq("id", data.user.id);
  revalidatePath("/admin/users"); revalidatePath("/admin/team");
  return { ok: `Invite sent to ${email}.` };
}
