import type { Merchant, Perk } from './types';

export const egp = (n: number | null | undefined) =>
  n == null ? '—' : `${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })} EGP`;

export function discountLabel(p: Pick<Perk, 'discount_type' | 'discount_value'>) {
  switch (p.discount_type) {
    case 'percentage': return `${Number(p.discount_value)}% OFF`;
    case 'amount': return `${Number(p.discount_value)} EGP OFF`;
    case 'bogo': return 'BUY 1 GET 1';
    default: return 'BUNDLE';
  }
}

/** Best (highest) percentage on a merchant, for badges like "Save up to 20%". */
export function bestPerk(perks: Perk[]) {
  return [...perks].sort((a, b) => Number(b.is_flash) - Number(a.is_flash) || Number(b.discount_value) - Number(a.discount_value))[0];
}

export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000, rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const distanceLabel = (m: number | null | undefined) =>
  m == null ? '' : m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;

export function timeLeft(iso: string | null) {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'Ended';
  const h = Math.floor(ms / 3600000);
  if (h >= 24) return `${Math.floor(h / 24)}d left`;
  if (h >= 1) return `${h}h left`;
  return `${Math.max(1, Math.floor(ms / 60000))}m left`;
}

export const LEVELS = [
  { level: 1, xp: 0, name: 'Newbie' }, { level: 2, xp: 200, name: 'Explorer' }, { level: 3, xp: 600, name: 'Saver' },
  { level: 4, xp: 1200, name: 'Insider' }, { level: 5, xp: 2000, name: 'Elite Saver' }, { level: 6, xp: 3000, name: 'Perk Master' },
  { level: 7, xp: 4500, name: 'Campus Legend' },
];

export function levelProgress(totalXp: number) {
  const cur = [...LEVELS].reverse().find((l) => totalXp >= l.xp) ?? LEVELS[0];
  const next = LEVELS.find((l) => l.level === cur.level + 1);
  if (!next) return { cur, next: null, pct: 1, toNext: 0 };
  return { cur, next, pct: (totalXp - cur.xp) / (next.xp - cur.xp), toNext: next.xp - totalXp };
}

export const firstName = (n: string | null | undefined) => (n ?? '').trim().split(/\s+/)[0] || 'there';

/** Distance (m) from the user to a merchant's closest branch. */
export function nearestBranch(m: Merchant, coords: { lat: number; lng: number } | null) {
  if (!coords) return null;
  const d = m.branches.filter((b) => b.lat != null && b.lng != null).map((b) => distanceM(coords, { lat: b.lat!, lng: b.lng! }));
  return d.length ? Math.min(...d) : null;
}

