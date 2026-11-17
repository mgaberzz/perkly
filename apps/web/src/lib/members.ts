import "server-only";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/env";
import type { ActionState, MemberRole } from "@/lib/types";

/** Language the invite email is written in (English unless Arabic is chosen). */
export type InviteLang = "en" | "ar";
export const inviteLang = (v: string): InviteLang => (v === "ar" ? "ar" : "en");

// NOT a server action: callers must authorize first (merchant owner or admin).
/** Shared by merchant owners and admins: invite (or link existing) user to a merchant. */
export async function addMember(merchantId: string, email: string, role: MemberRole, branchId: string | null = null, lang: InviteLang = "en"): Promise<ActionState> {
  const admin = createAdminClient();
  let { data: existing } = await admin.from("profiles").select("id, role").ilike("email", email).maybeSingle();
  let invited = false;
  if (!existing) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { lang },
      redirectTo: `${SITE_URL}/auth/callback?next=/account/password`,
    });
    if (error || !data.user) return { error: error?.message ?? "Couldn't send invite." };
    existing = { id: data.user.id, role: "student" };
    invited = true;
  }
  if (existing.role === "student") await admin.from("profiles").update({ role: "merchant" }).eq("id", existing.id);
  const { error } = await admin.from("merchant_members")
    .upsert({ merchant_id: merchantId, user_id: existing.id, member_role: role, branch_id: branchId }, { onConflict: "merchant_id,user_id" });
  if (error) return { error: error.message };
  revalidatePath("/merchant/team");
  revalidatePath(`/admin/merchants/${merchantId}`);
  return { ok: invited ? `Invite sent to ${email}.` : `${email} added as ${role.replace("_", " ")}.` };
}

// NOT a server action: callers must authorize first (admin / operations).
/** Invite (or link an existing) user to a partner's portal. */
export async function addPartnerMember(partnerId: string, email: string, lang: InviteLang = "en"): Promise<ActionState> {
  const admin = createAdminClient();
  let { data: existing } = await admin.from("profiles").select("id, role").ilike("email", email).maybeSingle();
  let invited = false;
  if (!existing) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { lang },
      redirectTo: `${SITE_URL}/auth/callback?next=/account/password`,
    });
    if (error || !data.user) return { error: error?.message ?? "Couldn't send invite." };
    existing = { id: data.user.id, role: "student" };
    invited = true;
  }
  if (!["student", "partner"].includes(existing.role)) return { error: "This email already has another portal role. Use a different email for the partner." };
  if (existing.role === "student") await admin.from("profiles").update({ role: "partner" }).eq("id", existing.id);
  const { error } = await admin.from("partner_members").upsert({ partner_id: partnerId, user_id: existing.id }, { onConflict: "partner_id,user_id" });
  if (error) return { error: error.message };
  revalidatePath(`/admin/partners/${partnerId}`);
  return { ok: invited ? `Invite sent to ${email}.` : `${email} can now open the partner portal.` };
}

/** Sends the invite again to someone who hasn't signed in yet (old links stop working). */
export async function resendInvite(email: string): Promise<ActionState> {
  const admin = createAdminClient();
  let lang: InviteLang = "en";
  const { data: prof } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (prof) {
    const { data } = await admin.auth.admin.getUserById(prof.id);
    if (data.user?.last_sign_in_at) return { error: "This person has already signed in. Send a password reset instead." };
    lang = inviteLang(String(data.user?.user_metadata?.lang ?? ""));
  }
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { lang }, redirectTo: `${SITE_URL}/auth/callback?next=/account/password`,
  });
  if (error) return { error: error.message };
  return { ok: `New invite sent to ${email}. Any earlier invite link no longer works.` };
}

/** Emails a link to set a new password (for people who already have an account). */
export async function sendPasswordReset(email: string): Promise<ActionState> {
  const { error } = await createAdminClient().auth.resetPasswordForEmail(email, {
    redirectTo: `${SITE_URL}/auth/callback?next=/account/password`,
  });
  if (error) return { error: error.message };
  return { ok: `Password reset link sent to ${email}.` };
}
