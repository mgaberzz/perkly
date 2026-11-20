import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMerchantArea } from "@/lib/auth";
import { PrintButton } from "@/components/print-button";
import { StatementView, type Statement } from "@/components/statement-view";
import { getLang, getT } from "@/lib/i18n/server";

export const metadata = { title: "Statement" };

export default async function StatementPage({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) notFound();
  const { supabase, merchant } = await requireMerchantArea("statements");
  const [t, lang] = [await getT(), await getLang()];
  const { data, error } = await supabase.rpc("merchant_statement", { p_merchant_id: merchant.id, p_month: `${month}-01` });
  if (error || !data) notFound();
  return (
    <>
      <div className="no-print mb-6 flex items-center justify-between gap-3">
        <Link href="/merchant/statements" className="text-sm font-semibold text-zinc-600 hover:text-perk-purple">← {t("All statements")}</Link>
        <PrintButton />
      </div>
      <StatementView s={data as Statement} t={t} lang={lang} />
    </>
  );
}
