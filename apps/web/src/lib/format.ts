import type { Perk } from "./types";

export const egp = (n: number | null | undefined) =>
  n == null ? "—" : `${Number(n).toLocaleString("en-EG", { maximumFractionDigits: 2 })} EGP`;

export const dateTime = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString("en-GB", { timeZone: "Africa/Cairo", dateStyle: "medium", timeStyle: "short" }) : "—";

export const date = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("en-GB", { timeZone: "Africa/Cairo", dateStyle: "medium" }) : "—";

export function discountLabel(p: Pick<Perk, "discount_type" | "discount_value">, t: (s: string, v?: Record<string, string | number>) => string = (s, v) => s.replace("{n}", String(v?.n ?? ""))) {
  switch (p.discount_type) {
    case "percentage": return t("{n}% off", { n: Number(p.discount_value) });
    case "amount": return t("{n} EGP off", { n: Number(p.discount_value) });
    case "bogo": return t("Buy 1 get 1");
    case "bundle": return t("Bundle deal");
  }
}

export function tierFor(p: Pick<Perk, "discount_type" | "discount_value">) {
  if (p.discount_type !== "percentage") return null;
  const v = Number(p.discount_value);
  if (v > 30) return { name: "Hero", cls: "bg-perk-pink/15 text-perk-pink" };
  if (v >= 25) return { name: "Gold", cls: "bg-amber-100 text-amber-700" };
  if (v >= 15) return { name: "Silver", cls: "bg-zinc-200 text-zinc-700" };
  return { name: "Bronze", cls: "bg-orange-100 text-orange-700" };
}

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
