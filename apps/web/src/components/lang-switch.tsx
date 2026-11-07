import { setLang } from "@/app/lang-actions";
import { getLang } from "@/lib/i18n/server";

/** Toggles English ⇄ العربية; remembered in a cookie. */
export async function LangSwitch({ className = "" }: { className?: string }) {
  const lang = await getLang();
  return (
    <form action={setLang} className={className}>
      <input type="hidden" name="lang" value={lang === "ar" ? "en" : "ar"} />
      <button className="w-full rounded-xl px-3 py-2 text-start text-sm font-semibold text-zinc-600 hover:bg-zinc-100">
        🌐 {lang === "ar" ? "English" : "العربية"}
      </button>
    </form>
  );
}
