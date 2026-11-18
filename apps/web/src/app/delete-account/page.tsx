import Link from "next/link";
import { Logo } from "@/components/logo";
import { getLang } from "@/lib/i18n/server";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Delete your account" };

// Public page required by Google Play: how to delete a Perkly account, with or without the app.
const TEXT = {
  en: {
    title: "Delete your Perkly account",
    intro: "You can delete your Perkly student account at any time. This page explains how, and what happens to your data.",
    inApp: "In the app (fastest)",
    steps: ["Open the Perkly app and sign in.", "Go to Me, then tap Settings (the gear icon).", "Tap Delete Account at the bottom, then confirm."],
    inAppNote: "Your account is deleted straight away.",
    noApp: "Without the app",
    noAppText: (email: string) => `Email ${email} from the email address or phone number on your account, with the subject "Delete my account". Add your User ID if you know it. We delete the account within 30 days and reply to confirm.`,
    deleted: "What we delete",
    deletedList: ["Your name, email, phone number and date of birth", "Your profile photo and avatar", "Your student ID photo and student number", "Your notifications, saved shops and notification settings on your phones", "Your sign-in, so the account can't be used again"],
    kept: "What we keep, and for how long",
    keptText: "Records of the discounts and payments you made (date, shop, amount, transaction ID, and your campus for anonymous statistics) are kept for as long as tax and accounting law requires, usually up to 5 years, so merchants' and Perkly's accounts stay correct. They are no longer linked to your name, email or phone. Ratings you left stay anonymous.",
    privacy: "Privacy Policy", other: "العربية",
  },
  ar: {
    title: "حذف حسابك على Perkly",
    intro: "تقدر تحذف حسابك كطالب على Perkly في أي وقت. الصفحة دي بتوضح إزاي، وإيه اللي بيحصل لبياناتك.",
    inApp: "من التطبيق (الأسرع)",
    steps: ["افتح تطبيق Perkly وسجّل دخولك.", "روح على «أنا» واضغط الإعدادات (علامة الترس).", "اضغط «حذف الحساب» تحت خالص، وبعدين أكّد."],
    inAppNote: "حسابك بيتحذف على طول.",
    noApp: "من غير التطبيق",
    noAppText: (email: string) => `ابعت إيميل على ${email} من الإيميل أو رقم الموبايل المسجّل في حسابك، وخلّي العنوان «احذف حسابي». ولو تعرف رقم المستخدم (User ID) اكتبه. بنحذف الحساب خلال 30 يوم ونرد عليك نأكّد.`,
    deleted: "إيه اللي بنحذفه",
    deletedList: ["اسمك وإيميلك ورقم موبايلك وتاريخ ميلادك", "صورتك والأفاتار", "صورة كارنيه الطالب ورقم الطالب", "الإشعارات والمحلات المحفوظة وإعدادات الإشعارات على موبايلاتك", "بيانات الدخول، فالحساب مايتستخدمش تاني"],
    kept: "إيه اللي بنحتفظ بيه، ولمدة قد إيه",
    keptText: "سجلات الخصومات والمدفوعات اللي عملتها (التاريخ والمحل والمبلغ ورقم المعاملة، وجامعتك للإحصائيات من غير أسماء) بنحتفظ بيها طول المدة اللي يطلبها قانون الضرائب والمحاسبة، وعادة لحد 5 سنين، علشان حسابات التجار وPerkly تفضل مظبوطة. السجلات دي مش بتبقى مربوطة باسمك أو إيميلك أو رقمك. والتقييمات اللي سبتها بتفضل من غير اسم.",
    privacy: "سياسة الخصوصية", other: "English",
  },
};

export default async function DeleteAccountPage({ searchParams }: PageProps<"/delete-account">) {
  const sp = await searchParams;
  const lang = sp.lang === "ar" || sp.lang === "en" ? sp.lang : await getLang();
  const ar = lang === "ar";
  const x = TEXT[ar ? "ar" : "en"];
  const h2 = "mt-8 text-lg font-bold";
  const p = "mt-2 leading-7 text-zinc-700";
  return (
    <main dir={ar ? "rtl" : "ltr"} lang={lang} className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/"><Logo className="text-lg" /></Link>
          <Link href={`/delete-account?lang=${ar ? "en" : "ar"}`} className="text-sm font-semibold text-perk-purple hover:underline">{x.other}</Link>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <h1 className="text-3xl font-extrabold">{x.title}</h1>
        <p className="mt-6 leading-7 text-zinc-700">{x.intro}</p>
        <h2 className={h2}>{x.inApp}</h2>
        <ol className="mt-2 list-decimal space-y-2 ps-5 leading-7 text-zinc-700 marker:font-bold marker:text-perk-purple">
          {x.steps.map((s) => <li key={s}>{s}</li>)}
        </ol>
        <p className={p}>{x.inAppNote}</p>
        <h2 className={h2}>{x.noApp}</h2>
        <p className={p}>{x.noAppText(LEGAL.email)}</p>
        <p className="mt-3"><a href={`mailto:${LEGAL.email}?subject=${encodeURIComponent(ar ? "احذف حسابي" : "Delete my account")}`} className="inline-block rounded-xl bg-perk-purple px-4 py-2 text-sm font-semibold text-white hover:opacity-90">{LEGAL.email}</a></p>
        <h2 className={h2}>{x.deleted}</h2>
        <ul className="mt-2 list-disc space-y-2 ps-5 leading-7 text-zinc-700 marker:text-perk-purple">
          {x.deletedList.map((s) => <li key={s}>{s}</li>)}
        </ul>
        <h2 className={h2}>{x.kept}</h2>
        <p className={p}>{x.keptText}</p>
        <footer className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-zinc-200 pt-6 text-sm">
          <Link href={`/privacy?lang=${lang}`} className="font-semibold text-perk-purple hover:underline">{x.privacy}</Link>
          <a href={`mailto:${LEGAL.email}`} className="text-zinc-500 hover:underline">{LEGAL.email}</a>
        </footer>
      </article>
    </main>
  );
}
