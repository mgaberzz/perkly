import { useMemo } from 'react';
import { distanceM } from './format';
import { useSession } from './session';
import type { Merchant, Perk } from './types';

export type PerkItem = { perk: Perk; merchant: Merchant; distance: number | null; branchName: string | null; redeemed: number };

/** Every live perk with its merchant, nearest-branch distance (from the browsing area) and popularity. */
export function usePerkItems() {
  const { merchants, origin, popularity } = useSession();
  return useMemo<PerkItem[]>(() => merchants.flatMap((m) => {
    const branches = m.branches.filter((b) => b.lat != null && b.lng != null)
      .map((b) => ({ b, d: origin ? distanceM(origin, { lat: b.lat!, lng: b.lng! }) : null }))
      .sort((a, z) => (a.d ?? 1e12) - (z.d ?? 1e12));
    return m.perks.map((perk) => {
      const own = perk.branch_id ? branches.find((x) => x.b.id === perk.branch_id) : branches[0];
      return { perk, merchant: m, distance: own?.d ?? null, branchName: own?.b.name ?? m.branches[0]?.name ?? null, redeemed: popularity[perk.id] ?? 0 };
    });
  }), [merchants, origin, popularity]);
}

export type SortKey = 'nearest' | 'discount' | 'popular' | 'ending';
export type Filters = { flashOnly: boolean; noMinSpend: boolean; big: boolean };
export const NO_FILTERS: Filters = { flashOnly: false, noMinSpend: false, big: false };

export function applySortFilter(items: PerkItem[], sort: SortKey, f: Filters) {
  let out = items;
  if (f.flashOnly) out = out.filter((x) => x.perk.is_flash);
  if (f.noMinSpend) out = out.filter((x) => !Number(x.perk.min_spend));
  if (f.big) out = out.filter((x) => x.perk.discount_type === 'percentage' && Number(x.perk.discount_value) >= 20);
  const by: Record<SortKey, (a: PerkItem, b: PerkItem) => number> = {
    nearest: (a, b) => (a.distance ?? 1e12) - (b.distance ?? 1e12),
    discount: (a, b) => Number(b.perk.discount_value) - Number(a.perk.discount_value),
    popular: (a, b) => b.redeemed - a.redeemed || Number(b.perk.priority_score ?? 0) - Number(a.perk.priority_score ?? 0),
    ending: (a, b) => (a.perk.end_at ? new Date(a.perk.end_at).getTime() : 1e15) - (b.perk.end_at ? new Date(b.perk.end_at).getTime() : 1e15),
  };
  return [...out].sort(by[sort]);
}

/** Curated collections (client-side rules). */
export const COLLECTIONS = [
  { key: 'flash', title: 'Ending soon', emoji: '⏳', tag: 'Flash', colors: ['#FF3EA5', '#FF7A59'] as const, match: (x: PerkItem) => x.perk.is_flash },
  { key: 'hero', title: 'Hero deals 20%+', emoji: '🦸', tag: 'Trending', colors: ['#7B2FF7', '#FF3EA5'] as const, match: (x: PerkItem) => x.perk.discount_type === 'percentage' && Number(x.perk.discount_value) >= 20 },
  { key: 'nomin', title: 'No minimum spend', emoji: '🪙', tag: 'Easy', colors: ['#2F80FF', '#7B2FF7'] as const, match: (x: PerkItem) => !Number(x.perk.min_spend) },
  { key: 'coffee', title: 'Coffee runs', emoji: '☕', tag: 'Study fuel', colors: ['#8B5CF6', '#F59E0B'] as const, match: (x: PerkItem) => x.merchant.category === 'Coffee' },
  { key: 'fun', title: 'Weekend plans', emoji: '🎳', tag: 'Fun', colors: ['#10B981', '#2F80FF'] as const, match: (x: PerkItem) => ['Entertainment', 'Fitness'].includes(x.merchant.category) },
  { key: 'popular', title: 'Campus favorites', emoji: '💜', tag: 'Trending', colors: ['#FF3EA5', '#7B2FF7'] as const, match: (x: PerkItem) => x.redeemed > 0 },
] as const;
export type CollectionKey = (typeof COLLECTIONS)[number]['key'];
