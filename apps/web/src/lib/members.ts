import "server-only";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/env";
import type { ActionState, MemberRole } from "@/lib/types";

// NOT a server action: callers must authorize first (merchant owner or admin).
/** Shared by merchant owners and admins: invite (or link existing) user to a merchant. */
export async function addMember(merchantId: string, email: string, role: MemberRole): Promise<ActionState> {
  const admin = createAdminClient();
  let { data: existing } = await admin.from("profiles").select("id, role").ilike("email", email).maybeSingle();
  let invited = false;
  if (!existing) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${SITE_URL}/auth/callback?next=/account/password`,
    });
    if (error || !data.user) return { error: error?.message ?? "Couldn't send invite." };
    existing = { id: data.user.id, role: "student" };
    invited = true;
  }
  if (existing.role === "student") await admin.from("profiles").update({ role: "merchant" }).eq("id", existing.id);
  const { error } = await admin.from("merchant_members")
    .upsert({ merchant_id: merchantId, user_id: existing.id, member_role: role }, { onConflict: "merchant_id,user_id" });
  if (error) return { error: error.message };
  revalidatePath("/merchant/team");
  revalidatePath(`/admin/merchants/${merchantId}`);
  return { ok: invited ? `Invite sent to ${email}.` : `${email} added as ${role}.` };
}
