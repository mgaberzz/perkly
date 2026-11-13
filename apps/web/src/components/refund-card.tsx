import type { ReactNode } from "react";
import { Badge } from "./ui";
import { Icon } from "./icons";
import { dateTime, egp } from "@/lib/format";
import { REFUND_REASON_LABEL, type RefundRow } from "@/lib/refunds";
import type { TFn } from "@/lib/i18n";

/** One refund request: what the student asked, the transaction it is about, and where the money stands. */
export function RefundCard({ r, t, showMerchant, children }: { r: RefundRow; t: TFn; showMerchant?: boolean; children?: ReactNode }) {
  const tx = r.redemption;
  const money =
    r.payout_status === "by_merchant" ? t("Give the student {amount} back at the cashier", { amount: egp(r.amount) })
      : r.payout_status === "due" ? t("Perkly returns {amount} to the student", { amount: egp(r.amount) })
      : r.payout_status === "paid" ? t("Perkly returned {amount} · ref {ref}", { amount: egp(r.amount), ref: r.payout_ref ?? "" })
      : r.paid_in_app ? t("Paid in the app: if approved, Perkly returns the money") : t("Paid at the cashier: if approved, the shop returns the money");
  return (
    <li className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-600"><Icon name="undo" size={20} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold">{egp(r.amount)}</span>
            <Badge>{t(REFUND_REASON_LABEL[r.reason] ?? r.reason)}</Badge>
            <Badge tone={r.status}>{t(r.status === "pending" ? "Pending" : r.status === "approved" ? "Approved" : "Rejected")}</Badge>
            {r.payout_status === "due" && <Badge tone="pending">{t("Refund due")}</Badge>}
            {r.payout_status === "paid" && <Badge tone="paid">{t("Refund paid")}</Badge>}
          </div>
          {r.note && <p className="mt-1 text-sm text-zinc-700">“{r.note}”</p>}
          <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs text-zinc-500 sm:grid-cols-2">
            <div>{t("Refund ID")}: <span className="font-mono text-zinc-700">{r.refund_code}</span> · {dateTime(r.created_at)}</div>
            <div>{t("Student")}: <span className="text-zinc-700">{r.student?.full_name ?? "—"}{r.student?.student_code ? ` · ${r.student.student_code}` : ""}</span></div>
            {showMerchant && r.merchant && <div>{t("Merchant")}: <span className="text-zinc-700">{r.merchant.name} · {r.merchant.merchant_code}</span></div>}
            {tx && <div>{t("Transaction")}: <span className="font-mono text-zinc-700">{tx.tx_code ?? "—"}</span> · {dateTime(tx.created_at)}</div>}
            {tx && <div>{t("Bill")}: <span className="text-zinc-700">{egp(tx.original_amount)} − {egp(tx.discount_amount)} = {egp(tx.final_amount)}</span></div>}
            {tx && <div>{tx.branch?.name ?? t("Online")}{tx.perk ? ` · ${tx.perk.title}` : ""}{tx.receipt_ref ? ` · ${t("Receipt")} ${tx.receipt_ref}` : ""}</div>}
          </dl>
          <p className="mt-2 text-xs font-medium text-zinc-600">{money}</p>
          {r.status !== "pending" && (
            <p className="mt-1 text-xs text-zinc-500">
              {t(r.status === "approved" ? "Approved" : "Rejected")} {t(r.decided_as === "perkly" ? "by the Perkly team" : "by the merchant")} · {dateTime(r.decided_at)}
              {r.decision_note && <> · “{r.decision_note}”</>}
            </p>
          )}
          {r.was_settled && r.status === "approved" && (
            <p className="mt-1 text-xs font-medium text-amber-700">
              {r.paid_in_app ? t("Already paid out in settlement {code}: the amount is taken off the merchant's next settlement automatically.", { code: tx?.settlement?.settlement_code ?? "" })
                : t("Commission was already charged in settlement {code}: it is credited back in the merchant's next settlement automatically.", { code: tx?.settlement?.settlement_code ?? "" })}
            </p>
          )}
        </div>
        {children && <div className="w-full shrink-0 lg:w-80">{children}</div>}
      </div>
    </li>
  );
}
