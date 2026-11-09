import Link from "next/link";
import { Logo } from "@/components/logo";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { LangSwitch } from "@/components/lang-switch";
import { Icon } from "@/components/icons";
import { getT } from "@/lib/i18n/server";
import { CHANNEL_LABEL } from "@/lib/labels";
import { CATEGORIES } from "@/lib/types";
import { submitApplication } from "./actions";

export const metadata = { title: "Join Perkly" };

export default async function ApplyPage({ searchParams }: PageProps<"/apply">) {
  const sp = await searchParams;
  const t = await getT();
  const sent = sp.sent === "1";
  const started = startedAt();
  const perks = [
    { icon: "users", text: t("Reach thousands of verified university students near you") },
    { icon: "wallet", text: t("Free to join. Pay a small commission only when a student buys") },
    { icon: "qr", text: t("A QR code at your cashier, no new device needed") },
    { icon: "chart", text: t("See every sale live in your own portal") },
  ];
  return (
    <main className="grid min-h-screen lg:grid-cols-[2fr_3fr]">
      <div className="perk-gradient hidden flex-col justify-between p-12 text-white lg:flex">
        <Link href="/"><Logo className="text-xl [&>span:first-child]:bg-white [&>span:first-child]:text-perk-purple" /></Link>
        <div>
          <h1 className="text-4xl font-extrabold leading-tight">{t("More students.")}<br />{t("Zero ad spend.")}</h1>
          <ul className="mt-8 space-y-4">
            {perks.map((p) => (
              <li key={p.icon} className="flex items-start gap-3 text-white/90">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15"><Icon name={p.icon} size={18} /></span>
                <span className="pt-1.5">{p.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/70">© Perkly</p>
      </div>
      <div className="flex justify-center p-6 lg:items-center">
        <div className="w-full max-w-xl">
          <div className="mb-8 flex items-center justify-between"><Link href="/"><Logo className="text-xl lg:invisible" /></Link><LangSwitch /></div>
          {sent ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600"><Icon name="check" size={28} /></div>
              <h2 className="mt-4 text-2xl font-extrabold">{t("Application sent!")}</h2>
              <p className="mt-2 text-sm text-zinc-500">{t("Thanks for applying. Our team will review it and call you within 2 working days. Once approved, you'll get an email to set up your merchant portal.")}</p>
              <Link href="/" className="mt-6 inline-block text-sm font-semibold text-perk-purple hover:underline">{t("Back to Perkly")}</Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-extrabold">{t("Join Perkly as a merchant")}</h2>
              <p className="mb-6 mt-1 text-sm text-zinc-500">{t("Tell us about your business. It takes 2 minutes, and our team will contact you.")}</p>
              <ul className="mb-6 space-y-2 text-sm text-zinc-600 lg:hidden">
                {perks.map((p) => <li key={p.icon} className="flex gap-2"><Icon name={p.icon} size={16} className="mt-0.5 shrink-0 text-perk-purple" />{p.text}</li>)}
              </ul>
              <ActionForm action={submitApplication} className="space-y-6">
                <input type="hidden" name="started" value={started} />
                <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                  <label>Fax<input name="company_fax" tabIndex={-1} autoComplete="off" /></label>
                </div>
                <section className="grid gap-4 sm:grid-cols-2">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-400 sm:col-span-2">{t("Your business")}</h3>
                  <Field label={t("Business name")} className="sm:col-span-2"><Input name="business_name" required minLength={2} maxLength={120} /></Field>
                  <Field label={t("Category")}>
                    <Select name="category" defaultValue="Food">{CATEGORIES.map((c) => <option key={c} value={c}>{t(c)}</option>)}</Select>
                  </Field>
                  <Field label={t("Sells")}>
                    <Select name="channel" defaultValue="in_store">{Object.entries(CHANNEL_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</Select>
                  </Field>
                  <Field label={t("Number of branches")}><Input name="branches" type="number" min={1} max={500} defaultValue={1} /></Field>
                  <Field label={t("Area / city")}><Input name="area" maxLength={120} placeholder={t("e.g. Dokki, Giza")} /></Field>
                  <Field label={t("Main branch address")} className="sm:col-span-2"><Input name="address" maxLength={300} /></Field>
                  <Field label={t("Website")}><Input name="website_url" maxLength={300} placeholder="https://" /></Field>
                  <Field label={t("Instagram or Facebook page")}><Input name="social_url" maxLength={300} placeholder="instagram.com/…" /></Field>
                </section>
                <section className="grid gap-4 sm:grid-cols-2">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-400 sm:col-span-2">{t("Contact person")}</h3>
                  <Field label={t("Your name")}><Input name="contact_name" required minLength={2} maxLength={120} autoComplete="name" /></Field>
                  <Field label={t("Mobile number")}><Input name="contact_phone" type="tel" required maxLength={30} autoComplete="tel" placeholder="01x xxxx xxxx" /></Field>
                  <Field label={t("Email")} hint={t("Your merchant portal invite will be sent here")} className="sm:col-span-2">
                    <Input name="contact_email" type="email" required maxLength={200} autoComplete="email" placeholder="you@business.com" />
                  </Field>
                </section>
                <section className="grid gap-4">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-400">{t("Your student offer")}</h3>
                  <Field label={t("What discount would you offer students?")} hint={t("Optional. We can help you choose.")}>
                    <Input name="student_offer" maxLength={500} placeholder={t("e.g. 15% off all drinks")} />
                  </Field>
                  <Field label={t("Anything else we should know?")}><Textarea name="message" maxLength={1000} /></Field>
                </section>
                <label className="flex items-start gap-3 text-sm text-zinc-600">
                  <input type="checkbox" name="agree" required className="mt-0.5 h-4 w-4 accent-perk-purple" />
                  <span>{t("I agree to the")} <Link href="/terms" target="_blank" className="font-semibold text-perk-purple hover:underline">{t("Terms of Use")}</Link> {t("and the")} <Link href="/privacy" target="_blank" className="font-semibold text-perk-purple hover:underline">{t("Privacy Policy")}</Link></span>
                </label>
                <SubmitButton className="w-full py-3">{t("Send application")}</SubmitButton>
              </ActionForm>
              <p className="mt-6 text-center text-sm text-zinc-500">{t("Already a Perkly merchant?")} <Link href="/login" className="font-semibold text-perk-purple hover:underline">{t("Sign in")}</Link></p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

/** When the form was shown: the server rejects submissions faster than a person could type. */
function startedAt() { return Date.now(); }
