"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeFor } from "@/lib/auth";
import { SITE_URL } from "@/lib/env";
import type { ActionState } from "@/lib/types";

export async function signIn(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "Wrong email or password." };

  const { data: profile } = await supabase.from("profiles").select("role,status").eq("id", data.user.id).single();
  if (profile?.status === "banned") {
    await supabase.auth.signOut();
    return { error: "This account is restricted. Contact Perkly support." };
  }
  const home = await homeFor(profile?.role, data.user.id);
  if (home.startsWith("/login")) {
    await supabase.auth.signOut();
    return { error: "This account isn't linked to a merchant yet. Ask the Perkly team to add you." };
  }
  redirect(next.startsWith("/") && !next.startsWith("//") && next.startsWith(home) ? next : home);
}

export async function sendReset(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email first." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${SITE_URL}/auth/callback?next=/account/password` });
  return { ok: "If that email has an account, a reset link is on its way." };
}
