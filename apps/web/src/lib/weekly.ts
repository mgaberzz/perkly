import { cairoLocalToISO } from "./cairo-time";

const day = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (dateStr: string, n: number) => day(new Date(new Date(`${dateStr}T12:00:00Z`).getTime() + n * 86400_000));

/** Last full week (it starts on Sunday, Cairo time) and the week before it. */
export function lastWeek(now: Date = new Date()) {
  const today = now.toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  const thisMonday = addDays(today, -dow); // the Sunday that starts the current week
  const from = addDays(thisMonday, -7), prevFrom = addDays(thisMonday, -14), lastDay = addDays(thisMonday, -1);
  return {
    from, lastDay, prevFrom,
    fromISO: cairoLocalToISO(`${from}T00:00`)!, toISO: cairoLocalToISO(`${thisMonday}T00:00`)!, prevFromISO: cairoLocalToISO(`${prevFrom}T00:00`)!,
  };
}

export type WeekRow = { user_id: string; original_amount: number | null; final_amount: number | null; discount_amount: number | null;
  first_time_at_merchant: boolean; created_at: string; perk: { title: string } | null };

export function summarize(rows: WeekRow[]) {
  const sum = (f: (r: WeekRow) => number | null) => rows.reduce((a, r) => a + Number(f(r) ?? 0), 0);
  const perks = new Map<string, number>(), days = new Map<string, number>();
  for (const r of rows) {
    if (r.perk?.title) perks.set(r.perk.title, (perks.get(r.perk.title) ?? 0) + 1);
    const d = new Date(r.created_at).toLocaleDateString("en-US", { timeZone: "Africa/Cairo", weekday: "long" });
    days.set(d, (days.get(d) ?? 0) + 1);
  }
  const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return {
    transactions: rows.length, students: new Set(rows.map((r) => r.user_id)).size, newCustomers: rows.filter((r) => r.first_time_at_merchant).length,
    sales: sum((r) => r.final_amount ?? r.original_amount), discount: sum((r) => r.discount_amount), topPerk: top(perks), bestDay: top(days),
  };
}
/** "+25%" / "−10%" versus the week before; "" when there is nothing to compare with. */
export function change(now: number, before: number) {
  if (!before) return now ? "new" : "";
  const p = Math.round(((now - before) / before) * 100);
  return p === 0 ? "0%" : `${p > 0 ? "+" : "−"}${Math.abs(p)}%`;
}
