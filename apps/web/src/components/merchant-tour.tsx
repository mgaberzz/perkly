"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Icon } from "./icons";
import { useT } from "./i18n";

const KEY = "perkly.merchantTour.v1";
const OPEN = "perkly:open-tour";
const read = () => { try { return localStorage.getItem(KEY); } catch { return "seen"; } };
const done = () => { try { localStorage.setItem(KEY, "seen"); } catch {} };

const STEPS = [
  { icon: "home", tag: "Dashboard", href: "/merchant", title: "Your numbers at a glance", body: ["Redemptions, students and revenue for any period", "Compare with the period before", "Tap any number to see the transactions behind it"] },
  { icon: "receipt", tag: "Transactions", href: "/merchant/redemptions", title: "Check every student at the cashier", body: ["New redemptions appear live", "Match the 4-character code on the student's screen", "\"Paid in app\" means the student already paid"] },
  { icon: "gift", tag: "Perks", href: "/merchant/perks", title: "Create your offers", body: ["Set the discount, minimum spend and days", "Perkly approves every new perk and discount change", "Students see it in the app once it's live"] },
  { icon: "qr", tag: "Branches & QR", href: "/merchant/branches", title: "Put your QR on the cashier table", body: ["Print a QR poster for each cashier", "Add branches and request more cashier QRs", "A lost QR can be replaced in seconds"] },
  { icon: "settings", tag: "Settings", href: "/merchant/settings", title: "Take full control", body: ["Monthly statements to print or save as PDF", "Your team, bank details and payouts", "API keys to connect your cashier system"] },
];

/** First-visit guided tour of the merchant portal (welcome card + 5 steps). */
export function MerchantTour() {
  const t = useT();
  const router = useRouter();
  const [step, setStep] = useState<number | null>(null); // -1 = welcome card
  useEffect(() => {
    // first visit: open shortly after the page shows
    const first = setTimeout(() => { if (!read()) setStep(-1); }, 600);
    const open = () => setStep(-1);
    window.addEventListener(OPEN, open);
    return () => { clearTimeout(first); window.removeEventListener(OPEN, open); };
  }, []);
  if (step === null) return null;
  const close = () => { done(); setStep(null); };
  const btn = "rounded-xl px-5 py-2.5 text-sm font-semibold";
  return (
    <div className="no-print fixed inset-0 z-50 grid place-items-center bg-zinc-900/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      {step === -1 ? (
        <div className="grid w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl md:grid-cols-2">
          <div className="perk-gradient hidden flex-col items-center justify-center gap-4 p-10 text-center text-white md:flex">
            <Image src="/perkly-mark.png" alt="" width={96} height={96} className="rounded-3xl shadow-xl ring-4 ring-white/30" />
            <div className="text-lg font-extrabold">{t("Let us show you around!")}</div>
            <div className="text-sm opacity-90">{t("This only takes a minute")}</div>
          </div>
          <div className="p-8">
            <h2 className="text-2xl font-extrabold">{t("Welcome to Perkly")} 👋</h2>
            <p className="mt-2 text-sm text-zinc-500">{t("Everything you need to welcome students, track every discount and get paid, in one place.")}</p>
            <ul className="mt-6 space-y-4">
              {[["receipt", t("Live transactions"), t("See every redemption the moment it happens")], ["chart", t("Insights"), t("Track students, revenue and busy hours")], ["wallet", t("Payouts & statements"), t("Know what you're owed and when")]].map(([i, a, b]) => (
                <li key={a} className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-perk-purple/10 text-perk-purple"><Icon name={i} size={18} /></span>
                  <span><span className="block font-bold">{a}</span><span className="text-sm text-zinc-500">{b}</span></span>
                </li>
              ))}
            </ul>
            <button onClick={() => setStep(0)} className={`perk-gradient mt-8 w-full text-white ${btn}`}>{t("Let's get started")}</button>
            <button onClick={close} className={`mt-2 w-full text-zinc-600 hover:text-zinc-900 ${btn}`}>{t("I'll explore on my own")}</button>
          </div>
        </div>
      ) : (
        <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
          <button onClick={close} aria-label={t("Close")} className="absolute end-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white shadow"><Icon name="x" size={16} /></button>
          <div className="grid h-40 place-items-center bg-gradient-to-b from-perk-purple/10 to-white">
            <span className="grid h-20 w-20 rotate-[-6deg] place-items-center rounded-3xl bg-white text-perk-purple shadow-lg"><Icon name={STEPS[step].icon} size={36} /></span>
          </div>
          <div className="p-7">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="perk-gradient grid h-10 w-10 place-items-center rounded-xl font-extrabold text-white">{step + 1}</span>
                <span className="font-bold">{t("Step {n} of {total}", { n: step + 1, total: STEPS.length })}</span>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">{t(STEPS[step].tag)}</span>
            </div>
            <h3 className="mt-5 text-2xl font-extrabold">{t(STEPS[step].title)}</h3>
            <ul className="mt-3 list-disc space-y-1.5 ps-5 text-sm text-zinc-600">{STEPS[step].body.map((b) => <li key={b}>{t(b)}</li>)}</ul>
            <button onClick={() => { router.push(STEPS[step].href); }} className="mt-4 text-sm font-semibold text-perk-purple hover:underline">{t("Open {page}", { page: t(STEPS[step].tag) })} →</button>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setStep(step - 1)} className={`border border-zinc-300 ${btn}`}>‹ {t("Back")}</button>
              <button onClick={() => (step === STEPS.length - 1 ? close() : setStep(step + 1))} className={`perk-gradient flex-1 text-white ${btn}`}>
                {step === STEPS.length - 1 ? t("Done") : `${t("Next")} ›`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Settings hub card that replays the tour. */
export function TourButton() {
  const t = useT();
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN))}
      className="flex items-start gap-4 rounded-2xl border border-zinc-200 bg-white p-5 text-start shadow-sm transition hover:border-perk-purple/40 hover:shadow">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-perk-purple/10 text-perk-purple"><Icon name="compass" size={20} /></span>
      <span><span className="block font-bold">{t("Take the tour")}</span><span className="mt-1 block text-sm text-zinc-500">{t("A one-minute walk through the merchant portal.")}</span></span>
    </button>
  );
}
