import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { short } from "@/lib/format";
import { Amount, Stat } from "./ui";

type Summary = { transactions: number; gmv: number; paid: number; net_revenue: number; vat: number; merchant_net: number;
  paid_to_merchants: number; to_be_paid_to_merchants: number; owed_by_merchants: number; received_from_merchants: number };

/** Total volume, net revenue and dues — every card opens its details. */
export async function MoneySummary({ days = 30 }: { days?: number }) {
  const supabase = await createClient();
  const t = await getT();
  const { data } = await supabase.rpc("finance_summary", { p_days: days });
  const s = (data ?? {}) as Summary;
  const card = "block transition hover:-translate-y-0.5";
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Link className={card} href={`/admin/insights?days=${days}`}>
        <Stat accent label={t("Total volume (GMV)")} value={<Amount v={s.gmv} />} hint={t("{n} transactions · last {days} days", { n: short(s.transactions), days })} />
      </Link>
      <Link className={card} href={`/admin/insights?days=${days}`}>
        <Stat label={t("Net revenue")} value={<Amount v={s.net_revenue} />} hint={t("Perkly commission, excl. VAT {vat}", { vat: short(s.vat) })} />
      </Link>
      <Link className={card} href={`/admin/finance#settlements`}>
        <Stat label={t("Total paid to merchants")} value={<Amount v={s.paid_to_merchants} />} hint={t("All time")} />
      </Link>
      <Link className={card} href={`/admin/merchants?due=1`}>
        <Stat label={t("To be paid to merchants")} value={<Amount v={s.to_be_paid_to_merchants} />}
          hint={Number(s.owed_by_merchants) > 0 ? t("Merchants owe Perkly {amount}", { amount: `${short(s.owed_by_merchants)} EGP` }) : t("Open dues now")} />
      </Link>
    </div>
  );
}
