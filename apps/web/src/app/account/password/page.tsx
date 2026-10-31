import { redirect } from "next/navigation";
import { getSession, homeFor } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

export const metadata = { title: "Set password" };

async function setPassword(_: ActionState, formData: FormData): Promise<ActionState> {
  "use server";
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (password.length < 8) return { error: "Use at least 8 characters." };
  if (password !== formData.get("confirm")) return { error: "Passwords don't match." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error || !data.user) return { error: error?.message ?? "Couldn't update password." };
  if (fullName) await supabase.from("profiles").update({ full_name: fullName }).eq("id", data.user.id);
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
  redirect(await homeFor(profile?.role, data.user.id));
}

export default async function PasswordPage() {
  const { user, profile } = await getSession();
  if (!user) redirect("/login");
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Logo className="mb-8 text-xl" />
        <h1 className="text-2xl font-extrabold">Set your password</h1>
        <p className="mb-6 mt-1 text-sm text-zinc-500">{user.email}</p>
        <ActionForm action={setPassword} className="space-y-4">
          <Field label="Your name"><Input name="full_name" defaultValue={profile?.full_name ?? ""} /></Field>
          <Field label="New password"><Input name="password" type="password" minLength={8} autoComplete="new-password" required /></Field>
          <Field label="Confirm password"><Input name="confirm" type="password" minLength={8} autoComplete="new-password" required /></Field>
          <SubmitButton className="w-full">Save & continue</SubmitButton>
        </ActionForm>
      </div>
    </main>
  );
}
