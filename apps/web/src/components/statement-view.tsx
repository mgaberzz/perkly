import { Logo } from "@/components/logo";
import { egp } from "@/lib/format";
import type { Lang, TFn } from "@/lib/i18n";

export type Statement = {
  month: string; merchant: { name: string; code: string; commission_pct: number | null };
  transactions: number; students: number; new_students: number;
  bills: number; discounts: number; paid_by_students: number;
  in_app: { count: number; amount: number; commission: number }; cashier: { count: number; amount: number; commission: number };
  vat: number; net: number; reversed: { count: number; amount: number };
  by_branch: { branch: string; count: number; bills: number; discounts: number }[];
  settlements: { code: string; amount: number; paid: number; status: string; paid_at: string | null; reference: string | null }[];
};

export const monthLabel = (m: string, lang: Lang = "en") =>
  new Date(`${m}-15T12:00:00Z`).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", { month: "long", year: "numeric" });

/** Printable monthly statement (A4). Shared by the merchant portal and the Perkly team portal. */
export function StatementView({ s, t, lang }: { s: Statement; t: TFn; lang: Lang }) {
  const row = (label: string, value: string, strong = false) => (
    <tr className={strong ? "font-bold" : ""}><td className="py-2 pe-4 text-zinc-600">{label}</td><td className="py-2 text-end" dir="ltr">{value}</td></tr>
  );
  const owes = Number(s.net) < 0;
  return (
    <article className="mx-auto max-w-3xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm print:border-0 print:p-0 print:shadow-none">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-5">
        <div><Logo className="text-lg" /><div className="mt-1 text-xs text-zinc-500">perklyapp.co · support@perklyapp.co</div></div>
        <div className="text-end">
          <div className="text-xl font-extrabold">{t("Monthly statement")}</div>
          <div className="text-sm text-zinc-600">{monthLabel(s.month, lang)}</div>
        </div>
      </header>
      <section className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div><div className="text-xs uppercase text-zinc-500">{t("Business")}</div><div className="font-bold">{s.merchant.name}</div><div className="font-mono text-xs text-zinc-500">{s.merchant.code}</div></div>
        <div className="text-end"><div className="text-xs uppercase text-zinc-500">{t("Perkly commission")}</div><div className="font-bold">{s.merchant.commission_pct ?? 0}%</div></div>
      </section>
      <section className="mt-6 grid grid-cols-3 gap-3">
        {[[t("Transactions"), String(s.transactions)], [t("Students"), `${s.students} (${t("{n} new", { n: s.new_students })})`], [t("Discounts given"), egp(s.discounts)]].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-zinc-50 p-3"><div className="text-xs text-zinc-500">{k}</div><div className="text-lg font-extrabold" dir="auto">{v}</div></div>
        ))}
      </section>
      <h2 className="mt-7 font-bold">{t("Summary")}</h2>
      <table className="mt-2 w-full text-sm"><tbody className="divide-y divide-zinc-100">
        {row(t("Bills before discount"), egp(s.bills))}
        {row(t("Discounts given"), `− ${egp(s.discounts)}`)}
        {row(t("Paid by students"), egp(s.paid_by_students), true)}
        {row(t("Paid at your cashier ({n})", { n: s.cashier.count }), egp(s.cashier.amount))}
        {row(t("Paid in the Perkly app ({n})", { n: s.in_app.count }), egp(s.in_app.amount))}
        {row(t("Perkly commission on cashier sales"), `− ${egp(s.cashier.commission)}`)}
        {row(t("Perkly commission on in-app sales"), `− ${egp(s.in_app.commission)}`)}
        {Number(s.vat) > 0 && row(t("Incl. VAT"), egp(s.vat))}
        {row(owes ? t("Net: you owe Perkly") : t("Net: Perkly pays you"), egp(Math.abs(Number(s.net))), true)}
        {s.reversed.count > 0 && row(t("Reversed transactions (not counted)"), `${s.reversed.count} · ${egp(s.reversed.amount)}`)}
      </tbody></table>
      {s.by_branch.length > 0 && (<>
        <h2 className="mt-7 font-bold">{t("By branch")}</h2>
        <table className="mt-2 w-full text-sm">
          <thead><tr className="text-xs uppercase text-zinc-500"><th className="py-2 text-start">{t("Branch")}</th><th className="text-end">{t("Transactions")}</th><th className="text-end">{t("Bills")}</th><th className="text-end">{t("Discounts")}</th></tr></thead>
          <tbody className="divide-y divide-zinc-100">{s.by_branch.map((b) => (
            <tr key={b.branch}><td className="py-2">{b.branch}</td><td className="text-end">{b.count}</td><td className="text-end" dir="ltr">{egp(b.bills)}</td><td className="text-end" dir="ltr">{egp(b.discounts)}</td></tr>
          ))}</tbody>
        </table>
      </>)}
      <h2 className="mt-7 font-bold">{t("Payouts this month")}</h2>
      {s.settlements.length === 0 ? <p className="mt-2 text-sm text-zinc-500">{t("No payments between you and Perkly this month.")}</p> : (
        <table className="mt-2 w-full text-sm">
          <thead><tr className="text-xs uppercase text-zinc-500"><th className="py-2 text-start">{t("Settlement ID")}</th><th className="text-start">{t("Date")}</th><th className="text-start">{t("Bank reference")}</th><th className="text-end">{t("Paid")}</th></tr></thead>
          <tbody className="divide-y divide-zinc-100">{s.settlements.map((x) => (
            <tr key={x.code}><td className="py-2 font-mono">{x.code}</td><td>{x.paid_at ? new Date(x.paid_at).toLocaleDateString("en-GB") : "—"}</td><td className="font-mono text-xs">{x.reference ?? "—"}</td>
              <td className="text-end" dir="ltr">{egp(x.paid)}<div className="text-xs text-zinc-500">{Number(x.amount) >= 0 ? t("Perkly paid you") : t("You paid Perkly")}</div></td></tr>
          ))}</tbody>
        </table>
      )}
      <footer className="mt-8 border-t border-zinc-200 pt-4 text-xs text-zinc-500">
        {t("Times are Cairo time. Transactions are counted in the month they happened; payouts in the month they were paid. Questions: support@perklyapp.co")}
      </footer>
    </article>
  );
}

/** The last `n` months up to now, newest first, as "YYYY-MM" (Cairo). */
export function recentMonths(n: number, since?: string | null) {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" }));
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (since && m < since.slice(0, 7)) break;
    out.push(m);
  }
  return out;
}
