import { ExportMenu } from "./export-menu";
import { getT } from "@/lib/i18n/server";

/** One download (kept for existing pages): an Export dropdown with Excel / CSV. */
export async function ExportButtons({ kind, params = {}, label }: { kind: string; params?: Record<string, string | undefined>; label?: string }) {
  const t = await getT();
  const LABEL: Record<string, string> = { transactions: "Transactions", balances: "Merchant balances", settlements: "Settlements", partners: "Partner balances", partner_payouts: "Partner payments" };
  return <ExportMenu items={[{ label: label ?? t(LABEL[kind] ?? "Download"), kind, params }]} />;
}
