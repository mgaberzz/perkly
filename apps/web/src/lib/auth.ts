import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STAFF_ROLES, type MemberRole, type Merchant, type Profile, type StaffRole } from "@/lib/types";

export const MERCHANT_COOKIE = "perkly_merchant";

export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null as Profile | null };
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  return { supabase, user, profile };
});

export const isStaffRole = (r: string | undefined): r is StaffRole => STAFF_ROLES.includes(r as StaffRole);

/**
 * What each Perkly team role may do in the staff portal. The database enforces the same rules (RLS + RPC checks);
 * this only decides what to show.
 */
export const PERMS = {
  overview: ["admin", "operations", "account_manager", "finance"],
  notifications: ["admin", "operations", "account_manager", "finance"],
  merchants_view: ["admin", "operations", "account_manager", "finance"],
  merchants_create: ["admin", "operations"],
  merchants_edit: ["admin", "operations", "account_manager"],
  commercial_terms: ["admin", "operations"],          // plan + commission
  perks: ["admin", "operations", "account_manager"],  // campaigns
  redemptions_view: ["admin", "operations", "account_manager", "finance"],
  redemptions_review: ["admin", "operations"],
  finance: ["admin", "finance"],
  campuses_view: ["admin", "operations", "account_manager"],
  campuses_edit: ["admin", "operations"],
  quests: ["admin", "operations"],
  users: ["admin"],
  settings: ["admin"],
} as const satisfies Record<string, readonly StaffRole[]>;
export type Perm = keyof typeof PERMS;
export const can = (role: StaffRole, perm: Perm) => (PERMS[perm] as readonly StaffRole[]).includes(role);

/** Signed-in Perkly team member; optionally require a permission. */
export async function requireStaff(perm: Perm = "overview") {
  const s = await getSession();
  if (!s.user) redirect("/login?next=/admin");
  const role = s.profile?.role;
  if (!isStaffRole(role) || s.profile?.status !== "active") redirect("/login?error=not_admin");
  if (!can(role, perm)) redirect("/admin?denied=1");
  // Account managers only ever see their assigned merchants (null = all merchants)
  let merchantScope: string[] | null = null;
  if (role === "account_manager") {
    const { data } = await s.supabase.rpc("staff_merchant_ids");
    merchantScope = ((data ?? []) as string[]);
  }
  return { ...s, user: s.user, profile: s.profile!, role, can: (p: Perm) => can(role, p), merchantScope };
}

/** Restrict a Supabase query to the team member's merchants (no-op for roles that see all). */
export function inScope<Q extends { in: (col: string, values: string[]) => Q }>(q: Q, scope: string[] | null, col = "merchant_id"): Q {
  return scope ? q.in(col, scope.length ? scope : ["00000000-0000-0000-0000-000000000000"]) : q;
}
/** Full administrators only. */
export const requireAdmin = () => requireStaff("users");

/**
 * Merchant portal areas per staff role:
 *   owner          everything (incl. team, bank account)
 *   manager        everything except adding staff and bank details
 *   branch_manager own branch only: dashboard, transactions, branch & cashier QR codes
 *   cashier        live transactions (and online code checks) only
 */
export const MERCHANT_AREAS = {
  dashboard: ["owner", "manager", "branch_manager"],
  transactions: ["owner", "manager", "branch_manager", "cashier"],
  online: ["owner", "manager", "cashier"],
  perks: ["owner", "manager"],
  branches: ["owner", "manager", "branch_manager"],
  payouts: ["owner", "manager"],
  team: ["owner", "manager"],
  profile: ["owner", "manager"],
} as const satisfies Record<string, readonly MemberRole[]>;
export type MerchantArea = keyof typeof MERCHANT_AREAS;
export const merchantCan = (role: MemberRole, area: MerchantArea) => (MERCHANT_AREAS[area] as readonly MemberRole[]).includes(role);

/** Merchant portal page guard: sends people to the first page their role can use. */
export async function requireMerchantArea(area: MerchantArea) {
  const ctx = await requireMerchant();
  if (!merchantCan(ctx.memberRole, area)) redirect(merchantCan(ctx.memberRole, "dashboard") ? "/merchant" : "/merchant/redemptions");
  return ctx;
}

export type Membership = { member_role: MemberRole; branch_id: string | null; merchant: Merchant; branch: { id: string; name: string } | null };

/** Signed-in user who belongs to at least one merchant. Picks the active merchant from a cookie. */
export const requireMerchant = cache(async () => {
  const s = await getSession();
  if (!s.user) redirect("/login?next=/merchant");
  const { data } = await s.supabase
    .from("merchant_members")
    .select("member_role, branch_id, merchant:merchants(*), branch:merchant_branches(id, name)")
    .eq("user_id", s.user.id)
    .returns<Membership[]>();
  const memberships = (data ?? []).filter((m) => m.merchant);
  if (memberships.length === 0) redirect("/login?error=no_merchant");

  const selectedId = (await cookies()).get(MERCHANT_COOKIE)?.value;
  const current = memberships.find((m) => m.merchant.id === selectedId) ?? memberships[0];
  const role = current.member_role;
  return {
    ...s,
    user: s.user,
    memberships,
    merchant: current.merchant,
    memberRole: role,
    /** owner + manager: perks, branches, profile */
    canManage: role === "owner" || role === "manager",
    /** owner + manager: money (payouts, bank account) */
    canSeeMoney: role === "owner" || role === "manager",
    /** Branch managers only see/act on their own branch */
    branchScope: role === "branch_manager" ? current.branch : null,
  };
});

export async function homeFor(profileRole: string | undefined, userId: string) {
  if (isStaffRole(profileRole)) return "/admin";
  const { supabase } = await getSession();
  const { count } = await supabase.from("merchant_members").select("*", { count: "exact", head: true }).eq("user_id", userId);
  return count ? "/merchant" : "/login?error=no_access";
}
