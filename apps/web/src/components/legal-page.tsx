import Link from "next/link";
import { Logo } from "@/components/logo";
import { getLang } from "@/lib/i18n/server";
import { LEGAL, legalDoc } from "@/lib/legal";

// Public page for the Privacy Policy and Terms of Use. ?lang=ar|en overrides the
// language cookie, so the app can open the page in the student's language.
export async function LegalPage({ kind, searchParams }: { kind: "privacy" | "terms"; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const lang = sp.lang === "ar" || sp.lang === "en" ? sp.lang : await getLang();
  const ar = lang === "ar";
  const doc = legalDoc(kind, lang);
  const other = legalDoc(kind === "privacy" ? "terms" : "privacy", lang);
  const date = new Date(LEGAL.updated).toLocaleDateString(ar ? "ar-EG" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
  return (
    <main dir={ar ? "rtl" : "ltr"} lang={lang} className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/"><Logo className="text-lg" /></Link>
          <Link href={`/${kind}?lang=${ar ? "en" : "ar"}`} className="text-sm font-semibold text-perk-purple hover:underline">{ar ? "English" : "العربية"}</Link>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <h1 className="text-3xl font-extrabold">{doc.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{ar ? "آخر تحديث:" : "Last updated:"} {date}</p>
        <p className="mt-6 leading-7 text-zinc-700">{doc.intro}</p>
        {doc.sections.map((s) => (
          <section key={s.h} className="mt-8">
            <h2 className="text-lg font-bold">{s.h}</h2>
            {s.p?.map((p) => <p key={p} className="mt-2 leading-7 text-zinc-700">{p}</p>)}
            {s.list && (
              <ul className="mt-2 list-disc space-y-2 ps-5 leading-7 text-zinc-700 marker:text-perk-purple">
                {s.list.map((li) => <li key={li}>{li}</li>)}
              </ul>
            )}
          </section>
        ))}
        <footer className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-zinc-200 pt-6 text-sm">
          <Link href={`/${kind === "privacy" ? "terms" : "privacy"}?lang=${lang}`} className="font-semibold text-perk-purple hover:underline">{other.title}</Link>
          <a href={`mailto:${LEGAL.email}`} className="text-zinc-500 hover:underline">{LEGAL.email}</a>
          <span className="text-zinc-400">© {LEGAL.company}</span>
        </footer>
      </article>
    </main>
  );
}
