import { Logo } from "@/components/logo";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input, Notice } from "@/components/ui";
import { sendReset, signIn } from "./actions";

export const metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  not_admin: "That page is for the Perkly team only.",
  no_merchant: "Your account isn't linked to a merchant yet.",
  no_access: "Your account doesn't have portal access.",
  auth: "That sign-in link is invalid or expired.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";
  const error = typeof sp.error === "string" ? ERRORS[sp.error] : undefined;
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="perk-gradient hidden flex-col justify-between p-12 text-white lg:flex">
        <Logo className="text-xl [&>span:first-child]:bg-white [&>span:first-child]:text-perk-purple" />
        <div>
          <h1 className="text-4xl font-extrabold leading-tight">More students.<br />Zero ad spend.</h1>
          <p className="mt-4 max-w-sm text-white/85">Manage perks, print your cashier QR, and watch redemptions come in live.</p>
        </div>
        <p className="text-sm text-white/70">© Perkly</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Logo className="mb-8 text-xl lg:hidden" />
          <h2 className="text-2xl font-extrabold">Welcome back 👋</h2>
          <p className="mb-6 mt-1 text-sm text-zinc-500">Sign in to the merchant or admin portal.</p>
          {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
          <ActionForm action={signIn} className="space-y-4">
            <input type="hidden" name="next" value={next} />
            <Field label="Email"><Input name="email" type="email" autoComplete="email" required /></Field>
            <Field label="Password"><Input name="password" type="password" autoComplete="current-password" required /></Field>
            <SubmitButton className="w-full">Sign in</SubmitButton>
          </ActionForm>
          <details className="mt-6 text-sm">
            <summary className="cursor-pointer text-zinc-500 hover:text-perk-purple">Forgot your password?</summary>
            <ActionForm action={sendReset} className="mt-3 space-y-3">
              <Input name="email" type="email" placeholder="you@business.com" required />
              <SubmitButton variant="secondary" className="w-full">Send reset link</SubmitButton>
            </ActionForm>
          </details>
        </div>
      </div>
    </main>
  );
}
