/**
 * Transaction filters shared by the Transactions page and the Excel/CSV export, including the drill-downs
 * from Insights (sector, location, campus, age range, merchant).
 */
export type TxFilters = {
  status?: string; channel?: string; payment?: string; from?: string; to?: string;
  merchant?: string; category?: string; city?: string; campus?: string; age?: string;
  /** "1" = not yet in a settlement (and not reversed) */ unsettled?: string; settlement?: string;
  /** search: transaction ID (9…, 10 digits), 4-char code or shop receipt / order no. */ q?: string;
  /** "any" or a partner id: only transactions that earned a partner a cut */ partner?: string;
  /** "new" | "recurring" */ customer?: string; /** perk title */ perk?: string; qr?: string; branch?: string;
};
export const TX_FILTER_KEYS = ["q", "status", "channel", "payment", "from", "to", "merchant", "category", "city", "campus", "age", "unsettled", "settlement", "customer", "perk", "qr", "branch", "partner"] as const;

export function readTxFilters(get: (k: string) => string | null | undefined): TxFilters {
  const f: TxFilters = {};
  for (const k of TX_FILTER_KEYS) { const v = get(k); if (v) f[k] = v; }
  return f;
}

export const AGE_LABEL: Record<string, string> = { u18: "Under 18", "18-20": "18-20", "21-23": "21-23", "24-26": "24-26", "27+": "27+", unknown: "Unknown" };

/** Birth-date window for an age bucket (ages counted in Cairo today) */
function ageWindow(bucket: string): { after?: string; onOrBefore?: string } | null {
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" }));
  const yearsAgo = (y: number) => { const d = new Date(today); d.setFullYear(d.getFullYear() - y); return d.toLocaleDateString("en-CA"); };
  const range: Record<string, [number, number | null]> = { u18: [0, 17], "18-20": [18, 20], "21-23": [21, 23], "24-26": [24, 26], "27+": [27, null] };
  const r = range[bucket];
  if (!r) return null;
  return { onOrBefore: yearsAgo(r[0]), after: r[1] == null ? undefined : yearsAgo(r[1] + 1) };
}

/** Make the needed embeds inner joins so filters on merchant / branch / student narrow the rows */
export function txSelect(select: string, f: TxFilters) {
  let s = select;
  if (f.category) s = s.replace(/merchant:merchants\(/, "merchant:merchants!inner(category, ");
  if ((f.city && f.city !== "online") || (f.campus && f.campus !== "none")) s = s.replace(/branch:merchant_branches\(/, "branch:merchant_branches!inner(city, campus_id, ");
  if (f.age) s = s.replace(/student:profiles\(/, "student:profiles!inner(birth_date, ");
  if (f.perk) s = s.replace(/perk:perks\(/, "perk:perks!inner(");
  if (f.partner) s += ", pe:partner_earnings!inner(partner_id)";
  return s;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyTxFilters<Q extends Record<string, any>>(q: Q, f: TxFilters): Q {
  let x = q;
  if (f.q) {
    const c = f.q.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
    const raw = f.q.trim().replace(/[^A-Za-z0-9#/._ -]/g, "");
    if (c) x = x.or(`tx_code.ilike.%${c}%,verification_code.eq.${c}${raw ? `,receipt_ref.ilike.%${raw}%` : ""}`);
  }
  if (f.status) x = x.eq("status", f.status);
  if (f.channel) x = x.eq("channel", f.channel);
  if (f.payment) x = x.eq("payment_method", f.payment);
  if (f.merchant) x = x.eq("merchant_id", f.merchant);
  if (f.unsettled === "1") x = x.is("settlement_id", null).neq("status", "reversed").or("payment_method.eq.merchant,payment_status.eq.paid");
  if (f.settlement) x = x.eq("settlement_id", f.settlement);
  if (f.customer === "new") x = x.eq("first_time_at_merchant", true);
  if (f.customer === "recurring") x = x.eq("first_time_at_merchant", false);
  if (f.perk) x = x.eq("perk.title", f.perk);
  if (f.qr) x = x.eq("qr_code_id", f.qr);
  if (f.branch) x = x.eq("branch_id", f.branch);
  if (f.partner && f.partner !== "any") x = x.eq("pe.partner_id", f.partner);
  if (f.from) x = x.gte("created_at", `${f.from}T00:00:00+02:00`);
  if (f.to) x = x.lte("created_at", `${f.to}T23:59:59+02:00`);
  if (f.category) x = x.eq("merchant.category", f.category);
  if (f.city === "online") x = x.is("branch_id", null);
  else if (f.city === "unknown") x = x.is("branch.city", null);
  else if (f.city) x = x.eq("branch.city", f.city);
  if (f.campus === "none") x = x.not("branch_id", "is", null);
  else if (f.campus) x = x.eq("branch.campus_id", f.campus);
  if (f.age === "unknown") x = x.is("student.birth_date", null);
  else if (f.age) {
    const w = ageWindow(f.age);
    if (w?.onOrBefore) x = x.lte("student.birth_date", w.onOrBefore);
    if (w?.after) x = x.gt("student.birth_date", w.after);
  }
  return x;
}
