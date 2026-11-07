/**
 * Transaction filters shared by the Transactions page and the Excel/CSV export, including the drill-downs
 * from Insights (sector, location, campus, age range, merchant).
 */
export type TxFilters = {
  status?: string; channel?: string; payment?: string; from?: string; to?: string;
  merchant?: string; category?: string; city?: string; campus?: string; age?: string;
};
export const TX_FILTER_KEYS = ["status", "channel", "payment", "from", "to", "merchant", "category", "city", "campus", "age"] as const;

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
  return s;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyTxFilters<Q extends Record<string, any>>(q: Q, f: TxFilters): Q {
  let x = q;
  if (f.status) x = x.eq("status", f.status);
  if (f.channel) x = x.eq("channel", f.channel);
  if (f.payment) x = x.eq("payment_method", f.payment);
  if (f.merchant) x = x.eq("merchant_id", f.merchant);
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
