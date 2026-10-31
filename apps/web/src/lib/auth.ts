import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole, Merchant, Profile } from "@/lib/types";

export const MERCHANT_COOKIE = "perkly_merchant";

export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null as Profile | null };
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  return { supabase, user, profile };
});

export async function requireAdmin() {
  const s = await getSession();
  if (!s.user) redirect("/login?next=/admin");
  if (s.profile?.role !== "admin" || s.profile.status !== "active") redirect("/login?error=not_admin");
  return { ...s, profile: s.profile };
}

export type Membership = { member_role: MemberRole; merchant: Merchant };

/** Signed-in user who belongs to at least one merchant. Picks the active merchant from a cookie. */
export const requireMerchant = cache(async () => {
  const s = await getSession();
  if (!s.user) redirect("/login?next=/merchant");
  const { data } = await s.supabase
    .from("merchant_members")
    .select("member_role, merchant:merchants(*)")
    .eq("user_id", s.user.id)
    .returns<Membership[]>();
  const memberships = (data ?? []).filter((m) => m.merchant);
  if (memberships.length === 0) redirect("/login?error=no_merchant");

  const selectedId = (await cookies()).get(MERCHANT_COOKIE)?.value;
  const current = memberships.find((m) => m.merchant.id === selectedId) ?? memberships[0];
  return {
    ...s,
    user: s.user,
    memberships,
    merchant: current.merchant,
    memberRole: current.member_role,
    canManage: current.member_role === "owner" || current.member_role === "manager",
  };
});

export async function homeFor(profileRole: string | undefined, userId: string) {
  if (profileRole === "admin") return "/admin";
  const { supabase } = await getSession();
  const { count } = await supabase.from("merchant_members").select("*", { count: "exact", head: true }).eq("user_id", userId);
  return count ? "/merchant" : "/login?error=no_access";
}
