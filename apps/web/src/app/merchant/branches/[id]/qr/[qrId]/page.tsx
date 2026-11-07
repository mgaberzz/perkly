import { notFound } from "next/navigation";
import { requireMerchant } from "@/lib/auth";
import { QrImage } from "@/components/qr-image";
import { PrintButton } from "@/components/print-button";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "QR poster" };

export default async function QrPosterPage({ params }: PageProps<"/merchant/branches/[id]/qr/[qrId]">) {
  const { id, qrId } = await params;
  const { supabase, merchant, branchScope } = await requireMerchant();
  if (branchScope && branchScope.id !== id) notFound();
  const t = await getT();
  const { data: qr } = await supabase.from("branch_qr_codes")
    .select("code, label, cashier_name, branch:merchant_branches!inner(name, merchant_id)")
    .eq("id", qrId).eq("branch_id", id).eq("branch.merchant_id", merchant.id).eq("status", "approved")
    .maybeSingle<{ code: string; label: string; cashier_name: string | null; branch: { name: string; merchant_id: string } }>();
  if (!qr) notFound();
  return (
    <div className="flex flex-col items-center">
      <div className="no-print mb-6"><PrintButton /></div>
      <div className="perk-gradient w-[420px] rounded-[32px] p-8 text-center text-white shadow-xl print:shadow-none">
        <div className="text-2xl font-extrabold">Perkly</div>
        <div className="mt-1 text-sm text-white/85">{t("Students get instant discounts here 💜")}</div>
        <div className="mx-auto mt-6 w-fit rounded-3xl bg-white p-4"><QrImage value={qr.code} size={260} /></div>
        <div className="mt-6 text-3xl font-extrabold leading-tight">{t("Scan to save")}</div>
        <ol className="mx-auto mt-4 max-w-xs space-y-1 text-start text-sm text-white/90">
          <li>1. {t("Open Perkly → tap Scan")}</li>
          <li>2. {t("Scan this code & pick your perk")}</li>
          <li>3. {t("Show the green screen to the cashier")}</li>
        </ol>
        <div className="mt-6 text-xs text-white/70">{merchant.name} · {qr.branch.name} · {qr.cashier_name ?? qr.label} · {qr.code}</div>
      </div>
      <div className="no-print mt-8 max-w-md rounded-2xl border border-zinc-200 bg-white p-5 text-sm">
        <h2 className="mb-2 font-bold">{t("Cashier cheat sheet")}</h2>
        <ol className="list-decimal space-y-1 ps-5 text-zinc-600">
          <li>{t("Student scans this QR in the Perkly app.")}</li>
          <li>{t("Check their screen is green and the clock is ticking (screenshots don't move).")}</li>
          <li>{t("Match the 4-character code with the Transactions page if unsure.")}</li>
          <li>{t("Apply the discount shown on their screen. If it says “Paid in app”, don't charge again.")}</li>
        </ol>
      </div>
    </div>
  );
}
