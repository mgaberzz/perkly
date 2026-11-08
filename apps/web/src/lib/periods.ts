/** Date periods for dashboards, in Cairo time. Returns YYYY-MM-DD strings (inclusive). */
export const PERIODS = ["today", "mtd", "last_month", "7d", "30d", "90d", "ytd", "custom"] as const;
export type Period = (typeof PERIODS)[number];
export const PERIOD_LABEL: Record<Period, string> = {
  today: "Today", mtd: "This month (MTD)", last_month: "Last month", "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", ytd: "This year (YTD)", custom: "Custom dates",
};

const cairoToday = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" }));
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const valid = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export function resolvePeriod(p: string | undefined, from?: string, to?: string): { period: Period; from: string; to: string } {
  const now = cairoToday();
  const today = iso(now);
  const back = (n: number) => { const d = new Date(now); d.setDate(d.getDate() - (n - 1)); return iso(d); };
  switch (p) {
    case "today": return { period: "today", from: today, to: today };
    case "last_month": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1), last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { period: "last_month", from: iso(first), to: iso(last) };
    }
    case "7d": return { period: "7d", from: back(7), to: today };
    case "30d": return { period: "30d", from: back(30), to: today };
    case "90d": return { period: "90d", from: back(90), to: today };
    case "ytd": return { period: "ytd", from: `${now.getFullYear()}-01-01`, to: today };
    case "custom":
      if (valid(from)) return { period: "custom", from: from!, to: valid(to) && to! >= from! ? to! : today };
      break;
  }
  return { period: "mtd", from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
}

/** Every day between two dates (inclusive) */
export function daysBetween(from: string, to: string) {
  const out: string[] = [];
  const d = new Date(`${from}T12:00:00Z`), end = new Date(`${to}T12:00:00Z`);
  while (d <= end && out.length < 400) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}
